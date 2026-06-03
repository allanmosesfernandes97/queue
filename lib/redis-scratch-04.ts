import IORedis from 'ioredis';

type GlobaRedis = { redis?: IORedis };

const g = globalThis as unknown as GlobaRedis;

export const redis =
    g.redis ??
    new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });

g.redis = redis;