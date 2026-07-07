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
