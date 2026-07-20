// Качает веса ML-моделей в образ на этапе docker build, чтобы рантайм не тянул их
// заново при каждом холодном старте контейнера. Путь ниже должен совпадать
// с TRANSFORMERS_CACHE_DIR в src/analysis/transformers-cache-dir.ts.
import { env, pipeline } from '@xenova/transformers';

env.cacheDir = '/app/.cache/transformers/';

console.log('Скачиваю модель Xenova/whisper-tiny (STT) в кэш образа...');
await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', { quantized: true });

console.log('Скачиваю модель распознавания эмоций (тональность) в кэш образа...');
await pipeline('audio-classification', 'onnx-community/wav2vec2-base-Speech_Emotion_Recognition-ONNX', {
  quantized: true,
});

console.log('Готово.');
