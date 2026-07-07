import type { StorageProvider } from "./types.ts";
import { restoreProvider } from "./select-provider.ts";

let current: StorageProvider | null = null;
const listeners = new Set<() => void>();

export function getProvider(): StorageProvider | null {
    return current;
}

export function setProvider(p: StorageProvider | null): void {
    current = p;
    for (const fn of listeners) fn();
}

export function subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export async function initStorage(): Promise<StorageProvider | null> {
    const restored = await restoreProvider();
    setProvider(restored);
    return restored;
}
