'use client';

import type { JobState } from '@/lib/store-rung-2';
import { useEffect, useState } from 'react';

export default function Rung02() {
    const [jobId, setJobId] = useState<string | null>(null);
    const [job, setJob] = useState<JobState | null>(null);
    const [pasteId, setPasteId] = useState<string | null>(null);
    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);

        const res = await fetch('/rung-02/api/jobs', {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) return;
        const data = await res.json();
        const { jobId } = data;
        setJobId(jobId);
        console.log('THE ID FOR THE JOB IS', jobId);
    };

    useEffect(() => {
        if (!jobId) return;
        if (job?.status === 'done' || job?.status === 'failed') return;
        const tick = async () => {
            const res = await fetch(`/rung-02/api/jobs/${jobId}`);
            if (!res.ok) return;
            const next: JobState = await res.json();
            setJob(next);
        };

        tick();
        const id = setInterval(() => tick(), 1000);
        return () => clearInterval(id);
    }, [jobId, job?.status]);

    return (
        <section className="rung-02">
            <h2>Rung 02</h2>
            <form onSubmit={handleSubmit} className="rung-02-form">
                <input type="text" placeholder="Enter file name" name="name" />
                <input type="file" placeholder="Select file" accept="image/*" name="photo" />
                <button type="submit">SUBMIT</button>
            </form>
            {jobId && (job?.status !== 'done') && (
                <progress id="file" max="100" value={job?.progress ?? 0}>
                    { job?.progress ?? 0} %
                </progress>
            )}
            {job?.status === 'done' && (
                <img src={job.resultDataUrl} alt='Processing' />
            )}
            <div>
                <h2>Existing Jobs</h2>
                <input type='text' placeholder='Enter job id' onChange={(e) => setPasteId(e.target.value)} />
                <button onClick={() => setJobId(pasteId)}>Watch this job </button>
            </div>
        </section>
    );
}
