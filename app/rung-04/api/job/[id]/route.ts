import { queue } from '@/lib/bullmq-queue';
import { JobResponse } from '@/lib/rung-04-types';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const job = await queue.getJob(id);
    if (!job) {
        return Response.json({ error: 'Not found' }, { status: 404 });
    }
    const state = await job.getState();
    const body: JobResponse = {
        id: job.id,
        state,
        progress: typeof job.progress === 'number' ? job.progress : 0,
        result: job.returnvalue,
        error: job.failedReason,
    };
    return Response.json(body);
}