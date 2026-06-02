# Checkpoint 02 — `lib/redis-scratch-04.ts` (the connection)

## Concept

This file hands out **one** Redis connection that the API routes and the worker
import. Reference shape:

```ts
import IORedis from 'ioredis';
type GlobalRedis = { __redis?: IORedis };
const g = globalThis as unknown as GlobalRedis;
export const __redis = g.__redis ?? new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
g.__redis = __redis;
```

## Questions

**Q1.** Why stash the connection on `globalThis` instead of just
`export const redis = new IORedis(...)`? Think about what HMR does on every save.

> Your answer:

**Q2.** A TCP connection is a finite resource. If Q1 went unhandled over a long
dev session, what runs out, and what error would Redis eventually throw?

> Your answer:

**Q3.** `maxRetriesPerRequest: null` (retry forever). Default ioredis gives up
and **throws** after a few failed attempts. Given a worker spends most of its
life parked on a **blocking** command waiting for a job that may take minutes —
why is the default a disaster for a worker specifically?

> Your answer:

---

<details>
<summary>Model answers</summary>

**Q1.** HMR re-executes the module file on every save. `new IORedis(...)` would
run *again* → a brand-new TCP connection each save. (It does **not** create a new
Redis *server* — Redis is a separate program, untouched; what's recreated is the
*client connection*.) `globalThis` survives module re-execution, so
`g.__redis ?? new IORedis(...)` means "reuse the one already there; build a new
one only the first time." One connection per dev session, not one per save.

**Q2.** Without the guard, every save leaks a connection (old socket never
closed). Two things run out: **file descriptors** on the Node side, and Redis's
**`maxclients`** cap (default 10,000) on the server side. Hitting it →
`ERR max number of clients reached`. Symptom: app runs fine for an hour, then
*every* Redis op fails, and restarting "fixes" it (leaked connections die with
the process). The singleton prevents this leak.

**Q3.** Default ioredis rejects a command with an error after
`maxRetriesPerRequest` (~20) attempts. A worker spends 99% of its life on a
**blocking** command that can legitimately stay pending for minutes. With the
finite default, ioredis decides that long-pending command "failed," throws into
the worker, and the fetch loop crashes **during normal idle waiting** — your
worker dies every time the queue is quiet. `null` = "never give up, hold it open
forever," which is exactly what a blocking-pull worker needs. BullMQ *requires*
this and throws a loud startup error if you forget.

</details>

<details>
<summary>The file (already committed at lib/redis-scratch-04.ts)</summary>

```ts
import IORedis from 'ioredis';

type GlobalRedis = { __redisScratch04?: IORedis };
const g = globalThis as unknown as GlobalRedis;

export const redisScratch04 =
    g.__redisScratch04 ?? new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
g.__redisScratch04 = redisScratch04;
```

</details>
