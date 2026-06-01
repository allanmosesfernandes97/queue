import { getJob } from "@/lib/scratch-rung-3";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const job = getJob(id);
    if (job) {
        return Response.json({ job: job });
    }
    return Response.json({ error: 'Not found' }, { status: 404 });
}