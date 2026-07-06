/**
 * Bar-level (structural) mutations. These operate on ALL tracks so that
 * score.masterBars and every staff's bars stay in sync. They do raw splices;
 * callers MUST run rebuildScore() afterwards (Tier-2 normalization) to
 * recompute masterbar linking, indices and start ticks.
 */
import * as alphaTab from "@coderline/alphatab";
import { EditorValidationError } from "../validation.ts";

type Score = alphaTab.model.Score;

/** Create a rest-only bar in every staff at masterbar position `index` (before the current occupant). */
export function insertBar(score: Score, index: number): void {
    if (index < 0 || index > score.masterBars.length) {
        throw new EditorValidationError(`Invalid bar index ${index}`);
    }

    const reference = score.masterBars[Math.max(0, Math.min(index - 1, score.masterBars.length - 1))];

    const masterBar = new alphaTab.model.MasterBar();
    masterBar.timeSignatureNumerator = reference.timeSignatureNumerator;
    masterBar.timeSignatureDenominator = reference.timeSignatureDenominator;
    masterBar.timeSignatureCommon = reference.timeSignatureCommon;
    masterBar.tripletFeel = reference.tripletFeel;

    // Inserting before bar 0: the song-start tempo automation lives on the old
    // first bar. It must move to the new first bar, or export falls back to the
    // default tempo and the song starts at the wrong speed.
    if (index === 0) {
        const startTempo = reference.tempoAutomations.findIndex((a) => a.ratioPosition === 0);
        if (startTempo >= 0) {
            masterBar.tempoAutomations.push(reference.tempoAutomations[startTempo]);
            reference.tempoAutomations.splice(startTempo, 1);
        }
    }

    score.masterBars.splice(index, 0, masterBar);
    masterBar.score = score;

    for (const track of score.tracks) {
        for (const staff of track.staves) {
            const refBar = staff.bars[Math.max(0, Math.min(index - 1, staff.bars.length - 1))];

            const bar = new alphaTab.model.Bar();
            bar.clef = refBar.clef;
            bar.clefOttava = refBar.clefOttava;
            bar.keySignature = refBar.keySignature;
            bar.keySignatureType = refBar.keySignatureType;

            // Mirror the reference bar's voice layout: voice 0 becomes a real
            // rest voice (padded by normalization), extra GP voice slots stay
            // placeholder-empty.
            for (let v = 0; v < refBar.voices.length; v++) {
                const voice = new alphaTab.model.Voice();
                const beat = new alphaTab.model.Beat();
                beat.duration = alphaTab.model.Duration.Whole;
                if (v > 0) {
                    beat.isEmpty = true;
                }
                voice.addBeat(beat);
                bar.addVoice(voice);
            }

            staff.bars.splice(index, 0, bar);
            bar.staff = staff;
        }
    }
}

/** Append a rest-only bar at the end of the score. */
export function appendBar(score: Score): void {
    insertBar(score, score.masterBars.length);
}

/** Delete the bar at `index` from the masterbars and every staff. */
export function deleteBar(score: Score, index: number): void {
    if (score.masterBars.length <= 1) {
        throw new EditorValidationError("Cannot delete the only bar of the score");
    }
    if (index < 0 || index >= score.masterBars.length) {
        throw new EditorValidationError(`Invalid bar index ${index}`);
    }

    // Deleting bar 0: carry its song-start tempo over to the next bar unless
    // that bar already sets its own tempo (an explicit change takes over).
    if (index === 0) {
        const removed = score.masterBars[0];
        const next = score.masterBars[1];
        const startTempo = removed.tempoAutomations.find((a) => a.ratioPosition === 0);
        const nextHasOwn = next.tempoAutomations.some((a) => a.ratioPosition === 0);
        if (startTempo && !nextHasOwn) {
            next.tempoAutomations.unshift(startTempo);
        }
    }

    score.masterBars.splice(index, 1);
    for (const track of score.tracks) {
        for (const staff of track.staves) {
            staff.bars.splice(index, 1);
        }
    }
}
