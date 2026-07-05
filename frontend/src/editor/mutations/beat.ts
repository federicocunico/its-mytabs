/**
 * Beat-level mutations. Pure model operations — callers run normalizeScore()
 * afterwards to pad bars and recompute derived state.
 */
import * as alphaTab from "@coderline/alphatab";

type Beat = alphaTab.model.Beat;
type Voice = alphaTab.model.Voice;

export function setBeatDuration(beat: Beat, duration: alphaTab.model.Duration): void {
    beat.duration = duration;
}

export function setBeatDots(beat: Beat, dots: 0 | 1 | 2): void {
    beat.dots = dots;
}

/** Turn the beat into a rest by removing all of its notes. */
export function makeRest(beat: Beat): void {
    for (const note of [...beat.notes]) {
        beat.removeNote(note);
    }
}

/** Insert a new rest beat at `index`, shifting later beats right. */
export function insertBeatAt(voice: Voice, index: number, duration: alphaTab.model.Duration): Beat {
    const beat = new alphaTab.model.Beat();
    beat.duration = duration;
    voice.beats.splice(index, 0, beat);
    beat.voice = voice;
    return beat;
}

/** Remove the beat at `index`. The voice may become empty; normalization re-pads it. */
export function deleteBeat(voice: Voice, index: number): void {
    voice.beats.splice(index, 1);
}

/**
 * Plain-JSON snapshot of a beat for copy/paste. Captures rhythm, beat effects
 * and per-note effects (the Phase-1/2 editable surface).
 */
export interface BeatData {
    duration: number;
    dots: number;
    tupletNumerator: number;
    tupletDenominator: number;
    tap: boolean;
    slap: boolean;
    pop: boolean;
    pickStroke: number;
    brushType: number;
    graceType: number;
    tremoloSpeed: number | null;
    text: string | null;
    notes: Array<{
        string: number;
        fret: number;
        isTieDestination: boolean;
        isPalmMute: boolean;
        isLetRing: boolean;
        isStaccato: boolean;
        isGhost: boolean;
        isDead: boolean;
        vibrato: number;
        accentuated: number;
        dynamics: number;
        harmonicType: number;
        harmonicValue: number;
        isHammerPullOrigin: boolean;
        slideInType: number;
        slideOutType: number;
        bendType: number;
        bendPoints: Array<{ offset: number; value: number }>;
        trillValue: number;
        trillSpeed: number;
    }>;
}

export function serializeBeat(beat: Beat): BeatData {
    return {
        duration: beat.duration,
        dots: beat.dots,
        tupletNumerator: beat.tupletNumerator,
        tupletDenominator: beat.tupletDenominator,
        tap: beat.tap,
        slap: beat.slap,
        pop: beat.pop,
        pickStroke: beat.pickStroke,
        brushType: beat.brushType,
        graceType: beat.graceType,
        tremoloSpeed: beat.tremoloSpeed ?? null,
        text: beat.text ?? null,
        notes: beat.notes.map((n) => ({
            string: n.string,
            fret: n.fret,
            isTieDestination: n.isTieDestination,
            isPalmMute: n.isPalmMute,
            isLetRing: n.isLetRing,
            isStaccato: n.isStaccato,
            isGhost: n.isGhost,
            isDead: n.isDead,
            vibrato: n.vibrato,
            accentuated: n.accentuated,
            dynamics: n.dynamics,
            harmonicType: n.harmonicType,
            harmonicValue: n.harmonicValue,
            isHammerPullOrigin: n.isHammerPullOrigin,
            slideInType: n.slideInType,
            slideOutType: n.slideOutType,
            bendType: n.bendType,
            bendPoints: (n.bendPoints ?? []).map((p) => ({ offset: p.offset, value: p.value })),
            trillValue: n.trillValue,
            trillSpeed: n.trillSpeed,
        })),
    };
}

/** Overwrite `beat` with a previously serialized beat (paste). */
export function applyBeatData(beat: Beat, data: BeatData): void {
    beat.duration = data.duration;
    beat.dots = data.dots;
    beat.tupletNumerator = data.tupletNumerator;
    beat.tupletDenominator = data.tupletDenominator;
    beat.tap = data.tap;
    beat.slap = data.slap;
    beat.pop = data.pop;
    beat.pickStroke = data.pickStroke;
    beat.brushType = data.brushType;
    beat.graceType = data.graceType;
    beat.tremoloSpeed = data.tremoloSpeed;
    beat.text = data.text ?? undefined;

    for (const note of [...beat.notes]) {
        beat.removeNote(note);
    }
    for (const n of data.notes) {
        const note = new alphaTab.model.Note();
        note.string = n.string;
        note.fret = n.fret;
        note.isTieDestination = n.isTieDestination;
        note.isPalmMute = n.isPalmMute;
        note.isLetRing = n.isLetRing;
        note.isStaccato = n.isStaccato;
        note.isGhost = n.isGhost;
        note.isDead = n.isDead;
        note.vibrato = n.vibrato;
        note.accentuated = n.accentuated;
        note.dynamics = n.dynamics;
        note.harmonicType = n.harmonicType;
        note.harmonicValue = n.harmonicValue;
        note.isHammerPullOrigin = n.isHammerPullOrigin;
        note.slideInType = n.slideInType;
        note.slideOutType = n.slideOutType;
        note.bendType = n.bendType;
        for (const p of n.bendPoints) {
            note.addBendPoint(new alphaTab.model.BendPoint(p.offset, p.value));
        }
        note.trillValue = n.trillValue;
        note.trillSpeed = n.trillSpeed;
        beat.addNote(note);
        beat.isEmpty = false;
    }
}
