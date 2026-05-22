export type JobState = {
    id: string;
    status: 'pending' | 'processing' | 'done' | 'failed';
    progress?: number;
    resultDataUrl?: string;
    error?: string;
};

const g = globalThis as unknown as { __jobState?: Map<string, JobState> };
const jobStore = g.__jobState ?? new Map<string, JobState>();
g.__jobState = jobStore;

// Functions to interact with the job store
export const getJob = (id: string): JobState | undefined => {
    return jobStore.get(id);
};

//1. Create new job
export const createJob = (id: string): JobState => {
    const newJob: JobState = {
        id,
        status: 'pending',
        progress: 10,
    };
    jobStore.set(id, newJob);
    return newJob;
};

export const updateProgress = (id: string, progress: number) => {
    const job = jobStore.get(id);
    if (!job) return;
    job.progress = progress;
    job.status = 'processing';
};

export const setDone = (id: string, resultDataUrl: string) => {
    const job = jobStore.get(id);
    if (!job) return;
    job.progress = 100;
    job.status = 'done';
    job.resultDataUrl = resultDataUrl;
};

export const setFailed = (id: string, error: string) => {
    const job = jobStore.get(id);
    if (!job) return;
    job.error = error;
    job.status = 'failed';
};