const DB_NAME = "mytabs-handles";
const STORE = "handles";
const KEY = "root";

function idb(): IDBFactory | null {
    return typeof indexedDB !== "undefined" ? indexedDB : null;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const factory = idb();
        if (!factory) {
            reject(new Error("no indexedDB"));
            return;
        }
        const req = factory.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function tx<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
    if (!idb()) return null;
    try {
        const db = await openDb();
        return await new Promise<T | null>((resolve, reject) => {
            const store = db.transaction(STORE, mode).objectStore(STORE);
            const req = fn(store);
            req.onsuccess = () => resolve(req.result as T);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

export async function saveRootHandle(
    handle: FileSystemDirectoryHandle,
): Promise<void> {
    await tx("readwrite", (store) => store.put(handle, KEY));
}

export async function loadRootHandle(): Promise<FileSystemDirectoryHandle | null> {
    return (await tx<FileSystemDirectoryHandle>("readonly", (store) => store.get(KEY))) ?? null;
}

export async function clearRootHandle(): Promise<void> {
    await tx("readwrite", (store) => store.delete(KEY));
}
