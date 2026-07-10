import { describe, expect, it } from "vitest";
import { resolveTrackColor, TRACK_COLORS, trackColor } from "./styles/colors.ts";

describe("trackColor", () => {
    it("wraps around the palette by index", () => {
        expect(trackColor(0)).toBe(TRACK_COLORS[0]);
        expect(trackColor(TRACK_COLORS.length)).toBe(TRACK_COLORS[0]);
        expect(trackColor(TRACK_COLORS.length + 1)).toBe(TRACK_COLORS[1]);
    });
});

describe("resolveTrackColor", () => {
    it("falls back to the palette when the track has the default (200,0,0) colour", () => {
        const track = { color: { r: 200, g: 0, b: 0 } };
        expect(resolveTrackColor(track, 0)).toBe(TRACK_COLORS[0]);
    });

    it("falls back to the palette when the track has no colour", () => {
        expect(resolveTrackColor({ color: null }, 2)).toBe(TRACK_COLORS[2]);
        expect(resolveTrackColor(null, 3)).toBe(TRACK_COLORS[3]);
    });

    it("uses the track's own colour when it is meaningfully set", () => {
        const track = { color: { r: 51, g: 102, b: 204 } };
        expect(resolveTrackColor(track, 0)).toBe("rgb(51, 102, 204)");
    });
});
