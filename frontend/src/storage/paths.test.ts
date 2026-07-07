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
