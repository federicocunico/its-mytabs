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
