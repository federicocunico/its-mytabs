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

    it("toggles boolean note effects at the cursor", () => {
        ctrl.cursor.pos.string = 4;
        const result = ctrl.toggleNoteEffectAtCursor("palmMute");
        expect(result.ok).toBe(true);

        const note = () => ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[0].getNoteOnString(4)!;
        expect(note().isPalmMute).toBe(true);

        ctrl.toggleNoteEffectAtCursor("palmMute");
        expect(note().isPalmMute).toBe(false);
    });

    it("rejects note effects when there is no note at the cursor", () => {
        ctrl.cursor.pos.string = 2; // free string
        const result = ctrl.toggleNoteEffectAtCursor("palmMute");
        expect(result.ok).toBe(false);
    });

    it("cycles vibrato / harmonics / accents", () => {
        ctrl.cursor.pos.string = 4;
        const note = () => ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[0].getNoteOnString(4)!;

        ctrl.cycleNoteEffectAtCursor("vibrato");
        expect(note().vibrato).toBe(1); // Slight
        ctrl.cycleNoteEffectAtCursor("vibrato");
        expect(note().vibrato).toBe(2); // Wide
        ctrl.cycleNoteEffectAtCursor("vibrato");
        expect(note().vibrato).toBe(0); // back to None

        ctrl.cycleNoteEffectAtCursor("harmonic");
        expect(note().harmonicType).toBe(1); // Natural
    });

    it("applies note and beat effects at the cursor", () => {
        ctrl.cursor.pos.string = 4;
        const ok = ctrl.applyNoteEffectAtCursor({ kind: "hammerPull", on: true });
        expect(ok.ok).toBe(true);

        const beatResult = ctrl.applyBeatEffectAtCursor({ kind: "tap", on: true });
        expect(beatResult.ok).toBe(true);
        expect(ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[0].tap).toBe(true);
    });

    it("copies, cuts and pastes beats", () => {
        ctrl.cursor.pos.string = 4;
        expect(ctrl.copyBeatAtCursor().ok).toBe(true);
        expect(ctrl.hasClipboard).toBe(true);

        ctrl.moveRight();
        ctrl.pasteBeatAtCursor();
        expect(walkBeatChain(ctrl.score)).toEqual(["3", "3", "7", "5", "3", "5"]);

        ctrl.cutBeatAtCursor(); // cut the pasted beat -> becomes rest content? No: cut removes beat
        expect(walkBeatChain(ctrl.score)).toEqual(["3", "7", "5", "r", "3", "5"]);
        ctrl.moveRight();
        ctrl.moveRight();
        ctrl.pasteBeatAtCursor(); // paste the cut beat over the rest
        expect(walkBeatChain(ctrl.score)).toEqual(["3", "7", "5", "3", "3", "5"]);
    });

    it("changes the time signature at the cursor and pads/warns bars", () => {
        const result = ctrl.setTimeSignatureAtCursor(3, 4, false);
        expect(result.ok).toBe(true);
        expect(ctrl.score.masterBars[0].timeSignatureNumerator).toBe(3);
        // the 4/4-full bar is over-full in 3/4
        expect(ctrl.barWarnings).toEqual([{ trackIndex: 0, barIndex: 0, kind: "overflow" }]);
        ctrl.undo();
        expect(ctrl.score.masterBars[0].timeSignatureNumerator).toBe(4);
    });

    it("sets tempo and section at the cursor", () => {
        expect(ctrl.setTempoAtCursor(150).ok).toBe(true);
        expect(ctrl.score.masterBars[0].tempoAutomations[0].value).toBe(150);

        expect(ctrl.setSectionAtCursor("Intro").ok).toBe(true);
        expect(ctrl.score.masterBars[0].section!.text).toBe("Intro");
    });

    it("adds, switches to and removes a track", () => {
        const result = ctrl.addTrackToScore({ name: "Bass", tuning: [43, 38, 33, 28], program: 33 });
        expect(result.ok).toBe(true);
        expect(ctrl.score.tracks.length).toBe(2);

        ctrl.changeTrack(1);
        expect(ctrl.cursor.trackIndex).toBe(1);
        ctrl.setFretAtCursor(3);
        expect(ctrl.score.tracks[1].staves[0].bars[0].voices[0].beats[0].notes.length).toBe(1);

        ctrl.removeTrackFromScore(1);
        expect(ctrl.score.tracks.length).toBe(1);
        expect(ctrl.cursor.trackIndex).toBe(0);
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
