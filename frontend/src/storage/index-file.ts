import type { TabMeta } from "./types.ts";
import { stripExt } from "./paths.ts";

export const INDEX_VERSION = 1;

export interface IndexData {
    version: number;
    tabs: Record<string, TabMeta>;
}

export function defaultMeta(name: string): TabMeta {
    return {
        title: stripExt(name),
        artist: "",
        favorite: false,
        viewMode: "tab",
        noteColorOn: false,
        youtube: [],
        audio: [],
    };
}

export function parseIndex(text: string | null): IndexData {
    if (!text) {
        return { version: INDEX_VERSION, tabs: {} };
    }
    try {
        const data = JSON.parse(text);
        const tabs = (data && typeof data === "object" && data.tabs && typeof data.tabs === "object") ? data.tabs : {};
        return { version: INDEX_VERSION, tabs };
    } catch {
        return { version: INDEX_VERSION, tabs: {} };
    }
}

export function serializeIndex(data: IndexData): string {
    return JSON.stringify({ version: INDEX_VERSION, tabs: data.tabs }, null, 2);
}

/** Adopt new disk files with default meta; drop entries whose file no longer exists. */
export function reconcile(index: IndexData, diskTabPaths: string[]): IndexData {
    const tabs: Record<string, TabMeta> = {};
    for (const path of diskTabPaths) {
        tabs[path] = index.tabs[path] ?? defaultMeta(path.split("/").pop() ?? path);
    }
    return { version: INDEX_VERSION, tabs };
}
