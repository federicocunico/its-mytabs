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
