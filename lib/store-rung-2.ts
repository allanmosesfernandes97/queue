// Job store
export type JobState = {
    id: string
    status: 'pending' | 'processing' | 'done' | 'failed'
    progress: number
    resultDataUrl?: string
    error?:string
}

const g = globalThis as unknown as { __jobStore?: Map<string, JobState> }
const jobs = g.__jobStore ?? new Map<string, JobState>()
g.__jobStore = jobs;


export function createJob(id: string): JobState {
    const job: JobState = { id, status: 'pending', progress: 0 };
    jobs.set(id, job);
    return job;
}

export function getJob(id: string): JobState | undefined {
    return jobs.get(id);
}

export function updateProgress(id: string, progress: number): void {
    const job = jobs.get(id);
    if (!job) return
    job.progress = progress;
    job.status = 'processing'
}

export function setDone(id: string, resultDataUrl: string): void {
    const job = jobs.get(id);
    if (!job) return;
    job.progress = 100;
    job.status = 'done'
    job.resultDataUrl = resultDataUrl
}

export function setFailed(id: string, error: string): void {
    const job = jobs.get(id);
    if (!job) return;
    job.status = 'failed';
    job.error = error
}