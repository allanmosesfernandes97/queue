import { enqueue } from '@/lib/queue-rung-3';
import { randomUUID } from 'node:crypto';
export const runtime = 'nodejs';

export async function POST(request: Request) {
    const formData = await request.formData();
    const photo = formData.get('photo');
    if (!(photo instanceof File) || photo.size === 0) {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Generate a UUID
    const id = randomUUID();
    const inputBuffer = Buffer.from(await photo.arrayBuffer());

    // Enqueue
    enqueue(id, inputBuffer);

    return Response.json({ jobId: id }, { status: 202 });
}