import { describe, expect, it } from "vitest";
import { loadTex, TEX_TWO_BARS, voice0 } from "../test-utils.ts";
import { removeNoteOnString, setNoteFret, toggleTie } from "./note.ts";
import { normalizeScore } from "../normalize.ts";
import { EditorValidationError } from "../validation.ts";

describe("setNoteFret", () => {
    it("updates the fret of an existing note on the string", () => {
        const { score } = loadTex(TEX_TWO_BARS);
        const beat = voice0(score, 0).beats[0]; // 3@s4 (model numbering)

        const note = setNoteFret(beat, 4, 12);

        expect(note.fret).toBe(12);
        expect(beat.notes.length).toBe(1);
    });

    it("adds a note when the string is free", () => {
        const { score } = loadTex(TEX_TWO_BARS);
        const beat = voice0(score, 0).beats[0]; // 3@s4 (model numbering)

        const note = setNoteFret(beat, 5, 0);

        expect(beat.notes.length).toBe(2);
        expect(note.string).toBe(5);
        expect(note.fret).toBe(0);
        expect(beat.hasNoteOnString(5)).toBe(true);
    });

    it("converts a rest beat into a note beat", () => {
        const { score, settings } = loadTex(`\\ts 4 4 3.3.4 r.4 r.2`);
        const beat = voice0(score, 0).beats[1];
        expect(beat.isRest).toBe(true);

        setNoteFret(beat, 4, 7);
        normalizeScore(score, settings, [beat.voice.bar]);

        expect(beat.isRest).toBe(false);
        expect(beat.notes[0].fret).toBe(7);
    });

    it("rejects invalid frets and strings", () => {
        const { score } = loadTex(TEX_TWO_BARS);
        const beat = voice0(score, 0).beats[0];
        expect(() => setNoteFret(beat, 3, -1)).toThrow(EditorValidationError);
        expect(() => setNoteFret(beat, 9, 5)).toThrow(EditorValidationError);
    });
});

describe("removeNoteOnString", () => {
    it("removes the note on the given string", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const beat = voice0(score, 0).beats[0];

        const removed = removeNoteOnString(beat, 4);
        normalizeScore(score, settings, [beat.voice.bar]);

        expect(removed).toBe(true);
        expect(beat.notes.length).toBe(0);
        expect(beat.isRest).toBe(true); // empty beat renders as rest
    });

    it("returns false when there is nothing to remove", () => {
        const { score } = loadTex(TEX_TWO_BARS);
        const beat = voice0(score, 0).beats[0];
        expect(removeNoteOnString(beat, 6)).toBe(false);
    });
});

describe("toggleTie", () => {
    it("ties to the previous note on the same string and copies its fret", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const beat = voice0(score, 0).beats[1]; // 5@s4, previous is 3@s4

        toggleTie(beat, 4, true);
        normalizeScore(score, settings, [beat.voice.bar]);

        const note = beat.getNoteOnString(4)!;
        expect(note.isTieDestination).toBe(true);
        expect(note.fret).toBe(3); // fret copied from origin
        expect(note.tieOrigin).not.toBeNull();
        expect(note.tieOrigin!.fret).toBe(3);
    });

    it("creates the destination note if the string is free", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const beat = voice0(score, 0).beats[2]; // 7@s3; string 4 free, origin is 5@s4

        toggleTie(beat, 4, true);
        normalizeScore(score, settings, [beat.voice.bar]);

        const note = beat.getNoteOnString(4)!;
        expect(note.isTieDestination).toBe(true);
        expect(note.fret).toBe(5);
    });

    it("unties", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const beat = voice0(score, 0).beats[1];
        toggleTie(beat, 4, true);
        normalizeScore(score, settings, [beat.voice.bar]);

        toggleTie(beat, 4, false);
        normalizeScore(score, settings, [beat.voice.bar]);

        expect(beat.getNoteOnString(4)!.isTieDestination).toBe(false);
    });

    it("rejects a tie with no possible origin", () => {
        const { score } = loadTex(TEX_TWO_BARS);
        const beat = voice0(score, 0).beats[0]; // first beat of song
        expect(() => toggleTie(beat, 4, true)).toThrow(EditorValidationError);
    });
});
