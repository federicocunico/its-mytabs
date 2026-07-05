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
import { type BarWarning, beatTicks, normalizeScore, rebuildScore } from "./normalize.ts";
import { EditorValidationError } from "./validation.ts";
import { removeNoteOnString, setNoteFret, toggleTie } from "./mutations/note.ts";
import { applyBeatData, type BeatData, deleteBeat, insertBeatAt, makeRest, serializeBeat, setBeatDots, setBeatDuration } from "./mutations/beat.ts";
import { appendBar, deleteBar, insertBar } from "./mutations/bar.ts";
import { type BeatEffect, type NoteEffect, setBeatEffect, setNoteEffect } from "./mutations/effects.ts";

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
    barWarnings: BarWarning[] = [];

    private history = new SnapshotHistory();
    private attached = false;

    constructor(private readonly host: EditorHost) {}

    attach(score: Score, settings: Settings, trackIndex: number): void {
        this.score = score;
        this.settings = settings;
        this.cursor = new EditorCursor(() => this.score, trackIndex);
        this.history.clear();
        this.dirty = false;
        this.barWarnings = [];
        this.attached = true;
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
     * @param structural bar-level edits invalidate object identity: the score
     *   is rebuilt through the serializer and the host must swap instances.
     */
    private transact(fn: (touched: Set<Bar>) => void, structural = false): CommandResult {
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

        if (structural) {
            // Bar splices leave stale indices/links behind; running finish() on
            // that graph would crash. Rebuild through the serializer instead —
            // the importer pipeline recomputes everything on a clean graph.
            this.barWarnings = [];
            this.replaceScore(rebuildScore(this.score, this.settings));
        } else {
            this.barWarnings = normalizeScore(this.score, this.settings, touched);
            this.host.requestRender();
        }

        this.dirty = true;
        this.host.onStateChanged();
        return OK;
    }

    private replaceScore(score: Score): void {
        this.score = score;
        this.cursor.clamp();
        this.host.onScoreReplaced(score);
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

    deleteNoteAtCursor(): CommandResult {
        return this.transact((touched) => {
            const r = this.requireCursor();
            removeNoteOnString(r.beat, this.cursor.pos.string);
            touched.add(r.bar);
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
        return this.transact((touched) => {
            const r = this.requireCursor();
            makeRest(r.beat);
            touched.add(r.bar);
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
        const result = this.transact((touched) => {
            const r = this.requireCursor();
            deleteBeat(r.voice, this.cursor.pos.beatIndex);
            touched.add(r.bar);
        });
        this.cursor.clamp();
        return result;
    }

    // ---- bar commands -----------------------------------------------------

    insertBarAtCursor(): CommandResult {
        return this.transact(() => {
            insertBar(this.score, this.cursor.pos.barIndex);
        }, true);
    }

    appendBarAtEnd(): CommandResult {
        return this.transact(() => {
            appendBar(this.score);
        }, true);
    }

    deleteBarAtCursor(): CommandResult {
        const result = this.transact(() => {
            deleteBar(this.score, this.cursor.pos.barIndex);
        }, true);
        this.cursor.clamp();
        return result;
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

    // ---- state for the UI ---------------------------------------------------

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
