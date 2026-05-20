import { createJob, setDone, setFailed, updateProgress } from '@/lib/store-rung-2';
import { sleep } from '@/utils/lib';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

export async function POST(request: Request) {
    const formData = await request.formData();
    const photo = formData.get('photo');

    if (!(photo instanceof File) || photo.size === 0) {
        return Response.json({ error: 'No file' }, { status: 400 });
    }

    const inputBytes = Buffer.from(await photo.arrayBuffer());

    // Generate a UUID
    const id = randomUUID();
    // Create job
    createJob(id);
    // STUB: Do work
    void doWork(id, inputBytes);

    return Response.json({ jobId: id }, { status: 202 });
}

async function doWork(id: string, inputBytes: Buffer) {
    try {
        // 1. Fake some progress
        for (let p = 10; p < 90; p += 10) {
            await sleep(800); //800 ms
            updateProgress(id, p);
        }

        // 2. Actually do the work
        const outputBytes = await sharp(inputBytes)
            .resize(800, 800, { fit: 'inside' })
            .jpeg()
            .toBuffer();

        // 3. Encode
        const resultDataUrl = `data:image/jpeg;base64,${outputBytes.toString('base64')}`;
        setDone(id, resultDataUrl);
    } catch (err) {
        setFailed(id, err instanceof Error ? err.message : String(err));
    }
}
