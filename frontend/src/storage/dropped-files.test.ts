import { describe, expect, it } from "vitest";
import { collectDroppedFiles } from "./dropped-files.ts";

/** Minimal fakes for the parts of the WebKit drag-and-drop entry API this module uses. */
function fakeFileEntry(name: string, content = ""): FileSystemFileEntry {
    const file = new File([content], name);
    return {
        isFile: true,
        isDirectory: false,
        name,
        file: (success: (f: File) => void) => success(file),
    } as unknown as FileSystemFileEntry;
}

function fakeDirEntry(name: string, children: FileSystemEntry[]): FileSystemDirectoryEntry {
    let read = false;
    return {
        isFile: false,
        isDirectory: true,
        name,
        createReader: () => ({
            // Real readEntries() returns entries in batches, asynchronously, and
            // must be called repeatedly until it comes back empty - simulate
            // both quirks here (the async part matters: a synchronous callback
            // would recurse forever through readBatch without ever unwinding).
            readEntries: (success: (entries: FileSystemEntry[]) => void) => {
                const batch = read ? [] : children;
                read = true;
                queueMicrotask(() => success(batch));
            },
        }),
    } as unknown as FileSystemDirectoryEntry;
}

function fakeDataTransfer(entries: FileSystemEntry[], flatFiles: File[] = []): DataTransfer {
    return {
        items: entries.length ? (entries.map((entry) => ({ webkitGetAsEntry: () => entry })) as unknown as DataTransferItemList) : undefined,
        files: flatFiles as unknown as FileList,
    } as unknown as DataTransfer;
}

describe("collectDroppedFiles", () => {
    it("returns loose files at the root with their own name as the relative path", async () => {
        const dt = fakeDataTransfer([fakeFileEntry("song.gp"), fakeFileEntry("notes.txt")]);
        const result = await collectDroppedFiles(dt);
        expect(result.map((r) => r.relativePath).sort()).toEqual(["notes.txt", "song.gp"]);
    });

    it("walks a dropped folder recursively, prefixing nested files with the folder path", async () => {
        const dt = fakeDataTransfer([
            fakeDirEntry("Live", [
                fakeFileEntry("readme.txt"),
                fakeDirEntry("2019", [fakeFileEntry("song.gp")]),
            ]),
        ]);
        const result = await collectDroppedFiles(dt);
        expect(result.map((r) => r.relativePath).sort()).toEqual(["Live/2019/song.gp", "Live/readme.txt"]);
    });

    it("mixes loose files and dropped folders in the same drop", async () => {
        const dt = fakeDataTransfer([
            fakeFileEntry("root.gp"),
            fakeDirEntry("Sub", [fakeFileEntry("nested.txt")]),
        ]);
        const result = await collectDroppedFiles(dt);
        expect(result.map((r) => r.relativePath).sort()).toEqual(["Sub/nested.txt", "root.gp"]);
    });

    it("falls back to the flat file list when the browser exposes no entries", async () => {
        const file = new File(["x"], "legacy.gp");
        const dt = fakeDataTransfer([], [file]);
        const result = await collectDroppedFiles(dt);
        expect(result).toEqual([{ file, relativePath: "legacy.gp" }]);
    });
});
