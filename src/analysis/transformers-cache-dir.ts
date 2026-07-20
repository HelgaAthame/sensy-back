/**
 * Единая точка правды для пути кэша моделей @xenova/transformers.
 * Используется и рантаймом (stt.service.ts), и prefetch-скриптом, который
 * докер собирает в образ на этапе билда (см. scripts/prefetch-whisper-model.mjs
 * и Dockerfile) — пути должны совпадать, иначе рантайм не найдёт закэшированную
 * модель и будет качать её заново при каждом холодном старте контейнера.
 */
export const TRANSFORMERS_CACHE_DIR = '/app/.cache/transformers/';
