import { beforeEach, describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import { loadTex, TEX_TWO_BARS, walkBeatChain } from "./test-utils.ts";
import { EditorController, type EditorHost } from "./EditorController.ts";

const { Duration } = alphaTab.model;

interface TestHost extends EditorHost {
    renders: number;
    replaced: number;
    stateChanges: number;
}

function makeHost(): TestHost {
    return {
        renders: 0,
        replaced: 0,
        stateChanges: 0,
        requestRender() {
            this.renders++;
        },
        onScoreReplaced() {
            this.replaced++;
        },
        onStateChanged() {
            this.stateChanges++;
        },
    };
}

describe("EditorController", () => {
    let host: TestHost;
    let ctrl: EditorController;

    beforeEach(() => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        host = makeHost();
        ctrl = new EditorController(host);
        ctrl.attach(score, settings, 0);
    });

    it("types a fret at the cursor and marks dirty", () => {
        ctrl.cursor.pos.string = 4;
        const result = ctrl.setFretAtCursor(12);

        expect(result.ok).toBe(true);
        expect(ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[0].getNoteOnString(4)!.fret).toBe(12);
        expect(ctrl.dirty).toBe(true);
        expect(host.renders).toBe(1);
    });

    it("rejects invalid input without consuming undo history", () => {
        const result = ctrl.setFretAtCursor(99);
        expect(result.ok).toBe(false);
        expect(result.message).toBeTruthy();
        expect(ctrl.canUndo).toBe(false);
        expect(ctrl.dirty).toBe(false);
    });

    it("undo/redo round-trips an edit", () => {
        ctrl.cursor.pos.string = 4;
        ctrl.setFretAtCursor(12);

        ctrl.undo();
        expect(ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[0].getNoteOnString(4)!.fret).toBe(3);
        expect(host.replaced).toBe(1); // undo swaps the score instance

        ctrl.redo();
        expect(ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[0].getNoteOnString(4)!.fret).toBe(12);
        expect(ctrl.canRedo).toBe(false);
    });

    it("deletes the note at the cursor; empty beat becomes a rest", () => {
        ctrl.cursor.pos.string = 4;
        ctrl.deleteNoteAtCursor();
        expect(walkBeatChain(ctrl.score)[0]).toBe("r");
    });

    it("deletes the beat at the cursor and pads the bar", () => {
        ctrl.deleteBeatAtCursor();
        expect(walkBeatChain(ctrl.score)).toEqual(["5", "7", "5", "r", "3", "5"]);
    });

    it("inserts a rest beat before the cursor", () => {
        ctrl.insertBeatAtCursor();
        expect(walkBeatChain(ctrl.score).slice(0, 5)).toEqual(["r", "3", "5", "7", "5"]);
    });

    it("changes duration and reports bar overflow warnings", () => {
        ctrl.setDurationAtCursor(Duration.Half);
        expect(ctrl.barWarnings).toEqual([{ trackIndex: 0, barIndex: 0, kind: "overflow" }]);
    });

    it("moveRight at the end of the score appends a new bar", () => {
        for (let i = 0; i < 5; i++) ctrl.moveRight();
        expect(ctrl.score.masterBars.length).toBe(2);

        ctrl.moveRight(); // at last beat -> appends bar 3
        expect(ctrl.score.masterBars.length).toBe(3);
        expect(ctrl.cursor.pos.barIndex).toBe(2);
        expect(ctrl.cursor.pos.beatIndex).toBe(0);
    });

    it("insert/delete bar keep the cursor valid", () => {
        ctrl.insertBarAtCursor();
        expect(ctrl.score.masterBars.length).toBe(3);
        expect(walkBeatChain(ctrl.score)).toEqual(["r", "3", "5", "7", "5", "3", "5"]);

        ctrl.deleteBarAtCursor();
        ctrl.deleteBarAtCursor();
        expect(ctrl.score.masterBars.length).toBe(1);
        expect(ctrl.cursor.pos.barIndex).toBe(0);

        const result = ctrl.deleteBarAtCursor(); // only one bar left
        expect(result.ok).toBe(false);
    });

    it("undo restores bar structure after a structural edit", () => {
        ctrl.insertBarAtCursor();
        expect(ctrl.score.masterBars.length).toBe(3);
        ctrl.undo();
        expect(ctrl.score.masterBars.length).toBe(2);
        expect(walkBeatChain(ctrl.score)).toEqual(["3", "5", "7", "5", "3", "5"]);
    });

    it("toggles rest and dot", () => {
        ctrl.toggleRestAtCursor();
        expect(walkBeatChain(ctrl.score)[0]).toBe("r");

        ctrl.toggleDotAtCursor();
        expect(ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[0].dots).toBe(1);
        ctrl.toggleDotAtCursor();
        expect(ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[0].dots).toBe(0);
    });

    it("ties at cursor", () => {
        ctrl.moveRight();
        ctrl.cursor.pos.string = 4;
        const result = ctrl.toggleTieAtCursor();
        expect(result.ok).toBe(true);
        const note = ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[1].getNoteOnString(4)!;
        expect(note.isTieDestination).toBe(true);
    });

    it("reports bar fill for the status bar", () => {
        const fill = ctrl.barFill();
        expect(fill).toEqual({ used: 3840, capacity: 3840 });
    });

    it("exports the edited score as GP bytes", () => {
        ctrl.cursor.pos.string = 4;
        ctrl.setFretAtCursor(12);
        const bytes = ctrl.exportGp();
        expect(bytes.length).toBeGreaterThan(0);

        const settings = new alphaTab.Settings();
        const reloaded = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
        expect(reloaded.tracks[0].staves[0].bars[0].voices[0].beats[0].notes.some((n) => n.fret === 12)).toBe(true);
    });
});
