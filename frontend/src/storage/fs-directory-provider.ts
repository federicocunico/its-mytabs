import type { FolderEntry, ProviderCapabilities, StorageProvider, TabEntry, TabMeta } from "./types.ts";
import { basename, extname, isScoreFile, joinPath, normalizeRelPath, parentPath } from "./paths.ts";
import { defaultMeta, INDEX_VERSION, type IndexData, parseIndex, reconcile, serializeIndex } from "./index-file.ts";

export const META_DIR = ".mytabs";
export const INDEX_PATH = ".mytabs/index.json";

export class FsDirectoryProvider implements StorageProvider {
    constructor(private root: FileSystemDirectoryHandle, public readonly capabilities: ProviderCapabilities) {}

    // --- directory / file handle traversal ---

    private async getDirHandle(path: string, create = false): Promise<FileSystemDirectoryHandle> {
        const p = normalizeRelPath(path);
        let dir = this.root;
        if (!p) return dir;
        for (const seg of p.split("/")) {
            dir = await dir.getDirectoryHandle(seg, { create });
        }
        return dir;
    }

    private async getFileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
        const parent = await this.getDirHandle(parentPath(path), create);
        return parent.getFileHandle(basename(path), { create });
    }

    // --- .mytabs/index.json ---

    private async loadIndex(): Promise<IndexData> {
        try {
            const fh = await this.getFileHandle(INDEX_PATH, false);
            return parseIndex(await (await fh.getFile()).text());
        } catch {
            return { version: INDEX_VERSION, tabs: {} };
        }
    }

    private async saveIndex(data: IndexData): Promise<void> {
        const dir = await this.root.getDirectoryHandle(META_DIR, { create: true });
        const fh = await dir.getFileHandle("index.json", { create: true });
        const w = await fh.createWritable();
        await w.write(serializeIndex(data));
        await w.close();
    }

    // --- reads ---

    async listFolder(path: string): Promise<{ folders: FolderEntry[]; tabs: TabEntry[] }> {
        const dir = await this.getDirHandle(path, false);
        const folders: FolderEntry[] = [];
        const tabPaths: string[] = [];
        for await (const [name, handle] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
            if (handle.kind === "directory") {
                if (name === META_DIR) continue;
                folders.push({ name, path: joinPath(path, name) });
            } else if (isScoreFile(name)) {
                tabPaths.push(joinPath(path, name));
            }
        }
        const index = await this.loadIndex();
        const tabs: TabEntry[] = tabPaths.map((p) => {
            const meta = index.tabs[p] ?? defaultMeta(basename(p));
            return { name: basename(p), path: p, title: meta.title ?? basename(p), artist: meta.artist ?? "", favorite: meta.favorite, ext: extname(p) };
        });
        folders.sort((a, b) => a.name.localeCompare(b.name));
        tabs.sort((a, b) => a.title.localeCompare(b.title));
        return { folders, tabs };
    }

    async readTab(path: string): Promise<{ bytes: Uint8Array; meta: TabMeta }> {
        const fh = await this.getFileHandle(path, false);
        const bytes = new Uint8Array(await (await fh.getFile()).arrayBuffer());
        return { bytes, meta: await this.readMeta(path) };
    }

    async readMeta(path: string): Promise<TabMeta> {
        const index = await this.loadIndex();
        return index.tabs[normalizeRelPath(path)] ?? defaultMeta(basename(path));
    }

    async writeMeta(path: string, patch: Partial<TabMeta>): Promise<void> {
        const p = normalizeRelPath(path);
        const index = await this.loadIndex();
        index.tabs[p] = { ...(index.tabs[p] ?? defaultMeta(basename(p))), ...patch };
        await this.saveIndex(index);
    }

    // --- writes (implemented in Task 5) ---

    async writeTab(_path: string, _bytes: Uint8Array): Promise<void> {
        throw new Error("not implemented");
    }
    async createFolder(_path: string): Promise<void> {
        throw new Error("not implemented");
    }
    async rename(_path: string, _newName: string): Promise<string> {
        throw new Error("not implemented");
    }
    async move(_fromPath: string, _toFolder: string): Promise<string> {
        throw new Error("not implemented");
    }
    async remove(_path: string): Promise<void> {
        throw new Error("not implemented");
    }
}
