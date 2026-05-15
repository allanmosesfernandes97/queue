export async function GET() {
    const body = {
        message: 'hello baby'
    }
    return Response.json(body);
}