import { FsDirectoryProvider } from "./fs-directory-provider.ts";
import { clearRootHandle, loadRootHandle, saveRootHandle } from "./handle-store.ts";

export function supportsFileSystemAccess(): boolean {
    return typeof window !== "undefined" && "showDirectoryPicker" in window;
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
    return providerFromHandle(handle, true);
}

export async function openOpfs(): Promise<FsDirectoryProvider> {
    const root = await navigator.storage.getDirectory();
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

/** Restore a previously-picked local folder if the handle is still authorized. */
export async function restoreProvider(): Promise<FsDirectoryProvider | null> {
    if (!supportsFileSystemAccess()) return null;
    const handle = await loadRootHandle();
    if (!handle) return null;
    try {
        if (await ensurePermission(handle)) return providerFromHandle(handle, true);
    } catch {
        // fall through
    }
    await clearRootHandle();
    return null;
}
