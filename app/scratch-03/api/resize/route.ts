import { enqueue } from '@/lib/scratch-rung-3';
import { randomUUID } from 'node:crypto';

export async function POST(request: Request) {
    const formData = await request.formData();
    const input = formData.get('image');
    if (!(input instanceof File) || input.size === 0) {
        return Response.json({ message: 'Invalid Request' }, { status: 400 });
    }
    const buffer = Buffer.from(await input.arrayBuffer());
    const jobId = randomUUID();

    // Add to queue
    const pendingJob = { id: jobId, input: buffer };
    enqueue(pendingJob);

    return Response.json({ jobId }, { status: 202 });
}
