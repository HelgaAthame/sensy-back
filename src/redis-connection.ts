import { RedisOptions } from 'ioredis';

/**
 * Managed Redis (Upstash и т.п.) требует пароль и TLS (схема rediss://) — вынесено в общую
 * функцию, чтобы продюсер (BullModule) и воркеры (@Processor) парсили REDIS_URL одинаково,
 * но с разными настройками устойчивости (см. buildProducerConnection/buildWorkerConnection).
 */
function parseRedisUrl(): { host: string; port: number; username?: string; password?: string; tls?: object } {
  const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
  };
}

/**
 * Для продюсера (HTTP-запрос кладёт задачу в очередь): быстрый отказ вместо ожидания —
 * недоступный Redis не должен вешать ответ на запрос (см. media-files.service.ts, где
 * постановка в очередь дополнительно обёрнута в Promise.race с таймаутом).
 */
export function buildProducerConnection(): RedisOptions {
  return {
    ...parseRedisUrl(),
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 3000,
    retryStrategy: (times: number) => Math.min(times * 1000, 30000),
  };
}

/**
 * Для воркера (долгоживущее blocking-соединение bzpopmin): наоборот, должен терпеливо
 * ждать восстановления связи, а не сразу отказывать — с enableOfflineQueue:false воркер
 * попадал в цикл "Stream isn't writeable" при малейшей сетевой заминке вместо того, чтобы
 * дождаться переподключения.
 */
export function buildWorkerConnection(): RedisOptions {
  return {
    ...parseRedisUrl(),
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => Math.min(times * 1000, 10000),
  };
}
