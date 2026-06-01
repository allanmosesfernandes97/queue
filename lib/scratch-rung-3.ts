import { sleep } from '@/utils/lib';
import sharp from 'sharp';

export type JobStatus = {
    status: 'pending' | 'processing' | 'done' | 'failed';
    id: string;
    progress: number;
    resultsDataUrl?: string;
    error?: string;
};

type PendingJob = {
    id: string;
    input: Buffer;
};

// Queue for incoming jobs
// const queue: Job[] = [];

// Global State
type GlobalState = {
    __jobStore?: Map<string, JobStatus>;
    __pendingJobs?: PendingJob[];
    __active?: number;
};

type Stats = {
    active: number;
    pendingJobs: number;
    concurrency: number;
}
// Create the jobStore

// Tell the compiler we'll have a globalThis that "might" have __jobStore
const g = globalThis as unknown as GlobalState;

// Check runtime if __jobStore exists
const __jobStore = g.__jobStore ?? new Map<string, JobStatus>();
const __pendingJobs = g.__pendingJobs ?? [];
const CONCURRENT_JOBS = 4;
let active = g.__active ?? 0;

g.__jobStore = __jobStore;
g.__pendingJobs = __pendingJobs;
g.__active = active;

function addJob(id: string) {
    const job = __jobStore.get(id);
    if (job) return;
    const newJob: JobStatus = {
        id,
        progress: 0,
        status: 'pending',
    };
    __jobStore.set(id, newJob);
}

function updateProgress(id: string, progress: number): void {
    const job = __jobStore.get(id);
    if (!job) return;
    job.progress = progress;
    job.status = 'processing';
}

function setComplete(id: string, resultDataUrl: string): void {
    const job = __jobStore.get(id);
    if (!job) return;
    job.progress = 100;
    job.status = 'done';
    job.resultsDataUrl = resultDataUrl;
}

function setFailed(id: string, error: string): void {
    const job = __jobStore.get(id);
    if (!job) return;
    job.status = 'failed';
    job.error = error;
}

export function stats(): Stats {
    return {
        active: g.__active ?? 0,
        pendingJobs: __pendingJobs.length,
        concurrency: CONCURRENT_JOBS,
    };
}

export function getJob(id:string): JobStatus | undefined {
    const job = __jobStore.get(id);
    if (!job) return;
    return job;
}
//
export function enqueue(incomingJob: PendingJob): void {
    // Add incoming job to queue
    __pendingJobs.push(incomingJob);
    addJob(incomingJob.id);
    void tick();
}

// image processing
async function imageProcessing(id: string, imageBuffer: Buffer) {
    // Send the imageBuffer to sharp
    try {
        // 1. Fake process
        for (let p = 10; p < 90; p += 10) {
            await sleep(800);
            updateProgress(id, p);
        }
        // Actual image processing
        const outputBytes = await sharp(imageBuffer)
            .resize(1024, 1024, { fit: 'inside' })
            .png()
            .toBuffer();
        const resultDataUrl = `data:image/jpeg;base64,${outputBytes.toString('base64')}`;
        setComplete(id, resultDataUrl);
    } catch (err) {
        setFailed(id, err instanceof Error ? err.message : String(err));
    }
}

async function tick() {
    while (active < CONCURRENT_JOBS && __pendingJobs.length > 0) {
        // 1. Take the next job from the queue
        const currentJob = __pendingJobs.shift()!;
        const { id, input } = currentJob;
        // 2. Increase counter
        active++;
        g.__active = active;

        imageProcessing(id, input).finally(() => {
            active--;
            g.__active = active;
            tick();
        });
    }
}
