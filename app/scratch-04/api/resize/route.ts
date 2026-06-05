import { randomUUID } from 'node:crypto';
import { resizeQueue } from '@/lib/queue-scratch-04';

export async function POST(request: Request) {
    const formData = await request.formData();
    const image = formData.get('image');
    const fileName = formData.get('fileName');
    if (
        !(image instanceof File) ||
        image.size === 0 ||
        typeof fileName !== 'string' ||
        fileName.length === 0
    ) {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
    // Convert image to image buffer
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const inputBase64 = imageBuffer.toString('base64');

    // Generate id
    const jobId = randomUUID();

    const resizeJobData = { fileName, inputBase64 };

    // Send to queue
    await resizeQueue.add('resize-images', resizeJobData, {
        jobId,
        attempts: 4,
        backoff: { delay: 2000, type: 'exponential' },
        removeOnFail: 10,
        removeOnComplete: 100
    });

    return Response.json({ jobId }, { status: 202 });
}