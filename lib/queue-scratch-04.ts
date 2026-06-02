import { Queue } from 'bullmq';
import { redisScratch04 } from './redis-scratch-04';

// The shape of one job's payload. In PRODUCTION `base64` would instead be a
// blob-storage key/URL — job.data lives in Redis (RAM), so shipping raw image
// bytes through the queue burns server memory and gets re-serialized on every
// read. base64 is kept here only to make the lesson self-contained.
export type ResizeJobData = {
    fileName: string;
    base64: string;
};

// Singleton on globalThis: a Queue opens its OWN internal Redis connection, so
// without this guard HMR would leak a fresh connection on every save (same
// maxclients leak as the redis singleton). Built once, reused thereafter.
type GlobalQueue = { __queueScratch04?: Queue<ResizeJobData> };
const g = globalThis as unknown as GlobalQueue;

// This Queue is a PRODUCER + ADMIN handle: add() jobs, inspect them
// (getJob, getJobCounts). It does NOT process anything — that's the Worker's
// job, running as a separate process. Different name from rung-04 on purpose:
// the queue name is the "dead drop" both sides agree on; sharing it would let
// the two apps' workers steal each other's jobs.
export const queueScratch04 =
    g.__queueScratch04 ??
    new Queue<ResizeJobData>('scratch-4-resize', { connection: redisScratch04 });
g.__queueScratch04 = queueScratch04;
