import { Queue } from 'bullmq';
import { __redis } from './redis';

export type ResizeJobData = {
    fileName: string;
    base64: string;
};

type GlobalQueue = { __queue?: Queue<ResizeJobData> };
const g = globalThis as unknown as GlobalQueue;
export const queue = g.__queue ?? new Queue<ResizeJobData>('rung-4-resize', { connection: __redis });
g.__queue = queue;