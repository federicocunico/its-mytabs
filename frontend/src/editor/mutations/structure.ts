/**
 * Score-structure mutations (Phase 3): time signatures, tempo, key signatures,
 * repeats, sections, triplet feel and track management. Structural edits that
 * add/remove bars or tracks require a Tier-2 rebuild afterwards (the
 * EditorController handles that).
 */
import * as alphaTab from "@coderline/alphatab";
import { EditorValidationError } from "../validation.ts";

type Score = alphaTab.model.Score;
type MasterBar = alphaTab.model.MasterBar;
type Staff = alphaTab.model.Staff;

const VALID_TS_DENOMINATORS = [1, 2, 4, 8, 16, 32];

export function setTimeSignature(score: Score, masterBarIndex: number, numerator: number, denominator: number, applyToFollowing: boolean): void {
    if (!Number.isInteger(numerator) || numerator < 1 || numerator > 32) {
        throw new EditorValidationError(`Invalid time signature numerator ${numerator}`);
    }
    if (!VALID_TS_DENOMINATORS.includes(denominator)) {
        throw new EditorValidationError(`Invalid time signature denominator ${denominator}`);
    }

    const masterBar = score.masterBars[masterBarIndex];
    if (!masterBar) {
        throw new EditorValidationError(`Invalid bar index ${masterBarIndex}`);
    }

    const oldNumerator = masterBar.timeSignatureNumerator;
    const oldDenominator = masterBar.timeSignatureDenominator;

    const apply = (mb: MasterBar) => {
        mb.timeSignatureNumerator = numerator;
        mb.timeSignatureDenominator = denominator;
        mb.timeSignatureCommon = false;
    };

    apply(masterBar);

    if (applyToFollowing) {
        for (let i = masterBarIndex + 1; i < score.masterBars.length; i++) {
            const mb = score.masterBars[i];
            if (mb.timeSignatureNumerator !== oldNumerator || mb.timeSignatureDenominator !== oldDenominator) {
                break; // an explicit later change ends the run
            }
            apply(mb);
        }
    }
}

export function setTempo(masterBar: MasterBar, bpm: number): void {
    if (!Number.isFinite(bpm) || bpm < 10 || bpm > 500) {
        throw new EditorValidationError(`Tempo must be between 10 and 500 BPM`);
    }

    // Replace any tempo automation at the bar start
    masterBar.tempoAutomations.splice(0, masterBar.tempoAutomations.length);
    // reference 2 = quarter-note based BPM (the stored value is bpm * reference / 2)
    const automation = alphaTab.model.Automation.buildTempoAutomation(false, 0, bpm, 2, true);
    masterBar.tempoAutomations.push(automation);
}

/** Key signatures live on the bars (per staff); apply to every track at the index. */
export function setKeySignature(
    score: Score,
    barIndex: number,
    key: alphaTab.model.KeySignature,
    type: alphaTab.model.KeySignatureType,
    applyToFollowing: boolean,
): void {
    const reference = score.tracks[0]?.staves[0]?.bars[barIndex];
    if (!reference) {
        throw new EditorValidationError(`Invalid bar index ${barIndex}`);
    }
    const oldKey = reference.keySignature;
    const oldType = reference.keySignatureType;

    for (const track of score.tracks) {
        for (const staff of track.staves) {
            staff.bars[barIndex].keySignature = key;
            staff.bars[barIndex].keySignatureType = type;

            if (applyToFollowing) {
                for (let i = barIndex + 1; i < staff.bars.length; i++) {
                    const bar = staff.bars[i];
                    if (bar.keySignature !== oldKey || bar.keySignatureType !== oldType) {
                        break;
                    }
                    bar.keySignature = key;
                    bar.keySignatureType = type;
                }
            }
        }
    }
}

export function setRepeat(score: Score, masterBarIndex: number, opts: { start?: boolean; count?: number; alternateEndings?: number }): void {
    const masterBar = score.masterBars[masterBarIndex];
    if (!masterBar) {
        throw new EditorValidationError(`Invalid bar index ${masterBarIndex}`);
    }

    if (opts.start !== undefined) {
        masterBar.isRepeatStart = opts.start;
    }
    if (opts.count !== undefined) {
        if (!Number.isInteger(opts.count) || opts.count < 0 || opts.count > 100) {
            throw new EditorValidationError("Repeat count must be 0..100");
        }
        masterBar.repeatCount = opts.count;
    }
    if (opts.alternateEndings !== undefined) {
        masterBar.alternateEndings = opts.alternateEndings;
    }

    score.rebuildRepeatGroups();
}

export function setSection(masterBar: MasterBar, text: string | null): void {
    if (text === null || text === "") {
        masterBar.section = undefined;
        return;
    }
    const section = new alphaTab.model.Section();
    section.text = text;
    section.marker = "";
    masterBar.section = section;
}

export function setTripletFeel(masterBar: MasterBar, feel: alphaTab.model.TripletFeel): void {
    masterBar.tripletFeel = feel;
}

export interface TrackTemplate {
    name: string;
    /** MIDI note values, highest string first (same order as staff.tuning). */
    tuning: number[];
    /** MIDI program number. */
    program: number;
}

/** Allocate a MIDI channel pair not used by any existing track (skipping 9 = drums). */
function allocateChannels(score: Score): { primary: number; secondary: number } {
    const used = new Set<number>();
    for (const track of score.tracks) {
        used.add(track.playbackInfo.primaryChannel);
        used.add(track.playbackInfo.secondaryChannel);
    }
    const next = () => {
        for (let ch = 0; ch < 64; ch++) {
            if (ch !== 9 && !used.has(ch)) {
                used.add(ch);
                return ch;
            }
        }
        return 0;
    };
    return { primary: next(), secondary: next() };
}

/** Append a new stringed track, padded with rest bars to the score length. */
export function addTrack(score: Score, template: TrackTemplate): alphaTab.model.Track {
    if (!template.name || template.tuning.length < 3 || template.tuning.length > 10) {
        throw new EditorValidationError("A track needs a name and 3-10 strings");
    }

    const track = new alphaTab.model.Track();
    track.name = template.name;
    track.shortName = template.name.substring(0, 10);
    track.playbackInfo.program = template.program;
    const channels = allocateChannels(score);
    track.playbackInfo.primaryChannel = channels.primary;
    track.playbackInfo.secondaryChannel = channels.secondary;

    track.ensureStaveCount(1);
    const staff = track.staves[0];
    staff.stringTuning.tunings = [...template.tuning];
    staff.showTablature = true;
    staff.showStandardNotation = true;

    for (let i = 0; i < score.masterBars.length; i++) {
        const bar = new alphaTab.model.Bar();
        const voice = new alphaTab.model.Voice();
        const rest = new alphaTab.model.Beat();
        rest.duration = alphaTab.model.Duration.Whole;
        voice.addBeat(rest);
        bar.addVoice(voice);
        staff.addBar(bar);
    }

    score.addTrack(track);
    return track;
}

export function removeTrack(score: Score, trackIndex: number): void {
    if (score.tracks.length <= 1) {
        throw new EditorValidationError("Cannot remove the only track");
    }
    if (trackIndex < 0 || trackIndex >= score.tracks.length) {
        throw new EditorValidationError(`Invalid track index ${trackIndex}`);
    }
    score.tracks.splice(trackIndex, 1);
}

/** Re-tune a staff. Changing the string count is only allowed while the staff has no notes. */
export function setStaffTuning(staff: Staff, tuning: number[], capo: number): void {
    if (tuning.length !== staff.tuning.length) {
        const hasNotes = staff.bars.some((bar) => bar.voices.some((v) => v.beats.some((b) => b.notes.length > 0)));
        if (hasNotes) {
            throw new EditorValidationError("Cannot change the number of strings while the track has notes");
        }
    }
    if (!Number.isInteger(capo) || capo < 0 || capo > 12) {
        throw new EditorValidationError("Capo must be 0..12");
    }
    staff.stringTuning.tunings = [...tuning];
    staff.capo = capo;
}
