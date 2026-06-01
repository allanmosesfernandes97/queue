import { Worker, type Job } from 'bullmq';
import { __redis } from '@/lib/redis';
import type { ResizeJobData } from '@/lib/bullmq-queue';
import sharp from 'sharp';
import { sleep } from '@/utils/lib';

// Worker - Consumer - This is what connects the imageProcessing to the queue
const worker = new Worker<ResizeJobData>('rung-4-resize', imageProcessing, {
    connection: __redis,
    concurrency: Number(process.env.RUNG4_CONCURRENCY ?? 3),
});

// Actual image processing
async function imageProcessing(job: Job<ResizeJobData>) {
    // Convert base64 string back to buffer
    if (!job.data.base64 || !job.data.fileName) throw new Error('Something went wrong');
    const imageBuffer = Buffer.from(job.data.base64, 'base64');
    // Fake delay
    for (let p = 10; p <= 90; p += 10) {
        await sleep(900);
        await job.updateProgress(p);
    }
    const resizedImageBuffer = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: 'contain' })
        .png()
        .toBuffer();

    const resultDataUrl = `data:image/png;base64,${resizedImageBuffer.toString('base64')}`;

    return resultDataUrl;
}

// ── observability: watch the work happen ──
worker.on('ready', () => console.log('worker ready'));
worker.on('completed', (job) => console.log('✓ done', job.id));
worker.on('failed', (job, err) => console.log('✗ failed', job?.id, err?.message));

// ── graceful shutdown on stop signals ──
process.on('SIGINT', () => worker.close());
process.on('SIGTERM', () => worker.close());
