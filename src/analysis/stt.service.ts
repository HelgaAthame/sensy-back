import { Injectable } from '@nestjs/common';
import { MlWorkerClientService } from './ml-worker-client.service';

export interface SttChunkResult {
  channel: number;
  startChar: number;
  endChar: number;
  startTime: number;
  endTime: number;
  text: string;
}

export interface SttChannelResult {
  text: string;
  chunks: SttChunkResult[];
}

/**
 * Тонкий прокси к worker_thread (ml.worker.ts) — сам инференс Whisper выполняется там,
 * чтобы не блокировать event loop главного потока. См. комментарий в ml.worker.ts.
 */
@Injectable()
export class SttService {
  constructor(private readonly mlWorker: MlWorkerClientService) {}

  transcribeChannel(audioData: Float32Array, channel: number): Promise<SttChannelResult> {
    return this.mlWorker.transcribeChannel(audioData, channel);
  }
}
