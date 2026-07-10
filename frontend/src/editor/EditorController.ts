/**
 * Session facade of the editing engine. Framework-free: the Vue layer talks to
 * it through method calls and the EditorHost callbacks.
 *
 * Every user-visible edit is one transaction: checkpoint -> mutate ->
 * normalize -> render request. Failed validation discards the checkpoint and
 * leaves the score untouched.
 */
import * as alphaTab from "@coderline/alphatab";
import { EditorCursor } from "./EditorCursor.ts";
import { SnapshotHistory } from "./history.ts";
import { type BarFillState, beatTicks, checkBarFill, isBarRestOnly, isRedundantTrailingRest, normalizeScore, rebuildScore } from "./normalize.ts";
import { EditorValidationError } from "./validation.ts";
import { removeNoteOnString, setNoteFret, toggleTie } from "./mutations/note.ts";
import { applyBeatData, type BeatData, deleteBeat, insertBeatAt, makeRest, serializeBeat, setBeatDots, setBeatDuration } from "./mutations/beat.ts";
import { appendBar, deleteBar, insertBar } from "./mutations/bar.ts";
import { type BeatEffect, type NoteEffect, setBeatEffect, setNoteEffect } from "./mutations/effects.ts";
import {
    addTrack,
    indexAfterMove,
    moveTrack,
    removeTrack,
    renameTrack,
    setKeySignature,
    setRepeat,
    setSection,
    setStaffTuning,
    setTempo,
    setTimeSignature,
    setTrackColor,
    setTrackProgram,
    setTripletFeel,
    type TrackTemplate,
} from "./mutations/structure.ts";

type Score = alphaTab.model.Score;
type Settings = alphaTab.Settings;
type Bar = alphaTab.model.Bar;

const { Duration } = alphaTab.model;

/** Callbacks into the hosting UI layer. */
export interface EditorHost {
    /** A (coalesced) re-render of the current score instance is needed. */
    requestRender(): void;
    /** The score object graph was replaced (undo/redo/structural rebuild) — re-render with the new instance. */
    onScoreReplaced(score: Score): void;
    /** Dirty/undo/warning state changed — refresh reactive UI state. */
    onStateChanged(): void;
}

export interface CommandResult {
    ok: boolean;
    message?: string;
}

const OK: CommandResult = { ok: true };

/** Duration steps used by "longer/shorter duration" commands. */
const DURATION_STEPS: alphaTab.model.Duration[] = [
    Duration.Whole,
    Duration.Half,
    Duration.Quarter,
    Duration.Eighth,
    Duration.Sixteenth,
    Duration.ThirtySecond,
    Duration.SixtyFourth,
];

export class EditorController {
    score!: Score;
    settings!: Settings;
    cursor!: EditorCursor;

    dirty = false;

    /** Bars of the edited staff whose content doesn't match the time signature. */
    invalidBars: Array<{ barIndex: number; state: Exclude<BarFillState, "ok"> }> = [];

    private history = new SnapshotHistory();
    private attached = false;

    constructor(private readonly host: EditorHost) {}

    attach(score: Score, settings: Settings, trackIndex: number): void {
        this.score = score;
        this.settings = settings;
        this.cursor = new EditorCursor(() => this.score, trackIndex);
        this.history.clear();
        this.dirty = false;
        this.attached = true;
        this.refreshValidation();
        this.host.onStateChanged();
    }

    detach(): void {
        this.attached = false;
        this.history.clear();
    }

    get canUndo(): boolean {
        return this.history.canUndo;
    }

    get canRedo(): boolean {
        return this.history.canRedo;
    }

    // ---- transactions ----------------------------------------------------

    /**
     * Run one undoable edit.
     * @param opts.structural the edit invalidates object identity: the score is
     *   rebuilt through the serializer and the host must swap instances.
     * @param opts.skipNormalize bar splices leave stale indices/links behind and
     *   running finish() on that graph would crash — skip straight to the rebuild
     *   (which re-runs the whole importer pipeline on a clean graph).
     */
    private transact(fn: (touched: Set<Bar>) => void, opts: { structural?: boolean; skipNormalize?: boolean } = {}): CommandResult {
        if (!this.attached) {
            return { ok: false, message: "Editor not attached" };
        }

        this.history.checkpoint(this.score);
        const touched = new Set<Bar>();
        try {
            fn(touched);
        } catch (e) {
            this.history.discardCheckpoint();
            if (e instanceof EditorValidationError) {
                return { ok: false, message: e.message };
            }
            throw e;
        }

        if (!opts.skipNormalize) {
            normalizeScore(this.score, this.settings, touched);
        }

        if (opts.structural) {
            this.replaceScore(rebuildScore(this.score, this.settings));
        } else {
            // The mutation may have removed the beat under the cursor; clamp
            // before any host callback can observe an unresolvable cursor.
            this.cursor.clamp();
            this.refreshValidation();
            this.host.requestRender();
        }

        this.dirty = true;
        this.host.onStateChanged();
        return OK;
    }

    private replaceScore(score: Score): void {
        this.score = score;
        this.cursor.clamp();
        this.refreshValidation();
        this.host.onScoreReplaced(score);
    }

    /** Recompute per-bar time-signature validation for the edited staff. */
    private refreshValidation(): void {
        this.invalidBars = [];
        const staff = this.score.tracks[this.cursor.trackIndex]?.staves[this.cursor.staffIndex];
        if (!staff) {
            return;
        }
        for (const bar of staff.bars) {
            const state = checkBarFill(bar);
            if (state !== "ok") {
                this.invalidBars.push({ barIndex: bar.index, state });
            }
        }
    }

    undo(): CommandResult {
        const restored = this.history.undo(this.score, this.settings);
        if (!restored) {
            return { ok: false, message: "Nothing to undo" };
        }
        this.replaceScore(restored);
        this.dirty = true;
        this.host.onStateChanged();
        return OK;
    }

    redo(): CommandResult {
        const restored = this.history.redo(this.score, this.settings);
        if (!restored) {
            return { ok: false, message: "Nothing to redo" };
        }
        this.replaceScore(restored);
        this.dirty = true;
        this.host.onStateChanged();
        return OK;
    }

    // ---- note commands ----------------------------------------------------

    setFretAtCursor(fret: number): CommandResult {
        return this.transact((touched) => {
            const r = this.requireCursor();
            setNoteFret(r.beat, this.cursor.pos.string, fret);
            touched.add(r.bar);
        });
    }

    /** Del: remove the note on the cursor string; on a rest, delete the beat itself. */
    deleteNoteAtCursor(): CommandResult {
        const r = this.cursor.resolve();
        if (!r) {
            return { ok: false, message: "No beat at cursor" };
        }
        if (r.beat.isRest) {
            return this.deleteBeatAtCursor();
        }
        if (!r.beat.getNoteOnString(this.cursor.pos.string)) {
            return { ok: false, message: "No note on this string" };
        }
        return this.transact((touched) => {
            const t = this.requireCursor();
            removeNoteOnString(t.beat, this.cursor.pos.string);
            touched.add(t.bar);
        });
    }

    toggleTieAtCursor(): CommandResult {
        return this.transact((touched) => {
            const r = this.requireCursor();
            const note = r.beat.getNoteOnString(this.cursor.pos.string);
            toggleTie(r.beat, this.cursor.pos.string, !(note?.isTieDestination));
            touched.add(r.bar);
        });
    }

    // ---- beat commands ----------------------------------------------------

    setDurationAtCursor(duration: alphaTab.model.Duration): CommandResult {
        return this.transact((touched) => {
            const r = this.requireCursor();
            setBeatDuration(r.beat, duration);
            touched.add(r.bar);
        });
    }

    /** +1 = longer (eighth -> quarter), -1 = shorter (quarter -> eighth). */
    stepDurationAtCursor(step: 1 | -1): CommandResult {
        const r = this.cursor.resolve();
        if (!r) {
            return { ok: false, message: "No beat at cursor" };
        }
        const index = DURATION_STEPS.indexOf(r.beat.duration);
        const target = index - step;
        if (index < 0 || target < 0 || target >= DURATION_STEPS.length) {
            return { ok: false, message: "Duration limit reached" };
        }
        return this.setDurationAtCursor(DURATION_STEPS[target]);
    }

    toggleDotAtCursor(): CommandResult {
        return this.transact((touched) => {
            const r = this.requireCursor();
            setBeatDots(r.beat, r.beat.dots === 0 ? 1 : 0);
            touched.add(r.bar);
        });
    }

    toggleRestAtCursor(): CommandResult {
        const r = this.cursor.resolve();
        if (!r) {
            return { ok: false, message: "No beat at cursor" };
        }
        if (r.beat.isRest) {
            return { ok: false, message: "Beat is already a rest" };
        }
        return this.transact((touched) => {
            const t = this.requireCursor();
            makeRest(t.beat);
            touched.add(t.bar);
        });
    }

    insertBeatAtCursor(): CommandResult {
        return this.transact((touched) => {
            const r = this.requireCursor();
            insertBeatAt(r.voice, this.cursor.pos.beatIndex, r.beat.duration);
            touched.add(r.bar);
        });
    }

    deleteBeatAtCursor(): CommandResult {
        const r = this.cursor.resolve();
        if (!r) {
            return { ok: false, message: "No beat at cursor" };
        }
        // Honest rejections (before the checkpoint — no undo pollution) for
        // deletions that normalization would silently undo.
        if (r.beat.isRest) {
            if (r.voice.beats.length === 1) {
                return { ok: false, message: "Bar is already empty" };
            }
            if (isRedundantTrailingRest(r.voice, this.cursor.pos.beatIndex)) {
                return { ok: false, message: "Trailing rests keep the bar in time — delete the bar (Ctrl+Del) or edit earlier beats" };
            }
        }
        return this.transact((touched) => {
            const t = this.requireCursor();
            deleteBeat(t.voice, this.cursor.pos.beatIndex);
            touched.add(t.bar);
        });
    }

    // ---- bar commands -----------------------------------------------------

    insertBarAtCursor(): CommandResult {
        return this.transact(() => {
            insertBar(this.score, this.cursor.pos.barIndex);
        }, { structural: true, skipNormalize: true });
    }

    appendBarAtEnd(): CommandResult {
        return this.transact(() => {
            appendBar(this.score);
        }, { structural: true, skipNormalize: true });
    }

    deleteBarAtCursor(): CommandResult {
        // replaceScore() clamps the cursor on the rebuilt graph.
        return this.transact(() => {
            deleteBar(this.score, this.cursor.pos.barIndex);
        }, { structural: true, skipNormalize: true });
    }

    // ---- score structure (Phase 3) -------------------------------------------

    /** Bars of every track at the given masterbar indices (for re-padding after capacity changes). */
    private barsAt(indices: number[]): Bar[] {
        const bars: Bar[] = [];
        for (const track of this.score.tracks) {
            for (const staff of track.staves) {
                for (const i of indices) {
                    if (staff.bars[i]) {
                        bars.push(staff.bars[i]);
                    }
                }
            }
        }
        return bars;
    }

    setTimeSignatureAtCursor(numerator: number, denominator: number, applyToFollowing: boolean): CommandResult {
        return this.transact((touched) => {
            const from = this.cursor.pos.barIndex;
            setTimeSignature(this.score, from, numerator, denominator, applyToFollowing);
            const affected = applyToFollowing ? Array.from({ length: this.score.masterBars.length - from }, (_, i) => from + i) : [from];
            for (const bar of this.barsAt(affected)) {
                touched.add(bar);
            }
        }, { structural: true });
    }

    setTempoAtCursor(bpm: number): CommandResult {
        return this.transact(() => {
            setTempo(this.score.masterBars[this.cursor.pos.barIndex], bpm);
        }, { structural: true });
    }

    setKeySignatureAtCursor(key: alphaTab.model.KeySignature, type: alphaTab.model.KeySignatureType, applyToFollowing: boolean): CommandResult {
        return this.transact(() => {
            setKeySignature(this.score, this.cursor.pos.barIndex, key, type, applyToFollowing);
        }, { structural: true });
    }

    setRepeatAtCursor(opts: { start?: boolean; count?: number; alternateEndings?: number }): CommandResult {
        return this.transact(() => {
            setRepeat(this.score, this.cursor.pos.barIndex, opts);
        }, { structural: true });
    }

    setSectionAtCursor(text: string | null): CommandResult {
        return this.transact(() => {
            setSection(this.score.masterBars[this.cursor.pos.barIndex], text);
        }, { structural: true });
    }

    setTripletFeelAtCursor(feel: alphaTab.model.TripletFeel): CommandResult {
        return this.transact(() => {
            setTripletFeel(this.score.masterBars[this.cursor.pos.barIndex], feel);
        }, { structural: true });
    }

    // ---- tracks ---------------------------------------------------------------

    addTrackToScore(template: TrackTemplate): CommandResult {
        return this.transact(() => {
            addTrack(this.score, template);
        }, { structural: true, skipNormalize: true });
    }

    removeTrackFromScore(trackIndex: number): CommandResult {
        const result = this.transact(() => {
            removeTrack(this.score, trackIndex);
        }, { structural: true, skipNormalize: true });
        if (result.ok && this.cursor.trackIndex >= this.score.tracks.length) {
            this.changeTrack(0);
        }
        return result;
    }

    renameTrackInScore(trackIndex: number, name: string): CommandResult {
        return this.transact(() => {
            renameTrack(this.score, trackIndex, name);
        }, { structural: true, skipNormalize: true });
    }

    /** Reorder tracks (drag-and-drop); the edited-track cursor follows the moved track. */
    moveTrackFromTo(from: number, to: number): CommandResult {
        const newTrackIndex = indexAfterMove(this.cursor.trackIndex, from, to);
        return this.transact(() => {
            moveTrack(this.score, from, to);
            this.cursor.trackIndex = newTrackIndex;
        }, { structural: true, skipNormalize: true });
    }

    setTuningForCurrentTrack(tuning: number[], capo: number): CommandResult {
        return this.transact(() => {
            const staff = this.score.tracks[this.cursor.trackIndex]?.staves[this.cursor.staffIndex];
            if (!staff) {
                throw new EditorValidationError("No staff at cursor");
            }
            setStaffTuning(staff, tuning, capo);
        }, { structural: true });
    }

    /** Re-tune a specific track (used by the per-track Edit dialog, which targets any track). */
    setTuningForTrack(trackIndex: number, tuning: number[], capo: number): CommandResult {
        return this.transact(() => {
            const staff = this.score.tracks[trackIndex]?.staves[0];
            if (!staff) {
                throw new EditorValidationError(`No staff at track ${trackIndex}`);
            }
            setStaffTuning(staff, tuning, capo);
        }, { structural: true });
    }

    /** Change a track's MIDI instrument. Non-structural: the re-render request regenerates the MIDI (with the new program) without a full re-import. */
    setTrackInstrument(trackIndex: number, program: number): CommandResult {
        return this.transact(() => {
            setTrackProgram(this.score, trackIndex, program);
        });
    }

    /** Set a track's display colour (persisted in the .gp). UI-only visual — no rebuild needed. */
    setTrackColorInScore(trackIndex: number, hex: string): CommandResult {
        return this.transact(() => {
            setTrackColor(this.score, trackIndex, hex);
        });
    }

    /** Switch the edited track; the host re-renders via onScoreReplaced. */
    changeTrack(trackIndex: number): void {
        if (trackIndex < 0 || trackIndex >= this.score.tracks.length) {
            return;
        }
        this.cursor.trackIndex = trackIndex;
        this.cursor.staffIndex = 0;
        this.cursor.clamp();
        this.refreshValidation();
        this.host.onScoreReplaced(this.score);
        this.host.onStateChanged();
    }

    /** Switch the edited voice within the current bar (GP voice slots). */
    setVoice(voiceIndex: number): void {
        this.cursor.pos.voiceIndex = voiceIndex;
        this.cursor.clamp();
        this.host.onStateChanged();
    }

    // ---- effects (Phase 2) --------------------------------------------------

    applyNoteEffectAtCursor(fx: NoteEffect): CommandResult {
        return this.transact((touched) => {
            const { note, bar } = this.requireNote();
            setNoteEffect(note, fx);
            touched.add(bar);
        });
    }

    applyBeatEffectAtCursor(fx: BeatEffect): CommandResult {
        return this.transact((touched) => {
            const r = this.requireCursor();
            setBeatEffect(r.beat, fx);
            touched.add(r.bar);
        });
    }

    /** Toggle a boolean note effect based on its current value. */
    toggleNoteEffectAtCursor(kind: "palmMute" | "letRing" | "staccato" | "ghost" | "dead" | "hammerPull"): CommandResult {
        const r = this.cursor.resolve();
        const note = r?.note;
        if (!note) {
            return { ok: false, message: "No note at cursor" };
        }
        const current = {
            palmMute: note.isPalmMute,
            letRing: note.isLetRing,
            staccato: note.isStaccato,
            ghost: note.isGhost,
            dead: note.isDead,
            hammerPull: note.isHammerPullOrigin,
        }[kind];
        return this.applyNoteEffectAtCursor({ kind, on: !current } as NoteEffect);
    }

    /** Cycle enum-valued note effects through their common values. */
    cycleNoteEffectAtCursor(kind: "vibrato" | "harmonic" | "accent"): CommandResult {
        const r = this.cursor.resolve();
        const note = r?.note;
        if (!note) {
            return { ok: false, message: "No note at cursor" };
        }
        switch (kind) {
            case "vibrato": {
                const next = (note.vibrato + 1) % 3; // None -> Slight -> Wide
                return this.applyNoteEffectAtCursor({ kind: "vibrato", type: next });
            }
            case "harmonic": {
                // None -> Natural -> Artificial -> Pinch -> Tap -> None
                const order = [0, 1, 2, 3, 4];
                const index = order.indexOf(note.harmonicType);
                const next = order[(index + 1) % order.length];
                return this.applyNoteEffectAtCursor({ kind: "harmonic", type: next, value: next === 2 ? 12 : 0 });
            }
            case "accent": {
                const next = (note.accentuated + 1) % 3; // None -> Normal -> Heavy
                return this.applyNoteEffectAtCursor({ kind: "accent", type: next });
            }
        }
    }

    toggleTapAtCursor(): CommandResult {
        const r = this.cursor.resolve();
        if (!r) {
            return { ok: false, message: "No beat at cursor" };
        }
        return this.applyBeatEffectAtCursor({ kind: "tap", on: !r.beat.tap });
    }

    /** Cycle grace type: None(0) -> BeforeBeat(2) -> OnBeat(1) -> None. */
    cycleGraceAtCursor(): CommandResult {
        const r = this.cursor.resolve();
        if (!r) {
            return { ok: false, message: "No beat at cursor" };
        }
        const next = r.beat.graceType === 0 ? 2 : (r.beat.graceType === 2 ? 1 : 0);
        return this.applyBeatEffectAtCursor({ kind: "grace", type: next });
    }

    /** Toggle a slide-out on the cursor note: same type toggles off, other type swaps. */
    toggleSlideOutAtCursor(type: 1 | 2): CommandResult {
        const r = this.cursor.resolve();
        if (!r?.note) {
            return { ok: false, message: "No note at cursor" };
        }
        const next = r.note.slideOutType === type ? 0 : type;
        return this.applyNoteEffectAtCursor({ kind: "slideOut", type: next });
    }

    /** Cycle tremolo picking: off -> 8th -> 16th -> 32nd -> off. */
    cycleTremoloAtCursor(): CommandResult {
        const r = this.cursor.resolve();
        if (!r) {
            return { ok: false, message: "No beat at cursor" };
        }
        const order: Array<alphaTab.model.Duration | null> = [null, Duration.Eighth, Duration.Sixteenth, Duration.ThirtySecond];
        const index = order.indexOf(r.beat.tremoloSpeed ?? null);
        const next = order[(index + 1) % order.length];
        return this.applyBeatEffectAtCursor({ kind: "tremolo", speed: next });
    }

    // ---- clipboard (single beat) ---------------------------------------------

    private clipboard: BeatData | null = null;

    get hasClipboard(): boolean {
        return this.clipboard !== null;
    }

    copyBeatAtCursor(): CommandResult {
        const r = this.cursor.resolve();
        if (!r) {
            return { ok: false, message: "No beat at cursor" };
        }
        this.clipboard = serializeBeat(r.beat);
        this.host.onStateChanged();
        return OK;
    }

    cutBeatAtCursor(): CommandResult {
        const copy = this.copyBeatAtCursor();
        if (!copy.ok) {
            return copy;
        }
        return this.deleteBeatAtCursor();
    }

    pasteBeatAtCursor(): CommandResult {
        const data = this.clipboard;
        if (!data) {
            return { ok: false, message: "Clipboard is empty" };
        }
        return this.transact((touched) => {
            const r = this.requireCursor();
            applyBeatData(r.beat, data);
            touched.add(r.bar);
        });
    }

    private requireNote() {
        const r = this.requireCursor();
        if (!r.note) {
            throw new EditorValidationError("No note at cursor");
        }
        return { ...r, note: r.note };
    }

    // ---- cursor movement ---------------------------------------------------

    /** Right arrow: move to the next beat; at the very end, append a bar (GP behavior). */
    moveRight(): void {
        if (!this.cursor.moveBeat(1)) {
            const result = this.appendBarAtEnd();
            if (result.ok) {
                this.cursor.moveBeat(1);
            }
        }
        this.host.onStateChanged();
    }

    moveLeft(): void {
        this.cursor.moveBeat(-1);
        this.host.onStateChanged();
    }

    moveStringUp(): void {
        this.cursor.moveString(1);
        this.host.onStateChanged();
    }

    moveStringDown(): void {
        this.cursor.moveString(-1);
        this.host.onStateChanged();
    }

    moveBar(delta: number): void {
        this.cursor.moveBar(delta);
        this.host.onStateChanged();
    }

    /** Absolute bar jump (bar navigator). Out-of-range indices are a no-op. */
    moveToBar(index: number): void {
        if (this.cursor.toBar(index)) {
            this.host.onStateChanged();
        }
    }

    // ---- state for the UI ---------------------------------------------------

    /**
     * True when the cursor's bar holds no notes (deleting it loses nothing).
     * Explicit compute — alphaTab's `Bar.isRestOnly` is finish()-cached and can
     * be stale after skipNormalize transactions.
     */
    cursorBarIsRestOnly(): boolean {
        const r = this.cursor.resolve();
        return r !== null && isBarRestOnly(r.bar);
    }

    /** Ticks used vs capacity of the cursor's bar (status-bar fill indicator). */
    barFill(): { used: number; capacity: number } | null {
        const r = this.cursor.resolve();
        if (!r) {
            return null;
        }
        let used = 0;
        for (const beat of r.voice.beats) {
            used += beatTicks(beat);
        }
        return { used, capacity: r.bar.masterBar.calculateDuration() };
    }

    // ---- persistence ---------------------------------------------------------

    exportGp(): Uint8Array {
        return new alphaTab.exporter.Gp7Exporter().export(this.score, this.settings);
    }

    markSaved(): void {
        this.dirty = false;
        this.host.onStateChanged();
    }

    private requireCursor() {
        const r = this.cursor.resolve();
        if (!r) {
            throw new EditorValidationError("No beat at cursor");
        }
        return r;
    }
}
