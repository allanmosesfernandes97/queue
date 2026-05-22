'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import {
    FlowSection,
    ClientSection,
    ServerSection,
    ByteJourneySection,
    SixLayersSection,
} from './_education/sections';

const Scratch = () => {
    const [loading, setLoading] = useState<boolean>(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        setLoading(true);
        const res = await fetch('/scratch-01/api/resize', {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'success' && data.responseDataUrl) setImageUrl(data.responseDataUrl);
        setLoading(false);
        form.reset();
    };

    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6">
            <header className="space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-mono text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-emerald-500"></span>
                    scratch-01
                </div>
                <h1>Synchronous request/response</h1>
                <button onClick={() => alert('Hello')}>TEST</button>
                <p className="text-muted-foreground">
                    Client posts a form, server does the work, response returns on the same
                    connection.
                </p>
            </header>

            <FlowSection />
            <ClientSection />
            <ServerSection />

            <Card>
                <CardHeader>
                    <CardTitle>Try it</CardTitle>
                    <CardDescription>
                        Submit and watch the network tab — the request stays open until the handler
                        returns.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <Field htmlFor="caption" label="Caption">
                            <input
                                id="caption"
                                name="caption"
                                type="text"
                                placeholder="A short caption…"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            />
                        </Field>

                        <Field htmlFor="image" label="Image">
                            <input
                                required
                                id="image"
                                name="image"
                                type="file"
                                accept="image/*"
                                className="block w-full rounded-md border border-input bg-background text-sm text-muted-foreground file:mr-3 file:border-0 file:border-r file:border-input file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
                            />
                        </Field>
                        <div className="flex justify-end pt-1">
                            <Button type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Spinner data-icon="inline-start" />
                                        Uploading...
                                    </>
                                ) : (
                                    'Upload'
                                )}
                            </Button>
                        </div>
                    </form>
                    <div>{imageUrl && <img src={imageUrl} alt="Upload" />}</div>
                </CardContent>
            </Card>

            <ByteJourneySection />
            <SixLayersSection />
        </main>
    );
};

const Field = ({
    htmlFor,
    label,
    children,
}: {
    htmlFor: string;
    label: string;
    children: React.ReactNode;
}) => (
    <div className="flex flex-col gap-1.5">
        <label htmlFor={htmlFor} className="text-sm font-medium">
            {label}
        </label>
        {children}
    </div>
);

export default Scratch;
