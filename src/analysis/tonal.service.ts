import { Injectable } from '@nestjs/common';
import { MlWorkerClientService } from './ml-worker-client.service';

export interface TonalRegion {
  prob: number;
  type: number;
  startTime: number;
  endTime: number;
  channel: number;
}

/**
 * Тонкий прокси к worker_thread (ml.worker.ts) — сам инференс SER-модели выполняется там,
 * чтобы не блокировать event loop главного потока. См. комментарий в ml.worker.ts.
 *
 * Акустическая (не текстовая) модель распознавания эмоций — переносится между языками
 * заметно хуже, чем между акцентами одного языка, но отдельной готовой ONNX-модели под
 * русскую речь, совместимой с transformers.js, на момент реализации нет (см. BACKEND_PLAN.md).
 */
@Injectable()
export class TonalService {
  constructor(private readonly mlWorker: MlWorkerClientService) {}

  classifyChunks(
    audioData: Float32Array,
    channel: number,
    chunks: { startTime: number; endTime: number }[],
  ): Promise<TonalRegion[]> {
    return this.mlWorker.classifyTonal(audioData, channel, chunks);
  }
}
