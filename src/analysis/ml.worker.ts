// Отдельный поток (Node worker_threads), не связанный с NestJS DI-контейнером.
// Whisper/ONNX-инференс синхронно блокирует JS event loop на минуты — если делать это
// в главном потоке, HTTP-сервер (включая ответы на health-check Render) перестаёт отвечать,
// и платформа считает контейнер зависшим и убивает его посреди анализа. Здесь та же
// тяжёлая работа выполняется в отдельном потоке со своим собственным event loop, поэтому
// главный поток остаётся отзывчивым, сколько бы времени ни занял инференс.
import { parentPort } from 'worker_threads';
import { env, pipeline } from '@xenova/transformers';
import { TRANSFORMERS_CACHE_DIR } from './transformers-cache-dir';

env.cacheDir = TRANSFORMERS_CACHE_DIR;

const WHISPER_SAMPLE_RATE = 16000;
const SER_MODEL_ID = 'onnx-community/wav2vec2-base-Speech_Emotion_Recognition-ONNX';
const NEGATIVE_LABELS = new Set(['SAD', 'ANGRY', 'DISGUST', 'FEAR']);
const MIN_CHUNK_DURATION_S = 0.2;

interface SttChunkResult {
  channel: number;
  startChar: number;
  endChar: number;
  startTime: number;
  endTime: number;
  text: string;
}

interface WhisperChunk {
  text: string;
  timestamp: [number, number | null];
}

interface WhisperOutput {
  text: string;
  chunks?: WhisperChunk[];
}

interface EmotionScore {
  label: string;
  score: number;
}

interface TonalRegion {
  prob: number;
  type: number;
  startTime: number;
  endTime: number;
  channel: number;
}

type WhisperPipeline = (audio: Float32Array, options: Record<string, unknown>) => Promise<WhisperOutput | WhisperOutput[]>;
type EmotionClassifier = (audio: Float32Array, options?: Record<string, unknown>) => Promise<EmotionScore[] | EmotionScore[][]>;

let whisperPromise: Promise<WhisperPipeline> | null = null;
function getWhisperPipeline(): Promise<WhisperPipeline> {
  if (!whisperPromise) {
    whisperPromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
      quantized: true,
    }) as unknown as Promise<WhisperPipeline>;
  }
  return whisperPromise;
}

let tonalPromise: Promise<EmotionClassifier> | null = null;
function getTonalPipeline(): Promise<EmotionClassifier> {
  if (!tonalPromise) {
    tonalPromise = pipeline('audio-classification', SER_MODEL_ID, {
      quantized: true,
    }) as unknown as Promise<EmotionClassifier>;
  }
  return tonalPromise;
}

async function transcribeChannel(audioData: Float32Array, channel: number) {
  const transcriber = await getWhisperPipeline();
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

async function classifyTonal(audioData: Float32Array, channel: number, chunks: { startTime: number; endTime: number }[]) {
  if (chunks.length === 0) return [];
  const classifier = await getTonalPipeline();

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

interface WorkerRequest {
  id: string;
  type: 'transcribe' | 'classifyTonal';
  audioData: Float32Array;
  channel: number;
  chunks?: { startTime: number; endTime: number }[];
}

parentPort?.on('message', async (message: WorkerRequest) => {
  const { id, type, audioData, channel, chunks } = message;
  try {
    const result =
      type === 'transcribe' ? await transcribeChannel(audioData, channel) : await classifyTonal(audioData, channel, chunks ?? []);
    parentPort?.postMessage({ id, ok: true, result });
  } catch (error) {
    parentPort?.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
