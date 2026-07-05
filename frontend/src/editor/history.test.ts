import { describe, expect, it } from "vitest";
import { loadTex, scoreJson, TEX_TWO_BARS, voice0 } from "./test-utils.ts";
import { SnapshotHistory } from "./history.ts";
import { setNoteFret } from "./mutations/note.ts";
import { normalizeScore } from "./normalize.ts";

describe("SnapshotHistory", () => {
    it("undo restores the state before the last checkpoint", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const history = new SnapshotHistory();
        const before = scoreJson(score);

        history.checkpoint(score);
        setNoteFret(voice0(score, 0).beats[0], 4, 12);
        normalizeScore(score, settings, [voice0(score, 0).bar]);

        const restored = history.undo(score, settings);
        expect(restored).not.toBeNull();
        expect(scoreJson(restored!)).toBe(before);
        expect(restored!.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(3);
    });

    it("redo re-applies the undone state", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const history = new SnapshotHistory();

        history.checkpoint(score);
        setNoteFret(voice0(score, 0).beats[0], 4, 12);
        normalizeScore(score, settings, [voice0(score, 0).bar]);
        const afterEdit = scoreJson(score);

        const undone = history.undo(score, settings)!;
        const redone = history.redo(undone, settings);

        expect(redone).not.toBeNull();
        expect(scoreJson(redone!)).toBe(afterEdit);
    });

    it("a new checkpoint clears the redo stack", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const history = new SnapshotHistory();

        history.checkpoint(score);
        setNoteFret(voice0(score, 0).beats[0], 4, 12);
        const undone = history.undo(score, settings)!;
        expect(history.canRedo).toBe(true);

        history.checkpoint(undone);
        expect(history.canRedo).toBe(false);
    });

    it("returns null when there is nothing to undo/redo", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const history = new SnapshotHistory();
        expect(history.canUndo).toBe(false);
        expect(history.undo(score, settings)).toBeNull();
        expect(history.redo(score, settings)).toBeNull();
    });

    it("caps the undo depth", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const history = new SnapshotHistory(2);

        history.checkpoint(score); // state A
        setNoteFret(voice0(score, 0).beats[0], 4, 10);
        history.checkpoint(score); // state B
        setNoteFret(voice0(score, 0).beats[0], 4, 11);
        history.checkpoint(score); // state C -> A falls off
        setNoteFret(voice0(score, 0).beats[0], 4, 12);

        let current = score;
        current = history.undo(current, settings)!; // -> C (fret 11)
        current = history.undo(current, settings)!; // -> B (fret 10)
        expect(history.canUndo).toBe(false);
        expect(current.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(10);
    });
});
