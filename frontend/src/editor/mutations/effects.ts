/**
 * Note- and beat-level effect mutations (Phase 2). Pure model operations —
 * callers run normalizeScore() afterwards so alphaTab resolves effect targets
 * (hammer-on destinations, slide targets, ...).
 */
import * as alphaTab from "@coderline/alphatab";
import { assertFret, EditorValidationError } from "../validation.ts";

type Beat = alphaTab.model.Beat;
type Note = alphaTab.model.Note;

const { VibratoType, HarmonicType, AccentuationType, SlideInType, SlideOutType, BendType, GraceType, PickStroke, BrushType, DynamicValue } = alphaTab.model;

export interface BendPointData {
    /** 0..60 position within the beat */
    offset: number;
    /** value in quarter-tones (full bend = 4) */
    value: number;
}

export type NoteEffect =
    | { kind: "palmMute" | "letRing" | "staccato" | "ghost" | "dead"; on: boolean }
    | { kind: "vibrato"; type: alphaTab.model.VibratoType }
    | { kind: "accent"; type: alphaTab.model.AccentuationType }
    | { kind: "dynamics"; value: alphaTab.model.DynamicValue }
    | { kind: "harmonic"; type: alphaTab.model.HarmonicType; value?: number }
    | { kind: "hammerPull"; on: boolean }
    | { kind: "slideIn"; type: alphaTab.model.SlideInType }
    | { kind: "slideOut"; type: alphaTab.model.SlideOutType }
    | { kind: "bend"; type: alphaTab.model.BendType; points: BendPointData[] }
    | { kind: "trill"; fret: number; speed: alphaTab.model.Duration }
    | { kind: "clearTrill" };

export type BeatEffect =
    | { kind: "tap" | "slap" | "pop"; on: boolean }
    | { kind: "pickStroke"; type: alphaTab.model.PickStroke }
    | { kind: "brush"; type: alphaTab.model.BrushType }
    | { kind: "grace"; type: alphaTab.model.GraceType }
    | { kind: "tremolo"; speed: alphaTab.model.Duration | null }
    | { kind: "text"; value: string | null };

/** Bend presets covering the common Guitar Pro shapes. Values in quarter-tones. */
export const BEND_PRESETS: Array<{ id: string; label: string; type: alphaTab.model.BendType; points: BendPointData[] }> = [
    { id: "bend-quarter", label: "Bend ¼", type: BendType.Bend, points: [{ offset: 0, value: 0 }, { offset: 60, value: 1 }] },
    { id: "bend-half", label: "Bend ½", type: BendType.Bend, points: [{ offset: 0, value: 0 }, { offset: 60, value: 2 }] },
    { id: "bend-full", label: "Bend Full", type: BendType.Bend, points: [{ offset: 0, value: 0 }, { offset: 60, value: 4 }] },
    { id: "bend-1-5", label: "Bend 1½", type: BendType.Bend, points: [{ offset: 0, value: 0 }, { offset: 60, value: 6 }] },
    { id: "bend-release", label: "Bend & Release", type: BendType.BendRelease, points: [{ offset: 0, value: 0 }, { offset: 30, value: 4 }, { offset: 60, value: 0 }] },
    { id: "prebend", label: "Prebend", type: BendType.Prebend, points: [{ offset: 0, value: 4 }, { offset: 60, value: 4 }] },
    { id: "prebend-release", label: "Prebend & Release", type: BendType.PrebendRelease, points: [{ offset: 0, value: 4 }, { offset: 60, value: 0 }] },
    { id: "bend-none", label: "No Bend", type: BendType.None, points: [] },
];

/** The next played note on the same string (needed by hammer-on / shift & legato slides). */
function nextNoteOnSameString(note: Note): Note | null {
    let beat: Beat | null = note.beat.nextBeat;
    while (beat) {
        const next = beat.getNoteOnString(note.string);
        if (next) {
            return next;
        }
        if (!beat.isRest) {
            // GP requires the destination to be the directly following played beat
            return beat.getNoteOnString(note.string);
        }
        beat = beat.nextBeat;
    }
    return null;
}

function clearBend(note: Note): void {
    note.bendType = BendType.None;
    if (note.bendPoints) {
        note.bendPoints.splice(0, note.bendPoints.length);
    }
}

export function setNoteEffect(note: Note, fx: NoteEffect): void {
    switch (fx.kind) {
        case "palmMute":
            note.isPalmMute = fx.on;
            break;
        case "letRing":
            note.isLetRing = fx.on;
            break;
        case "staccato":
            note.isStaccato = fx.on;
            break;
        case "ghost":
            note.isGhost = fx.on;
            break;
        case "dead":
            note.isDead = fx.on;
            if (fx.on) {
                // A dead note has no pitch — pitch-based effects make no sense on it
                note.harmonicType = HarmonicType.None;
                note.harmonicValue = 0;
                clearBend(note);
                note.vibrato = VibratoType.None;
            }
            break;
        case "vibrato":
            note.vibrato = fx.type;
            break;
        case "accent":
            note.accentuated = fx.type;
            break;
        case "dynamics":
            note.dynamics = fx.value;
            break;
        case "harmonic":
            note.harmonicType = fx.type;
            note.harmonicValue = fx.value ?? 0;
            break;
        case "hammerPull":
            if (fx.on && !nextNoteOnSameString(note)) {
                throw new EditorValidationError("Hammer-on/pull-off needs a following note on the same string");
            }
            note.isHammerPullOrigin = fx.on;
            break;
        case "slideIn":
            note.slideInType = fx.type;
            break;
        case "slideOut":
            if ((fx.type === SlideOutType.Shift || fx.type === SlideOutType.Legato) && !nextNoteOnSameString(note)) {
                throw new EditorValidationError("Shift/legato slides need a following note on the same string");
            }
            note.slideOutType = fx.type;
            break;
        case "bend": {
            if (note.isTieDestination && fx.type !== BendType.None && fx.type !== BendType.Hold && fx.type !== BendType.Release) {
                throw new EditorValidationError("A tied note can only hold or release a bend");
            }
            clearBend(note);
            note.bendType = fx.type;
            for (const point of fx.points) {
                note.addBendPoint(new alphaTab.model.BendPoint(point.offset, point.value));
            }
            break;
        }
        case "trill": {
            assertFret(fx.fret);
            if (fx.fret === note.fret) {
                throw new EditorValidationError("The trill fret must differ from the note's fret");
            }
            const staff = note.beat.voice.bar.staff;
            note.trillValue = alphaTab.model.Note.getStringTuning(staff, note.string) + fx.fret;
            note.trillSpeed = fx.speed;
            break;
        }
        case "clearTrill":
            note.trillValue = -1;
            break;
    }
}

export function setBeatEffect(beat: Beat, fx: BeatEffect): void {
    switch (fx.kind) {
        case "tap":
            beat.tap = fx.on;
            break;
        case "slap":
            beat.slap = fx.on;
            break;
        case "pop":
            beat.pop = fx.on;
            break;
        case "pickStroke":
            beat.pickStroke = fx.type;
            break;
        case "brush":
            beat.brushType = fx.type;
            break;
        case "grace":
            beat.graceType = fx.type;
            break;
        case "tremolo":
            beat.tremoloSpeed = fx.speed;
            break;
        case "text":
            beat.text = fx.value ?? undefined;
            break;
    }
}

// Re-exported for the UI layer (palette buttons and cycles)
export { AccentuationType, BendType, BrushType, DynamicValue, GraceType, HarmonicType, PickStroke, SlideInType, SlideOutType, VibratoType };
