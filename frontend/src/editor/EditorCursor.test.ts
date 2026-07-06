import { describe, expect, it } from "vitest";
import { loadTex, TEX_TWO_BARS } from "./test-utils.ts";
import { EditorCursor } from "./EditorCursor.ts";

function makeCursor() {
    const { score, settings } = loadTex(TEX_TWO_BARS);
    const cursor = new EditorCursor(() => score, 0);
    return { score, settings, cursor };
}

describe("EditorCursor", () => {
    it("starts at bar 0, beat 0, highest string", () => {
        const { cursor, score } = makeCursor();
        expect(cursor.pos.barIndex).toBe(0);
        expect(cursor.pos.beatIndex).toBe(0);
        expect(cursor.pos.string).toBe(score.tracks[0].staves[0].tuning.length);
    });

    it("resolves to the model objects at the position", () => {
        const { cursor } = makeCursor();
        cursor.pos.string = 4;
        const r = cursor.resolve()!;
        expect(r.beat.notes[0].fret).toBe(3);
        expect(r.note!.string).toBe(4);
    });

    it("moves right across the bar boundary", () => {
        const { cursor } = makeCursor();
        for (let i = 0; i < 4; i++) {
            expect(cursor.moveBeat(1)).toBe(true);
        }
        expect(cursor.pos.barIndex).toBe(1);
        expect(cursor.pos.beatIndex).toBe(0);
    });

    it("returns false when moving right past the last beat", () => {
        const { cursor } = makeCursor();
        for (let i = 0; i < 5; i++) cursor.moveBeat(1);
        expect(cursor.pos.barIndex).toBe(1);
        expect(cursor.pos.beatIndex).toBe(1);
        expect(cursor.moveBeat(1)).toBe(false); // caller decides to append a bar
    });

    it("moves left across the bar boundary to the last beat of the previous bar", () => {
        const { cursor } = makeCursor();
        for (let i = 0; i < 4; i++) cursor.moveBeat(1); // bar 1 beat 0
        expect(cursor.moveBeat(-1)).toBe(true);
        expect(cursor.pos.barIndex).toBe(0);
        expect(cursor.pos.beatIndex).toBe(3);
        expect(cursor.moveBeat(-1)).toBe(true);
        expect(cursor.pos.beatIndex).toBe(2);
    });

    it("clamps string movement to the tuning range", () => {
        const { cursor } = makeCursor();
        cursor.pos.string = 6;
        expect(cursor.moveString(1)).toBe(false);
        expect(cursor.moveString(-1)).toBe(true);
        expect(cursor.pos.string).toBe(5);
        cursor.pos.string = 1;
        expect(cursor.moveString(-1)).toBe(false);
    });

    it("moves by bar", () => {
        const { cursor } = makeCursor();
        cursor.moveBeat(1); // beat 1
        expect(cursor.moveBar(1)).toBe(true);
        expect(cursor.pos.barIndex).toBe(1);
        expect(cursor.pos.beatIndex).toBe(0);
        expect(cursor.moveBar(1)).toBe(false); // no bar 2
        expect(cursor.moveBar(-1)).toBe(true);
        expect(cursor.pos.barIndex).toBe(0);
    });

    it("toBar jumps to beat 0 of a valid bar and rejects out-of-range indices", () => {
        const { cursor } = makeCursor();
        cursor.moveBeat(1); // beat 1 of bar 0

        expect(cursor.toBar(1)).toBe(true);
        expect(cursor.pos.barIndex).toBe(1);
        expect(cursor.pos.beatIndex).toBe(0);
        expect(cursor.resolve()).not.toBeNull();

        expect(cursor.toBar(2)).toBe(false);
        expect(cursor.toBar(-1)).toBe(false);
        // failed jump leaves the cursor where it was
        expect(cursor.pos.barIndex).toBe(1);
        expect(cursor.pos.beatIndex).toBe(0);
    });

    it("clamp() snaps out-of-range indices after structural changes", () => {
        const { cursor, score } = makeCursor();
        cursor.pos.barIndex = 99;
        cursor.pos.beatIndex = 99;
        cursor.clamp();
        expect(cursor.pos.barIndex).toBe(score.masterBars.length - 1);
        const lastVoiceBeats = score.tracks[0].staves[0].bars[1].voices[0].beats;
        expect(cursor.pos.beatIndex).toBe(lastVoiceBeats.length - 1);
    });

    it("jumps to bar and score edges", () => {
        const { cursor } = makeCursor();
        cursor.moveBeat(1);
        cursor.toBarEdge("end");
        expect(cursor.pos.beatIndex).toBe(3);
        cursor.toBarEdge("start");
        expect(cursor.pos.beatIndex).toBe(0);

        cursor.toScoreEdge("end");
        expect(cursor.pos.barIndex).toBe(1);
        expect(cursor.pos.beatIndex).toBe(1);
        cursor.toScoreEdge("start");
        expect(cursor.pos.barIndex).toBe(0);
        expect(cursor.pos.beatIndex).toBe(0);
    });

    it("setFromBeat places the cursor from a clicked beat", () => {
        const { cursor, score } = makeCursor();
        const beat = score.tracks[0].staves[0].bars[1].voices[0].beats[1];
        cursor.setFromBeat(beat);
        expect(cursor.pos.barIndex).toBe(1);
        expect(cursor.pos.beatIndex).toBe(1);
    });
});
