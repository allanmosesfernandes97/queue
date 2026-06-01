import { stats } from "@/lib/scratch-rung-3";

export async function GET() {
    return Response.json(stats());
}