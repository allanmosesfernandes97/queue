import { Concept, Flow, CodeBlock, InlineCode } from './primitives';
import { fetchSnippet, routeSnippet, byteJourney } from './snippets';

export const FlowSection = () => (
    <Concept title="The flow">
        <Flow steps={['HTTP Client', 'Server does work', 'HTTP response']} />
    </Concept>
);

export const ClientSection = () => (
    <Concept title="Client" description="Plain fetch — await blocks until the server finishes.">
        <CodeBlock code={fetchSnippet} lang="ts" />
    </Concept>
);

export const ServerSection = () => (
    <Concept title="Server" description="Route handler reads the multipart body.">
        <CodeBlock code={routeSnippet} lang="ts" />
    </Concept>
);

export const ByteJourneySection = () => (
    <Concept
        title="The byte journey, layer by layer"
        description="What the bytes actually look like at each hop, from wire to sharp."
    >
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 px-4 py-3 font-mono text-[12px] leading-relaxed">
            <code>{byteJourney}</code>
        </pre>
    </Concept>
);

const Layer = ({
    title,
    children,
    callout,
}: {
    title: string;
    children: React.ReactNode;
    callout?: React.ReactNode;
}) => (
    <div className="space-y-2 border-l-2 border-muted pl-4">
        <h3 className="font-mono text-sm font-medium">{title}</h3>
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
        {callout && (
            <div className="rounded-md border-l-2 border-amber-400 bg-amber-50/50 px-3 py-2 text-sm dark:bg-amber-950/20">
                {callout}
            </div>
        )}
    </div>
);

const MentalModelTable = () => (
    <div className="space-y-2">
        <p className="text-sm font-medium">The mental model:</p>
        <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
                <thead className="bg-muted/60">
                    <tr>
                        <th className="px-3 py-2 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
                            Container
                        </th>
                        <th className="px-3 py-2 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
                            Where it&apos;s from
                        </th>
                        <th className="px-3 py-2 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
                            Used by
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    <tr>
                        <td className="px-3 py-2 font-mono text-xs">ArrayBuffer</td>
                        <td className="px-3 py-2 text-muted-foreground">Web standard</td>
                        <td className="px-3 py-2 text-muted-foreground">
                            File, fetch, browser APIs
                        </td>
                    </tr>
                    <tr>
                        <td className="px-3 py-2 font-mono text-xs">Buffer</td>
                        <td className="px-3 py-2 text-muted-foreground">Node native</td>
                        <td className="px-3 py-2 text-muted-foreground">
                            Most Node libraries (sharp, fs, crypto)
                        </td>
                    </tr>
                    <tr>
                        <td className="px-3 py-2 font-mono text-xs">Uint8Array</td>
                        <td className="px-3 py-2 text-muted-foreground">Web standard</td>
                        <td className="px-3 py-2 text-muted-foreground">
                            Cross-platform; bridge between the two
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
);

export const SixLayersSection = () => (
    <Concept
        title="Six layers, each doing one job"
        description="Walk through what each is for."
    >
        <div className="space-y-6">
            <Layer title="Wire bytes → FormData">
                <p>
                    The multipart format on the wire is structured but not parsed.{' '}
                    <InlineCode>request.formData()</InlineCode> decodes the multipart envelope
                    (boundaries, headers, base64 if any) and gives you a structured FormData
                    object you can read fields off by name. You&apos;d never want to touch the raw
                    multipart bytes yourself — exactly the kind of parsing the framework should
                    handle.
                </p>
            </Layer>

            <Layer
                title="FormData → File"
                callout={
                    <p>
                        This is the type subtlety:{' '}
                        <InlineCode>formData.get(name)</InlineCode> returns{' '}
                        <InlineCode>File | string | null</InlineCode>. You don&apos;t know which it
                        is until runtime. Hence the <InlineCode>instanceof File</InlineCode> check
                        you&apos;ll need to add.
                    </p>
                }
            >
                <p>
                    <InlineCode>formData.get(&apos;image&apos;)</InlineCode> returns one
                    field&apos;s value. For file uploads, that value is a File — a Web standard
                    object that wraps binary data plus metadata (name, size, MIME type,
                    last-modified). For text fields, you&apos;d get a string. Same{' '}
                    <InlineCode>.get()</InlineCode> API, different return type depending on what
                    the client uploaded.
                </p>
            </Layer>

            <Layer title="File → ArrayBuffer">
                <p>
                    A File is a handle to the bytes, not the bytes themselves. The bytes might be
                    sitting in a stream, in memory, or on disk depending on size and platform.{' '}
                    <InlineCode>await file.arrayBuffer()</InlineCode> says &ldquo;drain
                    whatever&apos;s behind this File into one contiguous block of bytes in
                    memory.&rdquo; You get an ArrayBuffer — the Web standard binary container.
                </p>
                <p>
                    The <InlineCode>await</InlineCode> is because reading might be async (e.g.,
                    from a slow source). For in-memory uploads it resolves immediately.
                </p>
            </Layer>

            <Layer title="ArrayBuffer → Buffer (Node's flavor)">
                <p>
                    Here&apos;s the awkward bit: Node has its own binary type called Buffer that
                    predates the Web standard ArrayBuffer. They both represent bytes, but they
                    have different APIs. Most Node libraries (including sharp) expect Buffer, the
                    Node native flavor.
                </p>
                <p>
                    <InlineCode>Buffer.from(arrayBuffer)</InlineCode> is the conversion. It&apos;s
                    cheap — usually a wrapper around the same underlying bytes, not a copy.
                </p>
                <p>
                    Why do both exist? Historical accident. Node existed before browsers had
                    ArrayBuffer. By the time the Web caught up, Node had years of Buffer code. Now
                    they coexist; Buffer is a Uint8Array (a view on an ArrayBuffer), so the
                    conversion is basically free.
                </p>
            </Layer>

            <MentalModelTable />

            <Layer title="Buffer → sharp">
                <p>
                    Sharp&apos;s API accepts a Buffer of bytes (or a file path, or a stream). You
                    pass the Buffer; sharp parses the image format internally (sniffs PNG/JPEG/WebP
                    from the magic bytes), gives you a fluent API to manipulate, and produces
                    output bytes when you call <InlineCode>.toBuffer()</InlineCode>.
                </p>
            </Layer>
        </div>
    </Concept>
);
