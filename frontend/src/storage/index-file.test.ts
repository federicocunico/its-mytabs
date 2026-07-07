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
