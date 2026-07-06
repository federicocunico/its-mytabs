/**
 * Normalization keeps the score musically consistent after mutations:
 * - under-full voices are padded with rests (bars always account for their full duration)
 * - over-full voices are NEVER truncated; they are reported as warnings instead
 * - derived state (beat chains, tie targets, lookups) is recomputed via score.finish(),
 *   which is idempotent (verified by test).
 */
import * as alphaTab from "@coderline/alphatab";

type Score = alphaTab.model.Score;
type Bar = alphaTab.model.Bar;
type Beat = alphaTab.model.Beat;
type Voice = alphaTab.model.Voice;
type Settings = alphaTab.Settings;

const { Duration } = alphaTab.model;

export interface BarWarning {
    trackIndex: number;
    barIndex: number;
    kind: "overflow";
}

/** Ticks of a whole note (alphaTab uses 960 per quarter). */
const WHOLE_TICKS = 3840;

/** Rest durations used for greedy padding, largest first. */
const PAD_DURATIONS: alphaTab.model.Duration[] = [
    Duration.Whole,
    Duration.Half,
    Duration.Quarter,
    Duration.Eighth,
    Duration.Sixteenth,
    Duration.ThirtySecond,
    Duration.SixtyFourth,
];

export function durationTicks(duration: alphaTab.model.Duration): number {
    // Negative enum values are multiples of a whole note (DoubleWhole = -2, QuadrupleWhole = -4)
    return duration > 0 ? WHOLE_TICKS / duration : WHOLE_TICKS * -duration;
}

/** Display ticks of a beat from its own fields (independent of finish() state). */
export function beatTicks(beat: Beat): number {
    let ticks = durationTicks(beat.duration);

    // Each dot extends by half of the previous value: x1.5, x1.75
    if (beat.dots === 1) {
        ticks = ticks * 1.5;
    } else if (beat.dots >= 2) {
        ticks = ticks * 1.75;
    }

    if (beat.hasTuplet) {
        ticks = ticks * beat.tupletDenominator / beat.tupletNumerator;
    }

    return ticks;
}

/** A placeholder-empty voice (unused GP voice slot) must not be padded. */
function isPlaceholderVoice(voice: Voice): boolean {
    return voice.beats.length > 0 && voice.beats.every((b) => b.isEmpty);
}

function usedTicks(voice: Voice): number {
    let total = 0;
    for (const beat of voice.beats) {
        total += beatTicks(beat);
    }
    return total;
}

function padVoiceWithRests(voice: Voice, missing: number): void {
    for (const duration of PAD_DURATIONS) {
        const ticks = durationTicks(duration);
        while (missing >= ticks) {
            const rest = new alphaTab.model.Beat();
            rest.duration = duration;
            voice.addBeat(rest);
            missing -= ticks;
        }
    }
}

/**
 * True when the bar contains no notes at all (only rests / placeholder voices).
 * Computed from the current beats — alphaTab's `Bar.isRestOnly` is a
 * finish()-cached field and can be stale mid-transaction.
 */
export function isBarRestOnly(bar: Bar): boolean {
    for (const voice of bar.voices) {
        if (isPlaceholderVoice(voice)) {
            continue;
        }
        for (const beat of voice.beats) {
            if (!beat.isRest) {
                return false;
            }
        }
    }
    return true;
}

/**
 * True when the beat at `index` is a rest in the voice's trailing run of rests
 * AND deleting it would leave the voice under-full — normalization would
 * immediately re-pad it, so the deletion is a guaranteed no-op. Trailing rests
 * of an over-full voice are NOT redundant: deleting them reduces the overflow.
 */
export function isRedundantTrailingRest(voice: Voice, index: number): boolean {
    const beat = voice.beats[index];
    if (!beat || !beat.isRest) {
        return false;
    }
    for (let i = index + 1; i < voice.beats.length; i++) {
        if (!voice.beats[i].isRest) {
            return false;
        }
    }
    const capacity = voice.bar.masterBar.calculateDuration();
    return usedTicks(voice) - beatTicks(beat) < capacity;
}

export type BarFillState = "ok" | "under" | "over";

/**
 * Validate a bar's content against its time signature.
 * A voice containing exactly one rest beat is a valid full-bar rest regardless
 * of the rest's written duration (standard notation convention) — this keeps
 * empty/blank bars from being flagged.
 */
export function checkBarFill(bar: Bar): BarFillState {
    const capacity = bar.masterBar.calculateDuration();
    let under = false;

    for (const voice of bar.voices) {
        if (isPlaceholderVoice(voice)) {
            continue;
        }
        if (voice.beats.length === 1 && voice.beats[0].isRest) {
            continue; // full-bar rest
        }

        const used = usedTicks(voice);
        if (used > capacity) {
            return "over";
        }
        if (used < capacity) {
            under = true;
        }
    }

    return under ? "under" : "ok";
}

/**
 * Tier-2 normalization: rebuild the whole score through alphaTab's own
 * serialization pipeline. Used after structural edits (bar insert/delete) and
 * for undo/redo restores — the fresh graph has all linking recomputed by the
 * importer, exactly as if the file had been loaded from disk.
 * NOTE: the returned Score is a NEW object graph; object references die.
 */
export function rebuildScore(score: Score, settings: Settings): Score {
    const obj = alphaTab.model.JsonConverter.scoreToJsObject(score);
    return alphaTab.model.JsonConverter.jsObjectToScore(obj, settings);
}

/**
 * Re-establish invariants after a transaction's mutations.
 * @param touchedBars bars whose voices may be under/over-full
 * @returns overflow warnings (over-full voices are kept as-is)
 */
export function normalizeScore(score: Score, settings: Settings, touchedBars: Iterable<Bar>): BarWarning[] {
    const warnings: BarWarning[] = [];

    for (const bar of touchedBars) {
        const capacity = bar.masterBar.calculateDuration();

        for (const voice of bar.voices) {
            if (isPlaceholderVoice(voice)) {
                continue;
            }

            const used = usedTicks(voice);
            if (used < capacity) {
                padVoiceWithRests(voice, capacity - used);
            } else if (used > capacity) {
                warnings.push({
                    trackIndex: bar.staff.track.index,
                    barIndex: bar.index,
                    kind: "overflow",
                });
            }
        }
    }

    // Recompute all derived state (beat chains, tie/effect targets, lookups).
    // Idempotent — verified by normalize.test.ts.
    score.finish(settings);

    return warnings;
}
