// Minimal in-memory stand-in for the File System Access API, for unit tests.
// Implements just the subset the provider uses.

class FakeFile {
    constructor(public data: Uint8Array) {}
    async arrayBuffer() {
        return this.data.buffer.slice(
            this.data.byteOffset,
            this.data.byteOffset + this.data.byteLength,
        );
    }
    async text() {
        return new TextDecoder().decode(this.data);
    }
}

class FakeWritable {
    private chunks: Uint8Array[] = [];
    constructor(private commit: (bytes: Uint8Array) => void) {}
    async write(data: Uint8Array | string | ArrayBuffer) {
        if (typeof data === "string") {
            this.chunks.push(new TextEncoder().encode(data));
        } else if (data instanceof ArrayBuffer) {
            this.chunks.push(new Uint8Array(data));
        } else {
            this.chunks.push(data);
        }
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
            if (!opts?.create) {
                throw new DOMException(`${name} not found`, "NotFoundError");
            }
            d = new FakeDirHandle(name);
            this.dirs.set(name, d);
        }
        return d;
    }
    async getFileHandle(name: string, opts?: { create?: boolean }) {
        let f = this.files.get(name);
        if (!f) {
            if (!opts?.create) {
                throw new DOMException(`${name} not found`, "NotFoundError");
            }
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
    async *entries(): AsyncGenerator<
        [string, FakeDirHandle | FakeFileHandle]
    > {
        for (const [name, f] of this.files) yield [name, new FakeFileHandle(name, f)];
        for (const [name, d] of this.dirs) yield [name, d];
    }
    [Symbol.asyncIterator]() {
        return this.entries();
    }
}

export function createFakeDirectory(
    name = "root",
): FileSystemDirectoryHandle {
    return new FakeDirHandle(name) as unknown as FileSystemDirectoryHandle;
}
