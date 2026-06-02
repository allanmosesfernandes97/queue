import IORedis from 'ioredis';

// We stash the connection on globalThis so HMR (which re-executes this module
// on every file save in dev) reuses ONE connection instead of leaking a new
// TCP socket each time. A leak here eventually exhausts Redis's `maxclients`
// and you start seeing "ERR max number of clients reached".
type GlobalRedis = { __redisScratch04?: IORedis };
const g = globalThis as unknown as GlobalRedis;

// maxRetriesPerRequest: null — never give up on a command. A worker parks on a
// BLOCKING command waiting for the next job (possibly for minutes); the finite
// default would treat that long wait as a failure and crash the worker mid-idle.
// BullMQ requires `null` for any connection shared with a Worker.
export const redisScratch04 =
    g.__redisScratch04 ?? new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
g.__redisScratch04 = redisScratch04;
