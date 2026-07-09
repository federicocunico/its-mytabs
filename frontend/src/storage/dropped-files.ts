/** A file dropped onto the library, with its path relative to the drop root. */
export interface DroppedFile {
    file: File;
    /** e.g. "song.gp" for a loose file, or "Live/2019/song.gp" for one found inside a dropped folder. */
    relativePath: string;
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
    return new Promise((resolve, reject) => {
        const all: FileSystemEntry[] = [];
        // readEntries only returns a batch at a time (spec quirk) - keep
        // calling it until it comes back empty.
        const readBatch = () => {
            reader.readEntries((entries) => {
                if (!entries.length) {
                    resolve(all);
                    return;
                }
                all.push(...entries);
                readBatch();
            }, reject);
        };
        readBatch();
    });
}

function fileFromEntry(entry: FileSystemFileEntry): Promise<File> {
    return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walk(entry: FileSystemEntry, prefix: string, out: DroppedFile[]): Promise<void> {
    if (entry.isFile) {
        const file = await fileFromEntry(entry as FileSystemFileEntry);
        out.push({ file, relativePath: `${prefix}${entry.name}` });
    } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const entries = await readAllEntries(reader);
        for (const child of entries) {
            await walk(child, `${prefix}${entry.name}/`, out);
        }
    }
}

/**
 * Expands a drop's DataTransfer into a flat file list, walking any dropped
 * OS folders recursively so their contents land in matching subfolders
 * instead of being silently ignored. Falls back to the flat `files` list
 * (no subfolder structure) when the browser doesn't expose entries.
 */
export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<DroppedFile[]> {
    const items = dataTransfer.items;
    const entries = items ? Array.from(items).map((item) => item.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e) : [];
    if (!entries.length) {
        return Array.from(dataTransfer.files).map((file) => ({ file, relativePath: file.name }));
    }
    const out: DroppedFile[] = [];
    for (const entry of entries) {
        await walk(entry, "", out);
    }
    return out;
}
