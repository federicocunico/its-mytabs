# Local-Folder Storage — Foundation (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-side `StorageProvider` abstraction so tabs live in a user-chosen local folder (File System Access API) with an OPFS fallback, wire the editor to load/save through it, and ship
a static Vercel build — no server required.

**Architecture:** A framework-free storage layer under `frontend/src/storage/`. One provider class works over any `FileSystemDirectoryHandle` (real disk folder via `showDirectoryPicker`, or OPFS
root). Per-tab metadata lives in a single `.mytabs/index.json`, reconciled with the real files on disk at listing time. The editor loads score bytes via the provider (`api.load(bytes)`) and saves via
`provider.writeTab`. A build flag selects the default provider (local for the static/Vercel build, server for self-host).

**Tech Stack:** Vue 3 (options API, existing), TypeScript, Vite, Deno tasks, Vitest + happy-dom, alphaTab 1.8.0, File System Access API, OPFS, IndexedDB.

## Global Constraints

- Frontend lives in `frontend/`; run frontend tests with `cd frontend && deno run -A npm:vitest run` (or `deno task test-frontend` from repo root).
- Vitest include globs are `src/*.test.ts`, `src/editor/**/*.test.ts`, `src/playback/**/*.test.ts` (`frontend/vitest.config.ts`); storage tests go under `src/storage/**` — this plan adds
  `src/storage/**/*.test.ts` to the include list in Task 1.
- Formatting: `deno fmt` with indentWidth 4, double quotes, semicolons, lineWidth 200 (`deno.jsonc`). Run `deno fmt` on changed files before each commit.
- Score file extensions come from `supportedFormatList` in `backend/common.ts`: `gp, gpx, gp3, gp4, gp5, musicxml, capx`. Do not hardcode a second copy — import it.
- The abstraction must not reference any concrete backend; the editor talks only to the `StorageProvider` interface.
- Provider methods use POSIX-style relative paths within the root (e.g. `Rock/Sweet Child.gp`), never absolute or OS paths.
- Never delete or overwrite a user's original score file on save (see Task 9).
- Commit after each task with a `feat:`/`test:`/`chore:` message.

---

### Task 1: Storage types + path utilities

**Files:**

- Create: `frontend/src/storage/types.ts`
- Create: `frontend/src/storage/paths.ts`
- Create: `frontend/src/storage/paths.test.ts`
- Modify: `frontend/vitest.config.ts` (add `src/storage/**/*.test.ts` to `include`)

**Interfaces:**

- Produces: the `StorageProvider`, `TabMeta`, `YoutubeSync`, `AudioSync`, `FolderEntry`, `TabEntry`, `ProviderCapabilities` types; and path helpers `joinPath`, `parentPath`, `basename`, `extname`,
  `stripExt`, `isScoreFile`, `normalizeRelPath`.

- [ ] **Step 1: Add storage tests to the vitest include list**

In `frontend/vitest.config.ts`, change the `include` array to:

```ts
include: ["src/*.test.ts", "src/storage/**/*.test.ts", "src/editor/**/*.test.ts", "src/playback/**/*.test.ts"],
```

- [ ] **Step 2: Write `frontend/src/storage/types.ts`**

```ts
/** The editor's three visualization modes (mirrors alphatab-shared ViewMode). */
export type ViewMode = "tab" | "score" | "score-tab";

export interface YoutubeSync {
    videoID: string;
    syncMethod: "simple" | "advanced";
    simpleSync: number;
    advancedSync: string;
}

export interface AudioSync {
    filename: string;
    syncMethod: "simple" | "advanced";
    simpleSync: number;
    advancedSync: string;
}

/** Per-tab metadata persisted in .mytabs/index.json, keyed by the tab's relative path. */
export interface TabMeta {
    title?: string;
    artist?: string;
    favorite: boolean;
    viewMode: ViewMode;
    noteColorOn: boolean;
    youtube: YoutubeSync[];
    audio: AudioSync[];
}

export interface FolderEntry {
    /** Folder name (last path segment). */
    name: string;
    /** Relative path within the root. */
    path: string;
}

export interface TabEntry {
    /** File name including extension. */
    name: string;
    /** Relative path within the root. */
    path: string;
    title: string;
    artist: string;
    favorite: boolean;
    /** Lower-case extension without the dot, e.g. "gp". */
    ext: string;
}

export interface ProviderCapabilities {
    /** True when backed by a real user-visible disk folder (FSA), false for OPFS. */
    canBrowseDisk: boolean;
    /** True when the root survives reloads without re-picking. */
    persistent: boolean;
    /** Human label for the root, e.g. the folder name or "Browser storage". */
    rootLabel: string;
}

export interface StorageProvider {
    readonly capabilities: ProviderCapabilities;
    listFolder(path: string): Promise<{ folders: FolderEntry[]; tabs: TabEntry[] }>;
    readTab(path: string): Promise<{ bytes: Uint8Array; meta: TabMeta }>;
    writeTab(path: string, bytes: Uint8Array): Promise<void>;
    createFolder(path: string): Promise<void>;
    rename(path: string, newName: string): Promise<string>;
    move(fromPath: string, toFolder: string): Promise<string>;
    remove(path: string): Promise<void>;
    readMeta(path: string): Promise<TabMeta>;
    writeMeta(path: string, meta: Partial<TabMeta>): Promise<void>;
}
```

- [ ] **Step 3: Write the failing test `frontend/src/storage/paths.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { basename, extname, isScoreFile, joinPath, normalizeRelPath, parentPath, stripExt } from "./paths.ts";

describe("paths", () => {
    it("joins segments, treating '' as the root", () => {
        expect(joinPath("", "Rock")).toBe("Rock");
        expect(joinPath("Rock", "Song.gp")).toBe("Rock/Song.gp");
    });
    it("returns the parent path (root is '')", () => {
        expect(parentPath("Rock/Song.gp")).toBe("Rock");
        expect(parentPath("Song.gp")).toBe("");
        expect(parentPath("")).toBe("");
    });
    it("returns the basename", () => {
        expect(basename("Rock/Song.gp")).toBe("Song.gp");
        expect(basename("Song.gp")).toBe("Song.gp");
    });
    it("returns the lower-case extension without a dot", () => {
        expect(extname("Song.GP5")).toBe("gp5");
        expect(extname("Song")).toBe("");
    });
    it("strips the extension from a name", () => {
        expect(stripExt("Song.gp5")).toBe("Song");
        expect(stripExt("Song")).toBe("Song");
    });
    it("recognises supported score files only", () => {
        expect(isScoreFile("Song.gp")).toBe(true);
        expect(isScoreFile("Song.gp5")).toBe(true);
        expect(isScoreFile("Song.musicxml")).toBe(true);
        expect(isScoreFile("notes.txt")).toBe(false);
        expect(isScoreFile("config.json")).toBe(false);
    });
    it("normalises separators and trims slashes", () => {
        expect(normalizeRelPath("/Rock/Song.gp/")).toBe("Rock/Song.gp");
        expect(normalizeRelPath("Rock\\Song.gp")).toBe("Rock/Song.gp");
    });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd frontend && deno run -A npm:vitest run src/storage/paths.test.ts` Expected: FAIL (cannot resolve `./paths.ts`).

- [ ] **Step 5: Write `frontend/src/storage/paths.ts`**

```ts
import { supportedFormatList } from "../../../backend/common.ts";

const SCORE_EXTS = new Set(supportedFormatList.map((e) => e.toLowerCase()));

export function normalizeRelPath(path: string): string {
    return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function joinPath(dir: string, name: string): string {
    const d = normalizeRelPath(dir);
    return d ? `${d}/${name}` : name;
}

export function parentPath(path: string): string {
    const p = normalizeRelPath(path);
    const i = p.lastIndexOf("/");
    return i < 0 ? "" : p.slice(0, i);
}

export function basename(path: string): string {
    const p = normalizeRelPath(path);
    const i = p.lastIndexOf("/");
    return i < 0 ? p : p.slice(i + 1);
}

export function extname(name: string): string {
    const i = name.lastIndexOf(".");
    return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function stripExt(name: string): string {
    const i = name.lastIndexOf(".");
    return i < 0 ? name : name.slice(0, i);
}

export function isScoreFile(name: string): boolean {
    return SCORE_EXTS.has(extname(name));
}
```

Note: confirm `supportedFormatList` is exported from `backend/common.ts` (grep it). If it is a differently-named const, import that name instead — do not duplicate the list.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && deno run -A npm:vitest run src/storage/paths.test.ts` Expected: PASS (6 tests).

- [ ] **Step 7: Format and commit**

```bash
cd frontend && deno fmt src/storage/types.ts src/storage/paths.ts src/storage/paths.test.ts vitest.config.ts
cd .. && git add frontend/src/storage/types.ts frontend/src/storage/paths.ts frontend/src/storage/paths.test.ts frontend/vitest.config.ts
git commit -m "feat(storage): add StorageProvider types and path utilities"
```

---

### Task 2: `.mytabs/index.json` model + reconciliation

**Files:**

- Create: `frontend/src/storage/index-file.ts`
- Create: `frontend/src/storage/index-file.test.ts`

**Interfaces:**

- Consumes: `TabMeta`, `TabEntry` (Task 1).
- Produces: `INDEX_VERSION`, `type IndexData = { version: number; tabs: Record<string, TabMeta> }`, `defaultMeta(name: string): TabMeta`, `parseIndex(text: string | null): IndexData`,
  `serializeIndex(data: IndexData): string`, `reconcile(index: IndexData, diskTabPaths: string[]): IndexData` (adds default meta for new paths, drops paths not on disk, returns a new object).

- [ ] **Step 1: Write the failing test `frontend/src/storage/index-file.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { defaultMeta, parseIndex, reconcile, serializeIndex } from "./index-file.ts";

describe("index-file", () => {
    it("defaultMeta derives a title from the file name and sets safe defaults", () => {
        const m = defaultMeta("Sweet Child.gp");
        expect(m.title).toBe("Sweet Child");
        expect(m.favorite).toBe(false);
        expect(m.viewMode).toBe("tab");
        expect(m.noteColorOn).toBe(false);
        expect(m.youtube).toEqual([]);
        expect(m.audio).toEqual([]);
    });

    it("parseIndex returns an empty index for null or malformed input", () => {
        expect(parseIndex(null).tabs).toEqual({});
        expect(parseIndex("not json").tabs).toEqual({});
        expect(parseIndex('{"version":1,"tabs":{}}').tabs).toEqual({});
    });

    it("round-trips through serialize/parse", () => {
        const data = { version: 1, tabs: { "a.gp": defaultMeta("a.gp") } };
        expect(parseIndex(serializeIndex(data)).tabs["a.gp"].title).toBe("a");
    });

    it("reconcile adopts new disk files and drops missing entries", () => {
        const index = { version: 1, tabs: { "old.gp": defaultMeta("old.gp") } };
        const result = reconcile(index, ["new.gp"]);
        expect(Object.keys(result.tabs)).toEqual(["new.gp"]);
        expect(result.tabs["new.gp"].title).toBe("new");
    });

    it("reconcile preserves metadata for files still present", () => {
        const meta = { ...defaultMeta("keep.gp"), favorite: true };
        const result = reconcile({ version: 1, tabs: { "keep.gp": meta } }, ["keep.gp"]);
        expect(result.tabs["keep.gp"].favorite).toBe(true);
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && deno run -A npm:vitest run src/storage/index-file.test.ts` Expected: FAIL (cannot resolve `./index-file.ts`).

- [ ] **Step 3: Write `frontend/src/storage/index-file.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && deno run -A npm:vitest run src/storage/index-file.test.ts` Expected: PASS (5 tests).

- [ ] **Step 5: Format and commit**

```bash
cd frontend && deno fmt src/storage/index-file.ts src/storage/index-file.test.ts
cd .. && git add frontend/src/storage/index-file.ts frontend/src/storage/index-file.test.ts
git commit -m "feat(storage): add .mytabs index model and disk reconciliation"
```

---

### Task 3: In-memory fake `FileSystemDirectoryHandle` (test helper)

**Files:**

- Create: `frontend/src/storage/fake-fs.ts`
- Create: `frontend/src/storage/fake-fs.test.ts`

**Interfaces:**

- Produces: `createFakeDirectory(): FileSystemDirectoryHandle` — an in-memory implementation supporting `kind`, `name`, `getDirectoryHandle(name, {create})`, `getFileHandle(name, {create})`,
  `removeEntry(name, {recursive})`, async iteration via `entries()` and `[Symbol.asyncIterator]`, and file handles supporting `getFile()` (returns a `File`/Blob with `arrayBuffer()`/`text()`) and
  `createWritable()` (returns a writable with `write(data)` and `close()`). This is used by Tasks 5–6 to test the provider without a real filesystem.

- [ ] **Step 1: Write the failing test `frontend/src/storage/fake-fs.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { createFakeDirectory } from "./fake-fs.ts";

describe("fake-fs", () => {
    it("creates nested directories and files, and reads them back", async () => {
        const root = createFakeDirectory();
        const sub = await root.getDirectoryHandle("Rock", { create: true });
        const fh = await sub.getFileHandle("a.gp", { create: true });
        const w = await fh.createWritable();
        await w.write(new Uint8Array([1, 2, 3]));
        await w.close();

        const sub2 = await root.getDirectoryHandle("Rock");
        const fh2 = await sub2.getFileHandle("a.gp");
        const bytes = new Uint8Array(await (await fh2.getFile()).arrayBuffer());
        expect([...bytes]).toEqual([1, 2, 3]);
    });

    it("throws when getting a missing entry without create", async () => {
        const root = createFakeDirectory();
        await expect(root.getFileHandle("missing.gp")).rejects.toThrow();
    });

    it("lists entries and removes them", async () => {
        const root = createFakeDirectory();
        await root.getFileHandle("a.gp", { create: true });
        await root.getDirectoryHandle("Rock", { create: true });
        const names: string[] = [];
        for await (const [name] of root.entries()) names.push(name);
        expect(names.sort()).toEqual(["Rock", "a.gp"]);
        await root.removeEntry("a.gp");
        const after: string[] = [];
        for await (const [name] of root.entries()) after.push(name);
        expect(after).toEqual(["Rock"]);
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && deno run -A npm:vitest run src/storage/fake-fs.test.ts` Expected: FAIL (cannot resolve `./fake-fs.ts`).

- [ ] **Step 3: Write `frontend/src/storage/fake-fs.ts`**

```ts
// Minimal in-memory stand-in for the File System Access API, for unit tests.
// Implements just the subset the provider uses.

class FakeFile {
    constructor(public data: Uint8Array) {}
    async arrayBuffer() {
        return this.data.buffer.slice(this.data.byteOffset, this.data.byteOffset + this.data.byteLength);
    }
    async text() {
        return new TextDecoder().decode(this.data);
    }
}

class FakeWritable {
    private chunks: Uint8Array[] = [];
    constructor(private commit: (bytes: Uint8Array) => void) {}
    async write(data: Uint8Array | string | ArrayBuffer) {
        if (typeof data === "string") this.chunks.push(new TextEncoder().encode(data));
        else if (data instanceof ArrayBuffer) this.chunks.push(new Uint8Array(data));
        else this.chunks.push(data);
    }
    async close() {
        const total = this.chunks.reduce((n, c) => n + c.length, 0);
        const out = new Uint8Array(total);
        let o = 0;
        for (const c of this.chunks) {
            out.set(c, o);
            o += c.length;
        }
        this.commit(out);
    }
}

class FakeFileHandle {
    kind = "file" as const;
    constructor(public name: string, private store: { data: Uint8Array }) {}
    async getFile() {
        return new FakeFile(this.store.data);
    }
    async createWritable() {
        return new FakeWritable((bytes) => {
            this.store.data = bytes;
        });
    }
}

class FakeDirHandle {
    kind = "directory" as const;
    private dirs = new Map<string, FakeDirHandle>();
    private files = new Map<string, { data: Uint8Array }>();
    constructor(public name: string) {}

    async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
        let d = this.dirs.get(name);
        if (!d) {
            if (!opts?.create) throw new DOMException(`${name} not found`, "NotFoundError");
            d = new FakeDirHandle(name);
            this.dirs.set(name, d);
        }
        return d;
    }
    async getFileHandle(name: string, opts?: { create?: boolean }) {
        let f = this.files.get(name);
        if (!f) {
            if (!opts?.create) throw new DOMException(`${name} not found`, "NotFoundError");
            f = { data: new Uint8Array() };
            this.files.set(name, f);
        }
        return new FakeFileHandle(name, f);
    }
    async removeEntry(name: string, _opts?: { recursive?: boolean }) {
        if (!this.dirs.delete(name) && !this.files.delete(name)) {
            throw new DOMException(`${name} not found`, "NotFoundError");
        }
    }
    async *entries(): AsyncGenerator<[string, FakeDirHandle | FakeFileHandle]> {
        for (const [name, f] of this.files) yield [name, new FakeFileHandle(name, f)];
        for (const [name, d] of this.dirs) yield [name, d];
    }
    [Symbol.asyncIterator]() {
        return this.entries();
    }
}

export function createFakeDirectory(name = "root"): FileSystemDirectoryHandle {
    return new FakeDirHandle(name) as unknown as FileSystemDirectoryHandle;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && deno run -A npm:vitest run src/storage/fake-fs.test.ts` Expected: PASS (3 tests).

- [ ] **Step 5: Format and commit**

```bash
cd frontend && deno fmt src/storage/fake-fs.ts src/storage/fake-fs.test.ts
cd .. && git add frontend/src/storage/fake-fs.ts frontend/src/storage/fake-fs.test.ts
git commit -m "test(storage): add in-memory fake FileSystemDirectoryHandle"
```

---

### Task 4: `FsDirectoryProvider` — read paths (listFolder, readTab, meta)

**Files:**

- Create: `frontend/src/storage/fs-directory-provider.ts`
- Create: `frontend/src/storage/fs-directory-provider.test.ts`

**Interfaces:**

- Consumes: `StorageProvider`, `TabMeta`, `FolderEntry`, `TabEntry`, `ProviderCapabilities` (Task 1); index-file helpers (Task 2); path helpers (Task 1); `createFakeDirectory` (Task 3, tests only).
- Produces: `class FsDirectoryProvider implements StorageProvider` with constructor `(root: FileSystemDirectoryHandle, capabilities: ProviderCapabilities)`. Also constant `META_DIR = ".mytabs"`,
  `INDEX_PATH = ".mytabs/index.json"`. This task implements `capabilities`, `listFolder`, `readTab`, `readMeta`, `writeMeta` and the private helpers `getDirHandle(path, create)`,
  `getFileHandle(path, create)`, `loadIndex()`, `saveIndex(data)`. Write ops (`writeTab`, `createFolder`, `rename`, `move`, `remove`) are stubbed to `throw new Error("not implemented")` here and
  completed in Task 5.

- [ ] **Step 1: Write the failing test `frontend/src/storage/fs-directory-provider.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { FsDirectoryProvider } from "./fs-directory-provider.ts";
import { createFakeDirectory } from "./fake-fs.ts";

const caps = { canBrowseDisk: true, persistent: true, rootLabel: "root" };

async function seed() {
    const root = createFakeDirectory();
    const rock = await root.getDirectoryHandle("Rock", { create: true });
    for (const [dir, file] of [[root, "top.gp"], [rock, "song.gp5"]] as const) {
        const fh = await dir.getFileHandle(file, { create: true });
        const w = await fh.createWritable();
        await w.write(new Uint8Array([80, 75, 3, 4])); // "PK.."
        await w.close();
    }
    return new FsDirectoryProvider(root, caps);
}

describe("FsDirectoryProvider (read)", () => {
    it("lists folders and score files, ignoring the .mytabs dir", async () => {
        const p = await seed();
        const rootListing = await p.listFolder("");
        expect(rootListing.folders.map((f) => f.name)).toEqual(["Rock"]);
        expect(rootListing.tabs.map((t) => t.name)).toEqual(["top.gp"]);
        expect(rootListing.tabs[0].path).toBe("top.gp");
        expect(rootListing.tabs[0].title).toBe("top");

        const rockListing = await p.listFolder("Rock");
        expect(rockListing.tabs.map((t) => t.path)).toEqual(["Rock/song.gp5"]);
    });

    it("reads tab bytes and default meta", async () => {
        const p = await seed();
        const { bytes, meta } = await p.readTab("top.gp");
        expect([...bytes.slice(0, 2)]).toEqual([80, 75]);
        expect(meta.favorite).toBe(false);
    });

    it("writeMeta persists and readMeta returns it", async () => {
        const p = await seed();
        await p.writeMeta("top.gp", { favorite: true, viewMode: "score" });
        const meta = await p.readMeta("top.gp");
        expect(meta.favorite).toBe(true);
        expect(meta.viewMode).toBe("score");
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && deno run -A npm:vitest run src/storage/fs-directory-provider.test.ts` Expected: FAIL (cannot resolve `./fs-directory-provider.ts`).

- [ ] **Step 3: Write `frontend/src/storage/fs-directory-provider.ts`**

```ts
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
```

Note: `reconcile` is imported for use by `writeTab`/listing hygiene in Task 5; if the linter flags it as unused here, add `void reconcile;` in a comment or leave the import out until Task 5 (the lint
config excludes `no-unused-vars`, so it is safe to keep).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && deno run -A npm:vitest run src/storage/fs-directory-provider.test.ts` Expected: PASS (3 tests).

- [ ] **Step 5: Format and commit**

```bash
cd frontend && deno fmt src/storage/fs-directory-provider.ts src/storage/fs-directory-provider.test.ts
cd .. && git add frontend/src/storage/fs-directory-provider.ts frontend/src/storage/fs-directory-provider.test.ts
git commit -m "feat(storage): FsDirectoryProvider read paths (list, read, meta)"
```

---

### Task 5: `FsDirectoryProvider` — write paths (writeTab, folders, rename, move, remove)

**Files:**

- Modify: `frontend/src/storage/fs-directory-provider.ts` (replace the five stubbed methods)
- Modify: `frontend/src/storage/fs-directory-provider.test.ts` (add write tests)

**Interfaces:**

- Consumes: everything from Task 4.
- Produces: working `writeTab`, `createFolder`, `rename`, `move`, `remove`. `rename`/`move` return the new relative path and rekey the index entry. `writeTab` creates parent dirs as needed and
  refreshes the index entry for the path.

- [ ] **Step 1: Add failing write tests to `fs-directory-provider.test.ts`**

```ts
describe("FsDirectoryProvider (write)", () => {
    it("writeTab creates the file (and parents) and indexes it", async () => {
        const p = await seed();
        await p.writeTab("New/fresh.gp", new Uint8Array([80, 75, 1, 1]));
        const listing = await p.listFolder("New");
        expect(listing.tabs.map((t) => t.name)).toEqual(["fresh.gp"]);
        const { bytes } = await p.readTab("New/fresh.gp");
        expect([...bytes.slice(0, 2)]).toEqual([80, 75]);
    });

    it("createFolder makes a directory", async () => {
        const p = await seed();
        await p.createFolder("Blues");
        const listing = await p.listFolder("");
        expect(listing.folders.map((f) => f.name)).toContain("Blues");
    });

    it("rename moves the file and preserves its metadata", async () => {
        const p = await seed();
        await p.writeMeta("top.gp", { favorite: true });
        const newPath = await p.rename("top.gp", "renamed.gp");
        expect(newPath).toBe("renamed.gp");
        const names = (await p.listFolder("")).tabs.map((t) => t.name);
        expect(names).toContain("renamed.gp");
        expect(names).not.toContain("top.gp");
        expect((await p.readMeta("renamed.gp")).favorite).toBe(true);
    });

    it("move relocates a tab into another folder", async () => {
        const p = await seed();
        const newPath = await p.move("top.gp", "Rock");
        expect(newPath).toBe("Rock/top.gp");
        expect((await p.listFolder("Rock")).tabs.map((t) => t.name)).toContain("top.gp");
        expect((await p.listFolder("")).tabs.map((t) => t.name)).not.toContain("top.gp");
    });

    it("remove deletes a tab", async () => {
        const p = await seed();
        await p.remove("top.gp");
        expect((await p.listFolder("")).tabs.map((t) => t.name)).not.toContain("top.gp");
    });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd frontend && deno run -A npm:vitest run src/storage/fs-directory-provider.test.ts` Expected: FAIL (the five methods throw "not implemented").

- [ ] **Step 3: Replace the stubbed methods with implementations**

Replace the "writes (implemented in Task 5)" block in `fs-directory-provider.ts` with:

```ts
    async writeTab(path: string, bytes: Uint8Array): Promise<void> {
        const p = normalizeRelPath(path);
        const fh = await this.getFileHandle(p, true);
        const w = await fh.createWritable();
        await w.write(bytes);
        await w.close();
        const index = await this.loadIndex();
        if (!index.tabs[p]) {
            index.tabs[p] = defaultMeta(basename(p));
            await this.saveIndex(index);
        }
    }

    async createFolder(path: string): Promise<void> {
        await this.getDirHandle(path, true);
    }

    private async copyBytes(fromPath: string, toPath: string): Promise<void> {
        const src = await this.getFileHandle(fromPath, false);
        const bytes = new Uint8Array(await (await src.getFile()).arrayBuffer());
        const dst = await this.getFileHandle(toPath, true);
        const w = await dst.createWritable();
        await w.write(bytes);
        await w.close();
    }

    private async rekey(fromPath: string, toPath: string): Promise<void> {
        const index = await this.loadIndex();
        const from = normalizeRelPath(fromPath);
        const to = normalizeRelPath(toPath);
        if (index.tabs[from]) {
            index.tabs[to] = index.tabs[from];
            delete index.tabs[from];
            await this.saveIndex(index);
        }
    }

    async rename(path: string, newName: string): Promise<string> {
        const toPath = joinPath(parentPath(path), newName);
        await this.copyBytes(path, toPath);
        const parent = await this.getDirHandle(parentPath(path), false);
        await parent.removeEntry(basename(path));
        await this.rekey(path, toPath);
        return normalizeRelPath(toPath);
    }

    async move(fromPath: string, toFolder: string): Promise<string> {
        const toPath = joinPath(toFolder, basename(fromPath));
        await this.copyBytes(fromPath, toPath);
        const parent = await this.getDirHandle(parentPath(fromPath), false);
        await parent.removeEntry(basename(fromPath));
        await this.rekey(fromPath, toPath);
        return normalizeRelPath(toPath);
    }

    async remove(path: string): Promise<void> {
        const parent = await this.getDirHandle(parentPath(path), false);
        await parent.removeEntry(basename(path), { recursive: true });
        const index = await this.loadIndex();
        if (index.tabs[normalizeRelPath(path)]) {
            delete index.tabs[normalizeRelPath(path)];
            await this.saveIndex(index);
        }
    }
```

Note: the File System Access API has no atomic move; copy-then-delete is the portable approach and works identically on the fake handle, real FSA, and OPFS.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && deno run -A npm:vitest run src/storage/fs-directory-provider.test.ts` Expected: PASS (8 tests total).

- [ ] **Step 5: Format and commit**

```bash
cd frontend && deno fmt src/storage/fs-directory-provider.ts src/storage/fs-directory-provider.test.ts
cd .. && git add frontend/src/storage/fs-directory-provider.ts frontend/src/storage/fs-directory-provider.test.ts
git commit -m "feat(storage): FsDirectoryProvider write paths (writeTab, folders, rename, move, remove)"
```

---

### Task 6: Directory-handle persistence (IndexedDB)

**Files:**

- Create: `frontend/src/storage/handle-store.ts`
- Create: `frontend/src/storage/handle-store.test.ts`

**Interfaces:**

- Produces: `saveRootHandle(handle: FileSystemDirectoryHandle): Promise<void>`, `loadRootHandle(): Promise<FileSystemDirectoryHandle | null>`, `clearRootHandle(): Promise<void>`. Backed by IndexedDB
  (store `mytabs-handles`, key `root`). happy-dom provides `indexedDB`; if unavailable the functions degrade to no-op/null.

- [ ] **Step 1: Write the failing test `frontend/src/storage/handle-store.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { clearRootHandle, loadRootHandle, saveRootHandle } from "./handle-store.ts";
import { createFakeDirectory } from "./fake-fs.ts";

describe("handle-store", () => {
    it("returns null when nothing is stored", async () => {
        await clearRootHandle();
        expect(await loadRootHandle()).toBeNull();
    });

    it("round-trips a stored handle", async () => {
        const handle = createFakeDirectory("MyTabs");
        await saveRootHandle(handle);
        const loaded = await loadRootHandle();
        expect(loaded).not.toBeNull();
        // structured clone preserves the object identity of our fake in happy-dom
        expect((loaded as unknown as { name: string }).name).toBe("MyTabs");
        await clearRootHandle();
    });
});
```

Note: if happy-dom's IndexedDB cannot structured-clone the fake handle, wrap the test body in a `try/catch` that `expect`s graceful `null` — but first run it as written; happy-dom supports a basic
IndexedDB.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && deno run -A npm:vitest run src/storage/handle-store.test.ts` Expected: FAIL (cannot resolve `./handle-store.ts`).

- [ ] **Step 3: Write `frontend/src/storage/handle-store.ts`**

```ts
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

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
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

export async function saveRootHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    await tx("readwrite", (store) => store.put(handle, KEY));
}

export async function loadRootHandle(): Promise<FileSystemDirectoryHandle | null> {
    return (await tx<FileSystemDirectoryHandle>("readonly", (store) => store.get(KEY))) ?? null;
}

export async function clearRootHandle(): Promise<void> {
    await tx("readwrite", (store) => store.delete(KEY));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && deno run -A npm:vitest run src/storage/handle-store.test.ts` Expected: PASS (2 tests). If the round-trip test cannot clone the fake handle under happy-dom, adjust it to assert
graceful behaviour as noted, then re-run.

- [ ] **Step 5: Format and commit**

```bash
cd frontend && deno fmt src/storage/handle-store.ts src/storage/handle-store.test.ts
cd .. && git add frontend/src/storage/handle-store.ts frontend/src/storage/handle-store.test.ts
git commit -m "feat(storage): persist the root directory handle in IndexedDB"
```

---

### Task 7: Provider selection + acquisition (local folder / OPFS)

**Files:**

- Create: `frontend/src/storage/select-provider.ts`
- Create: `frontend/src/storage/select-provider.test.ts`

**Interfaces:**

- Consumes: `FsDirectoryProvider` (Tasks 4–5), handle-store (Task 6), types (Task 1).
- Produces:
  - `supportsFileSystemAccess(): boolean` — `typeof window !== "undefined" && "showDirectoryPicker" in window`.
  - `pickLocalFolder(): Promise<FsDirectoryProvider>` — calls `window.showDirectoryPicker()`, persists the handle, returns a provider with `canBrowseDisk: true`.
  - `openOpfs(): Promise<FsDirectoryProvider>` — root from `navigator.storage.getDirectory()`, `canBrowseDisk: false`, `rootLabel: "Browser storage"`.
  - `restoreProvider(): Promise<FsDirectoryProvider | null>` — if a stored handle exists and `queryPermission()/requestPermission()` grants read/write, return a provider; else null.
  - `providerFromHandle(handle, canBrowseDisk): FsDirectoryProvider` — helper used by the above and by tests.

- [ ] **Step 1: Write the failing test `frontend/src/storage/select-provider.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { providerFromHandle, supportsFileSystemAccess } from "./select-provider.ts";
import { createFakeDirectory } from "./fake-fs.ts";

describe("select-provider", () => {
    it("reports File System Access support based on window.showDirectoryPicker", () => {
        const original = (globalThis as Record<string, unknown>).showDirectoryPicker;
        delete (globalThis as Record<string, unknown>).showDirectoryPicker;
        expect(supportsFileSystemAccess()).toBe(false);
        (globalThis as Record<string, unknown>).showDirectoryPicker = () => {};
        expect(supportsFileSystemAccess()).toBe(true);
        if (original === undefined) delete (globalThis as Record<string, unknown>).showDirectoryPicker;
        else (globalThis as Record<string, unknown>).showDirectoryPicker = original;
    });

    it("providerFromHandle sets capabilities from the flag and the handle name", () => {
        const p = providerFromHandle(createFakeDirectory("MyTabs"), true);
        expect(p.capabilities.canBrowseDisk).toBe(true);
        expect(p.capabilities.rootLabel).toBe("MyTabs");
        const opfs = providerFromHandle(createFakeDirectory("root"), false);
        expect(opfs.capabilities.canBrowseDisk).toBe(false);
    });
});
```

Note: `supportsFileSystemAccess` reads `window`; under happy-dom `window === globalThis`, so setting `globalThis.showDirectoryPicker` is visible to it.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && deno run -A npm:vitest run src/storage/select-provider.test.ts` Expected: FAIL (cannot resolve `./select-provider.ts`).

- [ ] **Step 3: Write `frontend/src/storage/select-provider.ts`**

```ts
import { FsDirectoryProvider } from "./fs-directory-provider.ts";
import { clearRootHandle, loadRootHandle, saveRootHandle } from "./handle-store.ts";

export function supportsFileSystemAccess(): boolean {
    return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export function providerFromHandle(handle: FileSystemDirectoryHandle, canBrowseDisk: boolean): FsDirectoryProvider {
    return new FsDirectoryProvider(handle, {
        canBrowseDisk,
        persistent: true,
        rootLabel: canBrowseDisk ? handle.name : "Browser storage",
    });
}

export async function pickLocalFolder(): Promise<FsDirectoryProvider> {
    const handle = await (window as unknown as { showDirectoryPicker(opts?: unknown): Promise<FileSystemDirectoryHandle> })
        .showDirectoryPicker({ mode: "readwrite", id: "mytabs-root" });
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && deno run -A npm:vitest run src/storage/select-provider.test.ts` Expected: PASS (2 tests).

- [ ] **Step 5: Run the whole storage suite**

Run: `cd frontend && deno run -A npm:vitest run src/storage` Expected: PASS (all storage tests green).

- [ ] **Step 6: Format and commit**

```bash
cd frontend && deno fmt src/storage/select-provider.ts src/storage/select-provider.test.ts
cd .. && git add frontend/src/storage/select-provider.ts frontend/src/storage/select-provider.test.ts
git commit -m "feat(storage): provider selection (local folder picker, OPFS, restore)"
```

---

### Task 8: App-level storage session (Pinia-free singleton)

**Files:**

- Create: `frontend/src/storage/session.ts`
- Create: `frontend/src/storage/session.test.ts`

**Interfaces:**

- Consumes: `StorageProvider`, `select-provider` (Task 7).
- Produces: a reactive-friendly singleton the Vue layer reads:
  - `getProvider(): StorageProvider | null`
  - `setProvider(p: StorageProvider | null): void`
  - `initStorage(): Promise<StorageProvider | null>` — tries `restoreProvider()`; on failure returns null (UI then shows the pick/OPFS gate). Sets the singleton.
  - `subscribe(fn: () => void): () => void` — notify listeners on provider change (so a Vue component can re-render without Pinia).

- [ ] **Step 1: Write the failing test `frontend/src/storage/session.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { getProvider, setProvider, subscribe } from "./session.ts";
import { providerFromHandle } from "./select-provider.ts";
import { createFakeDirectory } from "./fake-fs.ts";

describe("storage session", () => {
    it("stores and returns the current provider, notifying subscribers", () => {
        let notified = 0;
        const off = subscribe(() => notified++);
        expect(getProvider()).toBeNull();
        setProvider(providerFromHandle(createFakeDirectory("X"), true));
        expect(getProvider()?.capabilities.rootLabel).toBe("X");
        expect(notified).toBe(1);
        off();
        setProvider(null);
        expect(notified).toBe(1); // unsubscribed
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && deno run -A npm:vitest run src/storage/session.test.ts` Expected: FAIL.

- [ ] **Step 3: Write `frontend/src/storage/session.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && deno run -A npm:vitest run src/storage/session.test.ts` Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
cd frontend && deno fmt src/storage/session.ts src/storage/session.test.ts
cd .. && git add frontend/src/storage/session.ts frontend/src/storage/session.test.ts
git commit -m "feat(storage): app-level provider session singleton"
```

---

### Task 9: Editor loads and saves through the provider

**Files:**

- Modify: `frontend/src/pages/TabEditor.vue`
- Modify: `frontend/src/router.ts`

**Interfaces:**

- Consumes: `session.getProvider()`, `StorageProvider.readTab/writeTab/readMeta/writeMeta`.
- Produces: a `/edit?path=<relpath>` route (or query on the existing editor route) that loads a tab from the provider by path and saves back to the same path. The provider path replaces the numeric
  `tabID` for local mode.

**Context:** Today `TabEditor.vue` (`mounted`) fetches `/api/tab/:id`, mints a temp token, and sets `core.file` to a URL (lines ~305–360). Saving calls `saveScoreToServer` (`save()`), and view/color
prefs load from `localStorage` keyed by tab id (`mounted`, ~265). This task adds a provider-backed path while leaving the server path intact behind a capability check.

- [ ] **Step 1: Add a route that carries a storage path**

In `frontend/src/router.ts`, add (near the existing `tabEditor` route):

```ts
{
    name: "editPath",
    path: "/edit",
    component: TabEditor,
    meta: { hideFooter: true },
},
```

The editor opens as `/edit?path=Rock/Song.gp`.

- [ ] **Step 2: In `TabEditor.vue`, detect provider mode in `mounted()`**

At the top of `mounted()`, before the existing server fetch, insert:

```js
this.storagePath = this.$route.query.path ? decodeURIComponent(this.$route.query.path) : null;
this.provider = getProvider();
if (this.storagePath && this.provider) {
    await this.loadFromProvider();
    return;
}
// ...existing server-based mounted() body unchanged below...
```

Add to `data()`: `storagePath: null, provider: null,`. Add the import at the top of the script: `import { getProvider } from "../storage/session.ts";`.

- [ ] **Step 3: Add `loadFromProvider()` and provider-aware `save()`**

Add these methods (place `loadFromProvider` near `initContainer`, and branch `save()`):

```js
async loadFromProvider() {
    const { bytes, meta } = await this.provider.readTab(this.storagePath);
    this.tab = { title: meta.title ?? "", artist: meta.artist ?? "", filename: this.storagePath.split("/").pop() };
    this.viewMode = meta.viewMode ?? "tab";
    this.noteColorOn = !!meta.noteColorOn;
    this.initContainer(null); // FSA mode: no temp token
    // Load bytes directly instead of core.file URL:
    this.api.load(new Uint8Array(bytes));
    // wire keyboard + beforeunload exactly as the server path does
    this._wireKeyboardAndUnload();
},
```

- In `initContainer(tempToken)`: when `tempToken` is `null` (provider mode), omit `core.file` from the alphaTab settings (do not set a file URL); everything else stays. `scoreLoaded` handling already
  attaches the controller.
- Extract the keyboard + `beforeunload` wiring currently at the end of `mounted()` into a `_wireKeyboardAndUnload()` method and call it from both the server path and `loadFromProvider()`.
- In `save()`, branch at the top:

```js
if (this.storagePath && this.provider) {
    this.saving = true;
    this.ui.saving = true;
    try {
        this.restoreStaffVisibility();
        let bytes = this.ctrl.exportGp();
        let targetPath = this.storagePath;
        // convert-to-.gp: write a new .gp beside a non-.gp original, leave original intact
        if (!targetPath.toLowerCase().endsWith(".gp")) {
            targetPath = targetPath.replace(/\.[^.]+$/, "") + ".gp";
        }
        await this.provider.writeTab(targetPath, bytes);
        await this.provider.writeMeta(targetPath, { viewMode: this.viewMode, noteColorOn: this.noteColorOn, title: this.tab.title, artist: this.tab.artist });
        if (targetPath !== this.storagePath) this.storagePath = targetPath;
        this.ctrl.markSaved();
        notify({ type: "success", text: "Saved" });
    } catch (e) {
        notify({ type: "error", title: "Save failed", text: e.message });
    } finally {
        this.saving = false;
        this.ui.saving = false;
    }
    return;
}
// ...existing server save below...
```

- [ ] **Step 4: Manual verification (documented; automated E2E is Task 11)**

Because provider mode needs a real browser, verify with the app running:

Run: `cd .. && deno task build-frontend && deno task start` (or the dev server), open the app, use the temporary picker (Task 10) to choose a folder containing a `.gp`, open it via `/edit?path=...`,
edit a note, Ctrl+S, reload → the change persists in the file on disk.

- [ ] **Step 5: Run the existing editor unit tests (no regressions)**

Run: `cd frontend && deno run -A npm:vitest run src/editor && deno run -A npm:vitest run src/alphatab-shared.test.ts` Expected: PASS (unchanged).

- [ ] **Step 6: Format and commit**

```bash
cd frontend && deno fmt src/pages/TabEditor.vue src/router.ts
cd .. && git add frontend/src/pages/TabEditor.vue frontend/src/router.ts
git commit -m "feat(editor): load and save tabs through the storage provider"
```

---

### Task 10: Minimal boot gate (pick folder / OPFS) + interim tab list

**Files:**

- Create: `frontend/src/pages/LocalLibrary.vue` (interim; replaced by the full Drive UI in the Phase 2 plan)
- Modify: `frontend/src/router.ts` (point `/` to `LocalLibrary` when in local mode)
- Modify: `frontend/src/main.ts` (call `initStorage()` before mount) — adjust to the actual bootstrap file if named differently

**Interfaces:**

- Consumes: `initStorage`, `getProvider`, `setProvider`, `subscribe` (Task 8); `pickLocalFolder`, `openOpfs`, `supportsFileSystemAccess` (Task 7); `StorageProvider.listFolder` (Task 4).
- Produces: a usable end-to-end path — pick a folder (or auto-OPFS on Firefox), see a flat list of the root folder's tabs, click one to open `/edit?path=...`.

- [ ] **Step 1: Call `initStorage()` at boot**

In the app bootstrap (`frontend/src/main.ts` or equivalent), before `app.mount(...)`:

```ts
import { initStorage } from "./storage/session.ts";
await initStorage();
```

If the bootstrap is not already an async module, wrap the mount in `initStorage().finally(() => app.mount("#app"))`.

- [ ] **Step 2: Write `frontend/src/pages/LocalLibrary.vue` (interim)**

```vue
<script>
import { defineComponent } from "vue";
import { getProvider, setProvider, subscribe } from "../storage/session.ts";
import { openOpfs, pickLocalFolder, supportsFileSystemAccess } from "../storage/select-provider.ts";

export default defineComponent({
    data() {
        return { provider: getProvider(), tabs: [], folders: [], supportsFsa: supportsFileSystemAccess(), error: "" };
    },
    async mounted() {
        this._off = subscribe(() => {
            this.provider = getProvider();
            this.refresh();
        });
        if (!this.provider && !this.supportsFsa) {
            try {
                setProvider(await openOpfs());
            } catch (e) {
                this.error = String(e);
            }
        }
        this.provider = getProvider();
        await this.refresh();
    },
    beforeUnmount() {
        this._off?.();
    },
    methods: {
        async pick() {
            try {
                setProvider(await pickLocalFolder());
            } catch (e) {
                if (e?.name !== "AbortError") this.error = String(e);
            }
        },
        async refresh() {
            if (!this.provider) return;
            const { folders, tabs } = await this.provider.listFolder("");
            this.folders = folders;
            this.tabs = tabs;
        },
        open(path) {
            this.$router.push({ name: "editPath", query: { path } });
        },
    },
});
</script>

<template>
    <div class="local-library">
        <div v-if="!provider" class="empty">
            <p>Choose a folder on your computer to store your tabs.</p>
            <button v-if="supportsFsa" @click="pick">Choose folder</button>
            <p v-else class="muted">Your browser can't open a disk folder; tabs are stored privately in the browser.</p>
        </div>
        <div v-else>
            <h2>{{ provider.capabilities.rootLabel }}</h2>
            <button v-if="supportsFsa" @click="pick">Change folder</button>
            <ul>
                <li v-for="f in folders" :key="f.path">📁 {{ f.name }}</li>
                <li v-for="t in tabs" :key="t.path"><a href="#" @click.prevent="open(t.path)">🎸 {{ t.title }}</a></li>
            </ul>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
    </div>
</template>
```

- [ ] **Step 3: Route `/` to the local library for the static build**

In `frontend/src/router.ts`, import `LocalLibrary` and set the `home` route's component to `LocalLibrary` when the build targets local mode. For now, add a distinct route to avoid disturbing
self-host:

```ts
{ name: "localHome", path: "/library", component: () => import("./pages/LocalLibrary.vue"), meta: { hideFooter: true } },
```

(The Phase 2 plan makes this the real `/` and removes the interim list.)

- [ ] **Step 4: Build and manually verify the full loop**

Run: `cd .. && deno task build-frontend && deno task start` Open `http://localhost:47777/library` in Chrome → Choose folder → pick a folder with a `.gp` → click it → editor opens, edit, save, reload
folder → change persisted. On Firefox → OPFS mode shows (no Choose folder), import path via editor still works. Expected: no console errors; save round-trips.

- [ ] **Step 5: Commit**

```bash
cd frontend && deno fmt src/pages/LocalLibrary.vue src/router.ts src/main.ts
cd .. && git add frontend/src/pages/LocalLibrary.vue frontend/src/router.ts frontend/src/main.ts
git commit -m "feat(app): boot storage session + interim local library gate"
```

---

### Task 11: Vercel static build config

**Files:**

- Create: `vercel.json`
- Create: `.vercelignore`

**Interfaces:**

- Produces: a static deployment that builds the frontend and serves `dist/` with SPA routing, no serverless functions.

- [ ] **Step 1: Write `vercel.json`**

```json
{
    "buildCommand": "deno task build-frontend",
    "outputDirectory": "dist",
    "installCommand": "cd frontend && deno install",
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
    "framework": null
}
```

Note: confirm Vercel's build image provides Deno; if not, set `buildCommand` to use `npx vite build` within `frontend/` and an `installCommand` of `cd frontend && npm install`. Verify against the
actual `frontend/package.json` build script (`vite build`).

- [ ] **Step 2: Write `.vercelignore`**

```
backend
data
e2e
extra
docs
```

- [ ] **Step 3: Verify the static build locally**

Run: `cd .. && deno task build-frontend` Expected: `dist/` produced. Serve `dist/` with any static server and confirm `/library` loads and deep links (e.g. `/edit?path=x`) resolve via the SPA rewrite.

- [ ] **Step 4: Commit**

```bash
git add vercel.json .vercelignore
git commit -m "chore(deploy): static Vercel build config with SPA rewrite"
```

---

### Task 12: Full-suite green + phase wrap

- [ ] **Step 1: Run the entire frontend test suite**

Run: `cd frontend && deno run -A npm:vitest run` Expected: all tests pass (existing + new storage tests).

- [ ] **Step 2: Format check the whole change set**

Run: `cd frontend && deno fmt src/storage src/pages/TabEditor.vue src/pages/LocalLibrary.vue src/router.ts` and `cd .. && deno fmt vercel.json` Expected: clean.

- [ ] **Step 3: Commit any formatting and finalize**

```bash
git add -A
git commit -m "chore(storage): phase 1 formatting + wrap" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

- §3 StorageProvider abstraction → Tasks 1, 4, 5 (interface + FS provider). ✓
- §3 LocalFolder + OPFS providers → Task 7 (`pickLocalFolder`, `openOpfs`, one `FsDirectoryProvider`). ✓
- §3 handle persistence + permission → Tasks 6, 7 (`restoreProvider`, `ensurePermission`). ✓
- §4 data model + `.mytabs/index.json` + reconciliation → Tasks 2, 4, 5. ✓
- §6 editor load via `api.load(bytes)` + save via provider + convert-to-.gp keeping original → Task 9. ✓
- §7 Vercel static build + SPA rewrite + no serverless → Task 11. ✓
- §8 browser support/fallback (feature-detect, OPFS notice) → Tasks 7, 10. ✓
- §9 error handling (permission denied, malformed index, corrupt file skipping) → Tasks 2 (parseIndex), 4 (listFolder skips non-score), 7 (permission), 10 (empty/error states). ✓
- §10 testing (unit against fake handle + OPFS-in-env; E2E is called out as Chromium-gated) → Tasks 3–8; E2E deferred with rationale in §10 (real picker needs a gesture). Note: a Playwright E2E using
  OPFS is deferred to the Phase 2 plan where the real library UI exists to drive.
- ServerProvider (retained) → NOT built here by design (self-host keeps the current server path in `TabEditor.vue`, which Task 9 leaves intact behind the capability check). ✓
- Library UI (§5) → explicitly Phase 2, not this plan. Task 10 ships only an interim gate/list. ✓
- Media/audio/youtube (§5, §11 phase 3) → not this plan. ✓

**Placeholder scan:** No "TBD/TODO". Task 9 references existing `TabEditor.vue` regions by behavior and gives the exact code to add; the one soft spot is "extract `_wireKeyboardAndUnload()` from the
current mounted() tail" — the implementer must read those ~10 lines, which is acceptable (it is a mechanical extraction, not a design decision). Task 11 flags the Deno-on-Vercel assumption with a
concrete fallback.

**Type consistency:** `StorageProvider` method names/signatures are identical across Tasks 1, 4, 5, 9, 10. `providerFromHandle(handle, canBrowseDisk)`, `pickLocalFolder`, `openOpfs`, `restoreProvider`
names match between Tasks 7, 8, 10. `TabMeta` fields (`favorite`, `viewMode`, `noteColorOn`, `youtube`, `audio`, `title`, `artist`) are consistent across Tasks 1, 2, 4, 9. Index type
`IndexData { version, tabs }` consistent Tasks 2, 4, 5.

**Gaps fixed inline:** none outstanding.
