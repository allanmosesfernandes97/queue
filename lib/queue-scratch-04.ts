import { Queue } from 'bullmq';
import { redis } from './redis-scratch-04';

export const RESIZE_QUEUE_NAME = 'resize-image';

export type ResizeJobData = {
    fileName: string;
    inputBase64: string;
};

type GlobalResizeQueue = { resizeQueue?: Queue<ResizeJobData> };

const g = globalThis as unknown as GlobalResizeQueue;

export const resizeQueue = g.resizeQueue ?? new Queue<ResizeJobData>(RESIZE_QUEUE_NAME, { connection: redis });

g.resizeQueue = resizeQueue;