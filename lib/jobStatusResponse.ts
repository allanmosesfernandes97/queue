import type { JobState, JobProgress } from "bullmq";

export type JobStatusResponse = {
    progress: JobProgress;
    failedReason?: string;
    resultsUrl?: string;
    state: JobState | 'unknown';
};