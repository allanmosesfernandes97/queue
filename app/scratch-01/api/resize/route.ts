export const runtime = 'nodejs';
import sharp from 'sharp';

const sleep = (ms: number = 1000): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
    const formData = await request.formData();
    const image = formData.get('image');
    const caption = formData.get('caption');

    if (!(image instanceof File) || image.size === 0) {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Input Buffer
    const inputBuffer = Buffer.from(await image.arrayBuffer());

    try {
        // Process image using sharp
        const outputBytes = await sharp(inputBuffer)
            .resize(1024, 1024, { fit: 'contain' })
            .png()
            .toBuffer();
        await sleep(8 * 1000); // FAKE delay
        const responseDataUrl: string = `data:image/jpeg;base64,${outputBytes.toString('base64')}`;
        return Response.json({ status: 'success', responseDataUrl });
    } catch (error) {
        return Response.json({ error: error instanceof Error && error.message });
    }

    // const dataURL = `data:url`
}
