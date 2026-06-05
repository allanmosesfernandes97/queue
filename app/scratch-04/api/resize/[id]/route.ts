import { resizeQueue } from '@/lib/queue-scratch-04';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const job = await resizeQueue.getJob(id);
    if (job) {
        const jobState = await job.getState();
        const progress = job.progress;
        const failedReason = job.failedReason;
        return Response.json({ jobId: id, jobState });
    } else {
        return Response.json({ error: 'Job not found' }, { status: 404 });
    }
}
