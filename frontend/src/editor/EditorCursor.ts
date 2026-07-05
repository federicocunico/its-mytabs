/**
 * Logical edit cursor. Indices are authoritative — object references die
 * whenever the score graph is replaced (undo/redo, structural rebuild), so the
 * cursor re-resolves through the current score on demand and clamps itself
 * after structural changes.
 *
 * `string` uses the MODEL numbering: 1 = lowest-pitched string,
 * tuning.length = highest. (alphaTex and guitarists count the other way round;
 * the UI converts at its boundary.)
 */
import * as alphaTab from "@coderline/alphatab";

type Score = alphaTab.model.Score;
type Bar = alphaTab.model.Bar;
type Voice = alphaTab.model.Voice;
type Beat = alphaTab.model.Beat;
type Note = alphaTab.model.Note;

export interface CursorPosition {
    barIndex: number;
    voiceIndex: number;
    beatIndex: number;
    string: number;
}

export interface ResolvedCursor {
    bar: Bar;
    voice: Voice;
    beat: Beat;
    note: Note | null;
}

export class EditorCursor {
    readonly pos: CursorPosition;
    staffIndex = 0;

    constructor(
        private readonly getScore: () => Score,
        public trackIndex: number,
    ) {
        this.pos = {
            barIndex: 0,
            voiceIndex: 0,
            beatIndex: 0,
            string: this.staff()?.tuning.length ?? 6,
        };
    }

    private staff(): alphaTab.model.Staff | null {
        const track = this.getScore().tracks[this.trackIndex];
        return track ? track.staves[this.staffIndex] ?? null : null;
    }

    private voiceAt(barIndex: number): Voice | null {
        const staff = this.staff();
        const bar = staff?.bars[barIndex];
        return bar?.voices[this.pos.voiceIndex] ?? null;
    }

    resolve(): ResolvedCursor | null {
        const staff = this.staff();
        if (!staff) {
            return null;
        }
        const bar = staff.bars[this.pos.barIndex];
        const voice = bar?.voices[this.pos.voiceIndex];
        const beat = voice?.beats[this.pos.beatIndex];
        if (!bar || !voice || !beat) {
            return null;
        }
        return { bar, voice, beat, note: beat.getNoteOnString(this.pos.string) };
    }

    /**
     * Move one beat left/right, crossing bar boundaries.
     * Returns false at the edges (caller may decide to append a bar on the right edge).
     */
    moveBeat(direction: 1 | -1): boolean {
        const voice = this.voiceAt(this.pos.barIndex);
        if (!voice) {
            return false;
        }

        const target = this.pos.beatIndex + direction;
        if (target >= 0 && target < voice.beats.length) {
            this.pos.beatIndex = target;
            return true;
        }

        const nextBar = this.pos.barIndex + direction;
        const nextVoice = this.voiceAt(nextBar);
        if (!nextVoice || nextVoice.beats.length === 0) {
            return false;
        }

        this.pos.barIndex = nextBar;
        this.pos.beatIndex = direction === 1 ? 0 : nextVoice.beats.length - 1;
        return true;
    }

    /** Move across strings; +1 goes to a higher-pitched string. Clamped to the tuning. */
    moveString(delta: number): boolean {
        const staff = this.staff();
        if (!staff) {
            return false;
        }
        const target = this.pos.string + delta;
        if (target < 1 || target > staff.tuning.length) {
            return false;
        }
        this.pos.string = target;
        return true;
    }

    /** Jump whole bars; lands on beat 0 of the target bar. */
    moveBar(delta: number): boolean {
        const target = this.pos.barIndex + delta;
        if (!this.voiceAt(target)) {
            return false;
        }
        this.pos.barIndex = target;
        this.pos.beatIndex = 0;
        return true;
    }

    /** Jump to the first/last beat of the current bar. */
    toBarEdge(edge: "start" | "end"): void {
        const voice = this.voiceAt(this.pos.barIndex);
        if (!voice) {
            return;
        }
        this.pos.beatIndex = edge === "start" ? 0 : voice.beats.length - 1;
    }

    /** Jump to the first beat of the first bar / last beat of the last bar. */
    toScoreEdge(edge: "start" | "end"): void {
        const staff = this.staff();
        if (!staff) {
            return;
        }
        this.pos.barIndex = edge === "start" ? 0 : staff.bars.length - 1;
        this.toBarEdge(edge);
    }

    /** Snap all indices back into range (after structural edits or score replacement). */
    clamp(): void {
        const score = this.getScore();
        if (this.trackIndex >= score.tracks.length) {
            this.trackIndex = 0;
        }
        const staff = this.staff();
        if (!staff) {
            return;
        }
        this.pos.barIndex = Math.max(0, Math.min(this.pos.barIndex, staff.bars.length - 1));
        const bar = staff.bars[this.pos.barIndex];
        this.pos.voiceIndex = Math.max(0, Math.min(this.pos.voiceIndex, bar.voices.length - 1));
        const voice = bar.voices[this.pos.voiceIndex];
        this.pos.beatIndex = Math.max(0, Math.min(this.pos.beatIndex, voice.beats.length - 1));
        this.pos.string = Math.max(1, Math.min(this.pos.string, staff.tuning.length));
    }

    /** Place the cursor on a clicked beat (from alphaTab's beatMouseDown). */
    setFromBeat(beat: Beat): void {
        this.trackIndex = beat.voice.bar.staff.track.index;
        this.staffIndex = beat.voice.bar.staff.index;
        this.pos.barIndex = beat.voice.bar.index;
        this.pos.voiceIndex = beat.voice.index;
        this.pos.beatIndex = beat.index;
        this.clamp();
    }
}
