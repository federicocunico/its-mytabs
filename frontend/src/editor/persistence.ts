/**
 * Client-side persistence glue: download the exported .gp locally or POST it
 * to the server. Kept free of app.js imports so the engine layer stays
 * testable headless — the caller passes baseURL.
 */

export function downloadGp(bytes: Uint8Array, filename: string): void {
    const a = document.createElement("a");
    a.download = filename.endsWith(".gp") ? filename : `${filename}.gp`;
    a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

export async function saveScoreToServer(baseURL: string, tabID: number | string, bytes: Uint8Array): Promise<void> {
    const formData = new FormData();
    formData.append("file", new File([bytes as BlobPart], "tab.gp", { type: "application/octet-stream" }));

    const res = await fetch(baseURL + `/api/tab/${tabID}/save-score`, {
        method: "POST",
        credentials: "include",
        body: formData,
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.msg || `Save failed (HTTP ${res.status})`);
    }
}
