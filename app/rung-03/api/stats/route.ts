import { stats } from "@/lib/queue-rung-3";

export async function GET() {
    return Response.json(stats())
}