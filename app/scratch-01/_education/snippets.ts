export const fetchSnippet = `const res = await fetch('/scratch-01/api/resize', {
    method: 'POST',
    body: formData,
});`;

export const routeSnippet = `export async function POST(request: Request) {
    const formData = await request.formData();
    console.log(formData);
}`;

export const byteJourney = `[ browser sends multipart/form-data over HTTP ]
                  │
                  ▼  bytes on the wire (just numbers, no structure)
                  │
[ Node's HTTP server reads the bytes into memory ]
                  │
                  ▼
   request.formData()                  ← parses multipart envelope
                  │
                  ▼  FormData (key/value collection of fields)
                  │
   formData.get('image')                ← extracts one field
                  │
                  ▼  File (Web standard binary blob with metadata)
                  │
   await imageFile.arrayBuffer()        ← drains the File into an ArrayBuffer
                  │
                  ▼  ArrayBuffer (raw bytes, Web standard binary container)
                  │
   Buffer.from(arrayBuffer)             ← wraps as Node's Buffer
                  │
                  ▼  Buffer (Node's binary container; subclass of Uint8Array)
                  │
   sharp(buffer)                        ← sharp consumes the bytes`;
