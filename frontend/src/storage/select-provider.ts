import { FsDirectoryProvider } from "./fs-directory-provider.ts";
import { clearRootHandle, loadRootHandle, saveRootHandle } from "./handle-store.ts";

export function supportsFileSystemAccess(): boolean {
    return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// Remembers whether the user last chose a disk folder ("fsa") or browser
// storage ("opfs"), so the choice survives reloads. FSA handles persist in
// IndexedDB; the OPFS choice has no handle, hence this flag.
const MODE_KEY = "tabcraft-storage-mode";

function setStorageMode(mode: "fsa" | "opfs"): void {
    try {
        localStorage.setItem(MODE_KEY, mode);
    } catch {
        // Non-persistent contexts still work for the session.
    }
}

function getStorageMode(): string | null {
    try {
        return localStorage.getItem(MODE_KEY);
    } catch {
        return null;
    }
}

export function providerFromHandle(
    handle: FileSystemDirectoryHandle,
    canBrowseDisk: boolean,
): FsDirectoryProvider {
    return new FsDirectoryProvider(handle, {
        canBrowseDisk,
        persistent: true,
        rootLabel: canBrowseDisk ? handle.name : "Browser storage",
    });
}

export async function pickLocalFolder(): Promise<FsDirectoryProvider> {
    const handle = await (
        window as unknown as {
            showDirectoryPicker(opts?: unknown): Promise<FileSystemDirectoryHandle>;
        }
    ).showDirectoryPicker({ mode: "readwrite", id: "mytabs-root" });
    await saveRootHandle(handle);
    setStorageMode("fsa");
    return providerFromHandle(handle, true);
}

export async function openOpfs(): Promise<FsDirectoryProvider> {
    const root = await navigator.storage.getDirectory();
    setStorageMode("opfs");
    return providerFromHandle(root, false);
}

async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    const h = handle as unknown as {
        queryPermission(o: { mode: string }): Promise<PermissionState>;
        requestPermission(o: { mode: string }): Promise<PermissionState>;
    };
    if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return true;
    return (await h.requestPermission({ mode: "readwrite" })) === "granted";
}

/**
 * Restore a previously-picked local folder if the handle is still authorized.
 * Query-only: without a user gesture the browser can't grant permission, so we
 * must not treat "not granted yet" as a reason to wipe the saved handle. Only a
 * definitively dead/removed handle clears persistence.
 */
export async function restoreProvider(): Promise<FsDirectoryProvider | null> {
    if (getStorageMode() === "opfs") {
        try {
            return await openOpfs();
        } catch {
            return null;
        }
    }
    if (!supportsFileSystemAccess()) return null;
    const handle = await loadRootHandle();
    if (!handle) return null;
    try {
        const perm = await (handle as unknown as { queryPermission(o: { mode: string }): Promise<PermissionState> })
            .queryPermission({ mode: "readwrite" });
        if (perm === "granted") return providerFromHandle(handle, true);
        return null; // not granted yet — keep the handle for a gesture-based reconnect
    } catch (e) {
        // Only a dead/removed handle should clear persistence.
        if (e && (e as { name?: string }).name === "NotFoundError") {
            await clearRootHandle();
        }
        return null;
    }
}

/** Gesture-based reconnect: call from a click handler (e.g. a "Reconnect" button) to request permission. */
export async function reconnectProvider(): Promise<FsDirectoryProvider | null> {
    if (!supportsFileSystemAccess()) return null;
    const handle = await loadRootHandle();
    if (!handle) return null;
    try {
        if (await ensurePermission(handle)) return providerFromHandle(handle, true);
    } catch (e) {
        if (e && (e as { name?: string }).name === "NotFoundError") await clearRootHandle();
    }
    return null;
}
