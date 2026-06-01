import { queue } from '@/lib/bullmq-queue';
import { randomUUID } from 'node:crypto';

export async function POST(req: Request) {
    // Producer
    const formData = await req.formData();
    const imageFile = formData.get('image');
    const fileName = formData.get('fileName');

    if (
        !(imageFile instanceof File) ||
        imageFile.size === 0 ||
        typeof fileName !== 'string' ||
        fileName.length === 0
    ) {
        return Response.json({ message: 'Invalid request' }, { status: 400 });
    }
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const base64 = imageBuffer.toString('base64');
    const jobId = randomUUID();

    // Add to queue
    await queue.add(
        'resize',
        { fileName, base64 },
        { jobId, attempts: 3, backoff: { type: 'exponential', delay: 1000 } } // opts ← id here
    );

    return Response.json({ jobId: jobId }, { status: 202 });
}
