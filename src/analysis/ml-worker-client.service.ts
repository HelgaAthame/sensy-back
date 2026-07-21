import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SttChannelResult } from './stt.service';
import { TonalRegion } from './tonal.service';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

/**
 * Мост к отдельному worker_thread (ml.worker.ts), где реально выполняется Whisper/ONNX-инференс.
 * Единственная причина существования этого класса — не блокировать event loop главного потока
 * (который обслуживает HTTP, включая health-check Render) тяжёлыми синхронными ML-вычислениями.
 * См. комментарий в начале ml.worker.ts.
 */
@Injectable()
export class MlWorkerClientService implements OnModuleDestroy {
  private readonly logger = new Logger(MlWorkerClientService.name);
  private worker: Worker | null = null;
  private readonly pending = new Map<string, PendingRequest>();

  private getWorker(): Worker {
    if (this.worker) return this.worker;

    const workerPath = path.join(__dirname, 'ml.worker.js');
    this.logger.log(`Запускаю ML worker_thread (${workerPath})`);
    const worker = new Worker(workerPath);

    worker.on('message', (message: { id: string; ok: boolean; result?: unknown; error?: string }) => {
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.ok) {
        request.resolve(message.result);
      } else {
        request.reject(new Error(message.error ?? 'ML worker вернул ошибку'));
      }
    });

    worker.on('error', (error) => {
      this.logger.error(`ML worker_thread упал: ${error.message}`);
      for (const request of this.pending.values()) {
        request.reject(error);
      }
      this.pending.clear();
      this.worker = null;
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        this.logger.warn(`ML worker_thread завершился с кодом ${code}`);
      }
      this.worker = null;
    });

    this.worker = worker;
    return worker;
  }

  private call<T>(type: 'transcribe' | 'classifyTonal', payload: Record<string, unknown>): Promise<T> {
    const id = randomUUID();
    const worker = this.getWorker();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      worker.postMessage({ id, type, ...payload });
    });
  }

  async transcribeChannel(audioData: Float32Array, channel: number): Promise<SttChannelResult> {
    return this.call<SttChannelResult>('transcribe', { audioData, channel });
  }

  async classifyTonal(
    audioData: Float32Array,
    channel: number,
    chunks: { startTime: number; endTime: number }[],
  ): Promise<TonalRegion[]> {
    return this.call<TonalRegion[]>('classifyTonal', { audioData, channel, chunks });
  }

  onModuleDestroy() {
    this.worker?.terminate();
  }
}
