import { getJob } from '@/lib/store-rung-2';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const job = getJob(id);
    if (!job) {
        return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json(job);
}