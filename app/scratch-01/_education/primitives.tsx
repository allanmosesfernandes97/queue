import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const Concept = ({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) => (
    <Card>
        <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {title}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
    </Card>
);

export const Flow = ({ steps }: { steps: string[] }) => (
    <div className="flex flex-wrap items-center gap-2 text-sm">
        {steps.map((step, i) => (
            <span key={step} className="contents">
                <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs">{step}</span>
                {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
            </span>
        ))}
    </div>
);

export const CodeBlock = ({ code, lang }: { code: string; lang?: string }) => (
    <div className="group relative overflow-hidden rounded-lg border bg-muted/40">
        {lang && (
            <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {lang}
                </span>
            </div>
        )}
        <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed">
            <code>{code}</code>
        </pre>
    </div>
);

export const InlineCode = ({ children }: { children: React.ReactNode }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
);
