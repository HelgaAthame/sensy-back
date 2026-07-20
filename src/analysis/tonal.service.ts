import { Injectable, Logger } from '@nestjs/common';
import { env, pipeline } from '@xenova/transformers';
import { WHISPER_SAMPLE_RATE } from './audio.service';
import { TRANSFORMERS_CACHE_DIR } from './transformers-cache-dir';

env.cacheDir = TRANSFORMERS_CACHE_DIR;

// Акустическая (не текстовая) модель распознавания эмоций — переносится между языками
// заметно хуже, чем между акцентами одного языка, но отдельной готовой ONNX-модели под
// русскую речь, совместимой с transformers.js, на момент реализации нет (см. BACKEND_PLAN.md).
const MODEL_ID = 'onnx-community/wav2vec2-base-Speech_Emotion_Recognition-ONNX';
const NEGATIVE_LABELS = new Set(['SAD', 'ANGRY', 'DISGUST', 'FEAR']);
const MIN_CHUNK_DURATION_S = 0.2;

export interface TonalRegion {
  prob: number;
  type: number;
  startTime: number;
  endTime: number;
  channel: number;
}

interface EmotionScore {
  label: string;
  score: number;
}

type EmotionClassifier = (
  audio: Float32Array,
  options?: Record<string, unknown>,
) => Promise<EmotionScore[] | EmotionScore[][]>;

@Injectable()
export class TonalService {
  private readonly logger = new Logger(TonalService.name);
  private pipelinePromise: Promise<EmotionClassifier> | null = null;

  private getPipeline(): Promise<EmotionClassifier> {
    if (!this.pipelinePromise) {
      this.logger.log(`Загружаю модель распознавания эмоций (${MODEL_ID})...`);
      this.pipelinePromise = pipeline('audio-classification', MODEL_ID, {
        quantized: true,
      }) as unknown as Promise<EmotionClassifier>;
    }
    return this.pipelinePromise;
  }

  async classifyChunks(
    audioData: Float32Array,
    channel: number,
    chunks: { startTime: number; endTime: number }[],
  ): Promise<TonalRegion[]> {
    if (chunks.length === 0) return [];
    const classifier = await this.getPipeline();

    const regions: TonalRegion[] = [];
    for (const chunk of chunks) {
      if (chunk.endTime - chunk.startTime < MIN_CHUNK_DURATION_S) continue;

      const startSample = Math.max(0, Math.floor(chunk.startTime * WHISPER_SAMPLE_RATE));
      const endSample = Math.min(audioData.length, Math.ceil(chunk.endTime * WHISPER_SAMPLE_RATE));
      if (endSample - startSample < MIN_CHUNK_DURATION_S * WHISPER_SAMPLE_RATE) continue;

      const slice = audioData.subarray(startSample, endSample);
      const rawResult = await classifier(slice, { topk: 6 });
      const scores = (Array.isArray(rawResult[0]) ? rawResult[0] : rawResult) as EmotionScore[];

      const negativeProb = scores
        .filter((score) => NEGATIVE_LABELS.has(score.label.toUpperCase()))
        .reduce((sum, score) => sum + score.score, 0);

      regions.push({
        prob: negativeProb,
        type: negativeProb >= 0.5 ? 1 : 0,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        channel,
      });
    }
    return regions;
  }
}
