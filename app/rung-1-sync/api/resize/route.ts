export const runtime = "nodejs"
import sharp from 'sharp'
import { sleep } from "@/utils/lib";

export async function POST(request: Request) {
    const formData = await request.formData();
    const photo = formData.get('photo');

    if (!(photo instanceof File) || photo.size === 0) {
        return Response.json({error: 'No file'}, {status: 400});
    }

    await sleep(8 * 1000);
    const inputBytes = Buffer.from(await photo.arrayBuffer());
    console.time('image-processing');
    const outputBytes = await sharp(inputBytes)
        .resize(800, 800, { fit: 'inside' })
        .jpeg()
        .toBuffer()
    console.timeEnd('image-processing');
    return new Response(new Uint8Array(outputBytes), {
        headers: {'Content-Type': 'image/jpeg'}
    })
}