'use client';

import { JobResponse } from '@/lib/rung-04-types';
import { useEffect, useState } from 'react';

export default function Rung03() {
    const [jobId, setJobId] = useState<string | null>(null);
    const [job, setJob] = useState<JobResponse | null>(null);
    const [pasteId, setPasteId] = useState<string | null>(null);

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        const res = await fetch('/rung-04/api', {
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
        if (job?.state === 'completed' || job?.error) return;
        const tick = async () => {
            const res = await fetch(`/rung-04/api/job/${jobId}`);
            if (!res.ok) return;
            const next: JobResponse = await res.json();
            setJob(next);
        };

        tick();
        const id = setInterval(() => tick(), 1000);
        return () => clearInterval(id);
    }, [jobId, job?.state]);

    // useEffect(() => {
    //     const fetchStats = async () => {
    //         const res = await fetch('/rung-03/api/stats');
    //         if (!res.ok) return;
    //         const data = await res.json();
    //         setStats(data);
    //     };
    //     fetchStats();
    //     const interval = setInterval(() => fetchStats(), 500);
    //     return () => clearInterval(interval);
    // }, []);

    return (
        <section className="rung-02">
            <h2>Rung 04</h2>
            <form onSubmit={handleSubmit} className="rung-02-form">
                <input type="text" placeholder="Enter file name" name="fileName" />
                <input type="file" placeholder="Select file" accept="image/*" name="image" />
                <button type="submit">SUBMIT</button>
            </form>
            {jobId && job?.state !== 'completed' && (
                <progress id="file" max="100" value={job?.progress ?? 0}>
                    {job?.progress ?? 0} %
                </progress>
            )}
            {job?.state === 'completed' && <img src={job.result} alt="Processing" />}
        </section>
    );
}
