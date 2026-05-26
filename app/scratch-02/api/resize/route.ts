export const runtime = 'nodejs';
import { createJob, setDone, updateProgress, setFailed } from '@/lib/scratch-rung-2';
import { sleep } from '@/utils/lib';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

export async function POST(request: Request) {
    const form = await request.formData();
    const file = form.get('image');
    if (!(file instanceof File) || file.size === 0) {
        return Response.json({ message: 'Invalid request' }, { status: 400 });
    }
    const jobId = randomUUID();
    // Create Job
    createJob(jobId);
    // Input Buffer
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    void imageProcessing(jobId, inputBuffer);
    return Response.json({ jobId }, { status: 202 });
}

const imageProcessing = async (id: string, imageBuffer: Buffer) => {
    try {
        // Fake progress
        for (let p = 10; p < 90; p += 10) {
            await sleep(800);
            updateProgress(id, p);
        }
        // image gen
        const sharpImage = await sharp(imageBuffer)
            .resize(1024, 1024, { fit: 'contain' })
            .png()
            .toBuffer();
        const resultDataUrl: string = `data:image/jpeg;base64,${sharpImage.toString('base64')}`;
        setDone(id, resultDataUrl);
    } catch (error) {
        setFailed(
            id,
            error instanceof Error && error.message ? error.message : 'Something went wrong'
        );
    }
};
