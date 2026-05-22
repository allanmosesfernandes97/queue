import { getJob } from "@/lib/scratch-rung-2";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!id) return Response.json({ message: 'Invalid request' }, { status: 400 });
    const job = getJob(id);
    if (!job) return Response.json({ message: 'Not found' }, { status: 400 });
    return Response.json(job);
}
