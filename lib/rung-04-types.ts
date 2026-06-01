import type { JobState } from "bullmq";

export type JobResponse = {
    id?: string;
    state: JobState | 'unknown';
    progress: number;
    result?: string;
    error?: string;
}