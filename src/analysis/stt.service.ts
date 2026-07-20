import { Injectable, Logger } from '@nestjs/common';
import { env, pipeline } from '@xenova/transformers';
import { TRANSFORMERS_CACHE_DIR } from './transformers-cache-dir';

env.cacheDir = TRANSFORMERS_CACHE_DIR;

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

interface WhisperChunk {
  text: string;
  timestamp: [number, number | null];
}

interface WhisperOutput {
  text: string;
  chunks?: WhisperChunk[];
}

type WhisperPipeline = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<WhisperOutput | WhisperOutput[]>;

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);
  private pipelinePromise: Promise<WhisperPipeline> | null = null;

  private getPipeline(): Promise<WhisperPipeline> {
    if (!this.pipelinePromise) {
      this.logger.log('Загружаю модель Whisper (Xenova/whisper-tiny)...');
      this.pipelinePromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
        quantized: true,
      }) as unknown as Promise<WhisperPipeline>;
    }
    return this.pipelinePromise;
  }

  async transcribeChannel(audioData: Float32Array, channel: number): Promise<SttChannelResult> {
    const transcriber = await this.getPipeline();
    const rawResult = await transcriber(audioData, {
      return_timestamps: true,
      chunk_length_s: 30,
      language: 'russian',
      task: 'transcribe',
    });
    const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;

    let cursor = 0;
    const chunks: SttChunkResult[] = (result.chunks ?? []).map((chunk) => {
      const text = chunk.text ?? '';
      const startChar = cursor;
      const endChar = cursor + text.length;
      cursor = endChar;
      const [startTime, endTime] = chunk.timestamp ?? [0, 0];
      return {
        channel,
        startChar,
        endChar,
        startTime: startTime ?? 0,
        endTime: endTime ?? startTime ?? 0,
        text,
      };
    });

    return { text: result.text ?? '', chunks };
  }
}
