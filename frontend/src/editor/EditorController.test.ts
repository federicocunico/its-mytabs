import { beforeEach, describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import { loadTex, scoreJson, TEX_TWO_BARS, walkBeatChain } from "./test-utils.ts";
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

    it("enters notes on multiple strings at the same beat (GP-style line editing)", () => {
        const beat = ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[0];
        const topString = ctrl.cursor.pos.string;

        ctrl.setFretAtCursor(3);
        ctrl.moveStringDown();
        ctrl.setFretAtCursor(5);
        ctrl.moveStringDown();
        ctrl.setFretAtCursor(0);

        expect(beat.getNoteOnString(topString)!.fret).toBe(3);
        expect(beat.getNoteOnString(topString - 1)!.fret).toBe(5);
        expect(beat.getNoteOnString(topString - 2)!.fret).toBe(0);
        expect(beat.notes.length).toBe(3);
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

    it("changes duration and flags the bar as over-full", () => {
        expect(ctrl.invalidBars).toEqual([]);

        ctrl.setDurationAtCursor(Duration.Half);
        expect(ctrl.invalidBars).toEqual([{ barIndex: 0, state: "over" }]);

        ctrl.undo();
        expect(ctrl.invalidBars).toEqual([]);
    });

    it("flags under-full bars from freshly loaded files", () => {
        const { score, settings } = loadTex(`\\ts 4 4 3.3.4 | 3.3.4 5.3.4 7.3.4 5.3.4`);
        const h = makeHost();
        const c = new EditorController(h);
        c.attach(score, settings, 0);

        expect(c.invalidBars).toEqual([{ barIndex: 0, state: "under" }]);

        // Editing the bar pads it with rests -> becomes valid
        c.setFretAtCursor(5);
        expect(c.invalidBars).toEqual([]);
    });

    it("moveRight at the end of the score appends a new bar", () => {
        for (let i = 0; i < 5; i++) ctrl.moveRight();
        expect(ctrl.score.masterBars.length).toBe(2);

        ctrl.moveRight(); // at last beat -> appends bar 3
        expect(ctrl.score.masterBars.length).toBe(3);
        expect(ctrl.cursor.pos.barIndex).toBe(2);
        expect(ctrl.cursor.pos.beatIndex).toBe(0);
    });

    it("moveToBar jumps to beat 0 of the bar and notifies the host", () => {
        const stateBefore = host.stateChanges;
        ctrl.moveRight();

        ctrl.moveToBar(1);
        expect(ctrl.cursor.pos.barIndex).toBe(1);
        expect(ctrl.cursor.pos.beatIndex).toBe(0);
        expect(host.stateChanges).toBeGreaterThan(stateBefore);

        ctrl.moveToBar(99); // out of range -> no-op
        expect(ctrl.cursor.pos.barIndex).toBe(1);
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

    it("toggles tapping at the cursor", () => {
        const beat = () => ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[0];
        expect(ctrl.toggleTapAtCursor().ok).toBe(true);
        expect(beat().tap).toBe(true);
        expect(ctrl.toggleTapAtCursor().ok).toBe(true);
        expect(beat().tap).toBe(false);
    });

    it("cycles grace notes none -> before beat -> on beat -> none", () => {
        const beat = () => ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[0];
        ctrl.cycleGraceAtCursor();
        expect(beat().graceType).toBe(2); // BeforeBeat
        ctrl.cycleGraceAtCursor();
        expect(beat().graceType).toBe(1); // OnBeat
        ctrl.cycleGraceAtCursor();
        expect(beat().graceType).toBe(0); // None
    });

    it("toggles shift/legato slides and swaps between them", () => {
        ctrl.cursor.pos.string = 4;
        const note = () => ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[0].getNoteOnString(4)!;

        expect(ctrl.toggleSlideOutAtCursor(1).ok).toBe(true); // Shift
        expect(note().slideOutType).toBe(1);
        expect(ctrl.toggleSlideOutAtCursor(2).ok).toBe(true); // switch to Legato
        expect(note().slideOutType).toBe(2);
        expect(ctrl.toggleSlideOutAtCursor(2).ok).toBe(true); // toggle off
        expect(note().slideOutType).toBe(0);
    });

    it("rejects slide toggles when there is no note at the cursor", () => {
        ctrl.cursor.pos.string = 2; // free string
        const result = ctrl.toggleSlideOutAtCursor(1);
        expect(result.ok).toBe(false);
        expect(ctrl.canUndo).toBe(false);
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

    it("changes the time signature at the cursor and flags over-full bars", () => {
        const result = ctrl.setTimeSignatureAtCursor(3, 4, false);
        expect(result.ok).toBe(true);
        expect(ctrl.score.masterBars[0].timeSignatureNumerator).toBe(3);
        // the 4/4-full bar is over-full in 3/4
        expect(ctrl.invalidBars).toEqual([{ barIndex: 0, state: "over" }]);
        ctrl.undo();
        expect(ctrl.score.masterBars[0].timeSignatureNumerator).toBe(4);
        expect(ctrl.invalidBars).toEqual([]);
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

    it("reorders tracks, keeps the cursor on the edited track, and is undoable", () => {
        const orig = ctrl.score.tracks[0].name;
        ctrl.addTrackToScore({ name: "Bass", tuning: [43, 38, 33, 28], program: 33 });
        ctrl.addTrackToScore({ name: "Piano", tuning: [64, 59, 55, 50, 45, 40], program: 0 });
        expect(ctrl.score.tracks.map((t) => t.name)).toEqual([orig, "Bass", "Piano"]);

        // Edit the Bass track (index 1) so we can prove its content follows the move.
        ctrl.changeTrack(1);
        ctrl.setFretAtCursor(7);

        // Move Bass (1) to the front (0).
        expect(ctrl.moveTrackFromTo(1, 0).ok).toBe(true);
        expect(ctrl.score.tracks.map((t) => t.name)).toEqual(["Bass", orig, "Piano"]);
        expect(ctrl.cursor.trackIndex).toBe(0); // cursor followed Bass to its new index
        expect(ctrl.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes.length).toBe(1);

        // Undo restores the original order.
        expect(ctrl.undo().ok).toBe(true);
        expect(ctrl.score.tracks.map((t) => t.name)).toEqual([orig, "Bass", "Piano"]);
    });

    describe("track/voice switch cursor pinning", () => {
        beforeEach(() => {
            ctrl.addTrackToScore({ name: "Bass", tuning: [43, 38, 33, 28], program: 33 }); // 4-string
        });

        it("changeTrack clamps a 6-string cursor onto the 4-string track and notifies the host", () => {
            ctrl.cursor.pos.string = 6;
            const replacedBefore = host.replaced;
            const stateBefore = host.stateChanges;

            ctrl.changeTrack(1);

            expect(ctrl.cursor.trackIndex).toBe(1);
            expect(ctrl.cursor.pos.string).toBeLessThanOrEqual(4);
            expect(ctrl.cursor.resolve()).not.toBeNull();
            expect(host.replaced).toBe(replacedBefore + 1);
            expect(host.stateChanges).toBe(stateBefore + 1);
        });

        it("setVoice on a single-voice bar clamps back into range", () => {
            ctrl.setVoice(3);
            expect(ctrl.cursor.resolve()).not.toBeNull();
            const r = ctrl.cursor.resolve()!;
            expect(r.voice.index).toBeLessThan(r.bar.voices.length);
        });

        it("removing the current track leaves a valid cursor", () => {
            ctrl.changeTrack(1);
            ctrl.cursor.pos.beatIndex = 2;
            const result = ctrl.removeTrackFromScore(1);
            expect(result.ok).toBe(true);
            expect(ctrl.cursor.trackIndex).toBe(0);
            expect(ctrl.cursor.resolve()).not.toBeNull();
        });

        it("fret entry works right after switching to the smaller track", () => {
            ctrl.cursor.pos.string = 6;
            ctrl.changeTrack(1);
            const result = ctrl.setFretAtCursor(5);
            expect(result.ok).toBe(true);
            expect(ctrl.cursor.resolve()!.beat.notes.length).toBe(1);
        });
    });

    it("cursorBarIsRestOnly computes from live beats (delete-bar confirmation)", () => {
        expect(ctrl.cursorBarIsRestOnly()).toBe(false);

        for (let i = 0; i < 4; i++) {
            ctrl.cursor.pos.beatIndex = i;
            ctrl.toggleRestAtCursor();
        }
        ctrl.cursor.pos.beatIndex = 0;
        expect(ctrl.cursorBarIsRestOnly()).toBe(true);

        ctrl.moveToBar(1);
        expect(ctrl.cursorBarIsRestOnly()).toBe(false);
    });

    it("survives snapshots and export with UI bar styles applied", () => {
        // The page marks invalid bars via bar.style; that must not corrupt undo or export
        const bar = ctrl.score.tracks[0].staves[0].bars[0];
        bar.style = new alphaTab.model.BarStyle();
        bar.style.colors.set(alphaTab.model.BarSubElement.StandardNotationBarNumber, alphaTab.model.Color.fromJson("#dc3545"));

        ctrl.cursor.pos.string = 4;
        ctrl.setFretAtCursor(12);
        ctrl.undo();
        ctrl.redo();

        const bytes = ctrl.exportGp();
        const reloaded = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, new alphaTab.Settings());
        expect(reloaded.tracks[0].staves[0].bars[0].voices[0].beats[0].getNoteOnString(4)!.fret).toBe(12);
    });

    describe("rest/beat deletion semantics", () => {
        /** Assert a command was rejected with feedback and left no trace in score or history. */
        function expectCleanRejection(c: EditorController, fn: () => ReturnType<EditorController["deleteNoteAtCursor"]>, messagePart: string) {
            const undoBefore = c.canUndo;
            const jsonBefore = scoreJson(c.score);
            const result = fn();
            expect(result.ok).toBe(false);
            expect(result.message).toContain(messagePart);
            expect(c.canUndo).toBe(undoBefore);
            expect(scoreJson(c.score)).toBe(jsonBefore);
        }

        it("Del on a mid-bar rest deletes the beat and shifts content left", () => {
            const { score, settings } = loadTex(`\\ts 4 4 3.3.4 r.4 5.3.4 7.3.4 | 3.3.4 5.3.4 7.3.4 5.3.4`);
            const c = new EditorController(makeHost());
            c.attach(score, settings, 0);
            c.cursor.pos.beatIndex = 1;

            const result = c.deleteNoteAtCursor();
            expect(result.ok).toBe(true);
            // rest gone, later beats shifted left, tail re-padded
            expect(walkBeatChain(c.score).slice(0, 4)).toEqual(["3", "5", "7", "r"]);
        });

        it("Del on a note string that has no note is rejected with feedback", () => {
            ctrl.cursor.pos.string = 2; // beat has notes, but not on this string
            expectCleanRejection(ctrl, () => ctrl.deleteNoteAtCursor(), "No note on this string");
        });

        it("Del on a trailing pad rest is rejected with an explanation", () => {
            const { score, settings } = loadTex(`\\ts 4 4 3.3.4 5.3.4 r.4 r.4 | 3.3.4 5.3.4 7.3.4 5.3.4`);
            const c = new EditorController(makeHost());
            c.attach(score, settings, 0);
            c.cursor.pos.beatIndex = 3;
            expectCleanRejection(c, () => c.deleteNoteAtCursor(), "Trailing rests");
        });

        it("Shift+Del on a trailing pad rest is rejected the same way", () => {
            const { score, settings } = loadTex(`\\ts 4 4 3.3.4 5.3.4 r.4 r.4 | 3.3.4 5.3.4 7.3.4 5.3.4`);
            const c = new EditorController(makeHost());
            c.attach(score, settings, 0);
            c.cursor.pos.beatIndex = 2;
            expectCleanRejection(c, () => c.deleteBeatAtCursor(), "Trailing rests");
        });

        it("Del and Shift+Del on a lone full-bar rest are rejected as 'already empty'", () => {
            const { score, settings } = loadTex(`\\ts 4 4 r.1 | 3.3.4 5.3.4 7.3.4 5.3.4`);
            const c = new EditorController(makeHost());
            c.attach(score, settings, 0);
            expectCleanRejection(c, () => c.deleteNoteAtCursor(), "Bar is already empty");
            expectCleanRejection(c, () => c.deleteBeatAtCursor(), "Bar is already empty");
        });

        it("Shift+Del still deletes a trailing rest of an over-full bar", () => {
            const { score, settings } = loadTex(`\\ts 4 4 3.3.4 5.3.4 7.4.4 5.2.4 | 3.3.4 5.3.4 7.3.4 5.3.4`);
            const c = new EditorController(makeHost());
            c.attach(score, settings, 0);
            c.setDurationAtCursor(alphaTab.model.Duration.Half); // bar 0 now 5/4 over-full
            // The pad rest at the end is real overflow now — deleting it fixes the bar.
            c.cursor.pos.beatIndex = 3;
            c.setDurationAtCursor(alphaTab.model.Duration.Quarter);
            c.toggleRestAtCursor();
            expect(c.invalidBars).toEqual([{ barIndex: 0, state: "over" }]);
            const result = c.deleteBeatAtCursor();
            expect(result.ok).toBe(true);
            expect(c.invalidBars).toEqual([]);
        });

        it("R on a rest is rejected with feedback instead of a silent no-op", () => {
            const { score, settings } = loadTex(`\\ts 4 4 3.3.4 r.4 5.3.4 7.3.4 | 3.3.4 5.3.4 7.3.4 5.3.4`);
            const c = new EditorController(makeHost());
            c.attach(score, settings, 0);
            c.cursor.pos.beatIndex = 1;
            expectCleanRejection(c, () => c.toggleRestAtCursor(), "already a rest");
        });

        it("R on a note beat still makes it a rest", () => {
            const result = ctrl.toggleRestAtCursor();
            expect(result.ok).toBe(true);
            expect(walkBeatChain(ctrl.score)[0]).toBe("r");
        });
    });

    it("clamps the cursor before notifying the host (delete last beat of an over-full bar)", () => {
        // Over-full bars are not re-padded on delete, so the beat count really
        // shrinks and a cursor on the last beat becomes stale. The host reads
        // cursor state inside its callbacks (overlay positioning, status bar) —
        // it must never observe an unresolvable cursor.
        const failures: string[] = [];
        const check = (event: string) => {
            if (ctrl.cursor.resolve() === null) {
                failures.push(event);
            }
        };
        host.requestRender = () => check("requestRender");
        host.onScoreReplaced = () => check("onScoreReplaced");
        host.onStateChanged = () => check("onStateChanged");

        ctrl.setDurationAtCursor(Duration.Half); // bar 0: h q q q = 5/4, over-full
        expect(ctrl.invalidBars).toEqual([{ barIndex: 0, state: "over" }]);

        ctrl.cursor.pos.beatIndex = 3; // last beat of bar 0
        failures.length = 0;

        const result = ctrl.deleteBeatAtCursor(); // 4/4 exactly full -> no re-pad, beat 3 gone
        expect(result.ok).toBe(true);
        expect(failures).toEqual([]);
        expect(ctrl.cursor.resolve()).not.toBeNull();

        // Structural path: deleting the last bar must also keep every notification resolvable.
        ctrl.cursor.pos.barIndex = 1;
        ctrl.cursor.pos.beatIndex = 1;
        failures.length = 0;
        expect(ctrl.deleteBarAtCursor().ok).toBe(true);
        expect(failures).toEqual([]);
        expect(ctrl.cursor.resolve()).not.toBeNull();
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
