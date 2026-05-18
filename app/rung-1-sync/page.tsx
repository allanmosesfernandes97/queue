'use client'
import { use, useEffect, useState } from "react";

export default function Rung1SyncPage() {

    const [url, setFileURL] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [elapsedTime, setElapsedTime] = useState<number>(0);

    const formSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        setIsLoading(true);
        setElapsedTime(0);

        try {
            const res = await fetch('/rung-1-sync/api/resize', {
                method: "POST",
                body: formData,
            })
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                setFileURL(url);
            }
            form.reset();
        } catch (err) {
            console.error(err)
        }
        setIsLoading(false);
    }

    useEffect(() => {
        if (!isLoading) return;
        const id = setInterval(() => {
            setElapsedTime(prev => prev + 1)
        }, 1000)

        return () => clearInterval(id);
    }, [isLoading])

    return (
        <div style={{backgroundColor: 'white', color: 'black'}}>
            <h2>Rung 01</h2>
            <form className="form" onSubmit={formSubmit}>
                <input type='text' name='caption' placeholder="Enter caption"/>
                <input type='file' name='photo' />
                <button type="submit">Send</button>
            </form>
            <h2>Elapsed time since upload { elapsedTime } seconds</h2>
            <h2>File Details</h2>
            {isLoading && <span className="loader"></span>}
            {url && <img src={url} alt='Rendered blob' />}
        </div>
    )
}