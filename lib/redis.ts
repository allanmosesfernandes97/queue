import IORedis from 'ioredis';

type GlobalRedis = { __redis?: IORedis };

const g = globalThis as unknown as GlobalRedis;

export const __redis =
    g.__redis ?? new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
g.__redis = __redis;
