import { describe, expect, it } from "vitest";
import { loadTex, TEX_TWO_BARS, voice0 } from "./test-utils.ts";
import { assertFret, assertString, EditorValidationError, findTieOriginNote, MAX_FRET } from "./validation.ts";

describe("assertFret", () => {
    it("accepts 0..MAX_FRET", () => {
        expect(() => assertFret(0)).not.toThrow();
        expect(() => assertFret(MAX_FRET)).not.toThrow();
    });

    it("rejects negatives, floats and beyond MAX_FRET", () => {
        expect(() => assertFret(-1)).toThrow(EditorValidationError);
        expect(() => assertFret(2.5)).toThrow(EditorValidationError);
        expect(() => assertFret(MAX_FRET + 1)).toThrow(EditorValidationError);
    });
});

describe("assertString", () => {
    it("accepts strings within the staff tuning", () => {
        const { score } = loadTex(TEX_TWO_BARS);
        const staff = score.tracks[0].staves[0];
        expect(() => assertString(staff, 1)).not.toThrow();
        expect(() => assertString(staff, staff.tuning.length)).not.toThrow();
    });

    it("rejects strings outside the tuning", () => {
        const { score } = loadTex(TEX_TWO_BARS);
        const staff = score.tracks[0].staves[0];
        expect(() => assertString(staff, 0)).toThrow(EditorValidationError);
        expect(() => assertString(staff, staff.tuning.length + 1)).toThrow(EditorValidationError);
    });
});

describe("findTieOriginNote", () => {
    // TEX_TWO_BARS bar 0 beats (model strings): 3@s4, 5@s4, 7@s3, 5@s5
    it("finds the previous note on the same string", () => {
        const { score } = loadTex(TEX_TWO_BARS);
        const beats = voice0(score, 0).beats;
        const origin = findTieOriginNote(beats[1], 4);
        expect(origin).not.toBeNull();
        expect(origin!.fret).toBe(3);
    });

    it("walks across intermediate beats without a note on the string", () => {
        const { score } = loadTex(TEX_TWO_BARS);
        const beats = voice0(score, 0).beats;
        // beat 3 (5@s5): looking for string 4 walks back past beat 2 (7@s3) to beat 1 (5@s4)
        const origin = findTieOriginNote(beats[3], 4);
        expect(origin).not.toBeNull();
        expect(origin!.fret).toBe(5);
    });

    it("finds origins across bar boundaries", () => {
        const { score } = loadTex(TEX_TWO_BARS);
        const bar1beats = voice0(score, 1).beats;
        const origin = findTieOriginNote(bar1beats[0], 5);
        expect(origin).not.toBeNull();
        expect(origin!.fret).toBe(5); // last beat of bar 0 on string 5
    });

    it("returns null when no origin exists", () => {
        const { score } = loadTex(TEX_TWO_BARS);
        const beats = voice0(score, 0).beats;
        expect(findTieOriginNote(beats[0], 4)).toBeNull(); // first beat of song
        expect(findTieOriginNote(beats[1], 2)).toBeNull(); // no note ever on string 2
    });
});
