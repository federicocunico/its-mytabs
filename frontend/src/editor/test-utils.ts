/**
 * Shared helpers for editor engine tests.
 */
import * as alphaTab from "@coderline/alphatab";

export interface TexFixture {
    score: alphaTab.model.Score;
    settings: alphaTab.Settings;
}

export function loadTex(tex: string): TexFixture {
    const settings = new alphaTab.Settings();
    const score = alphaTab.importer.ScoreLoader.loadAlphaTex(tex, settings);
    return { score, settings };
}

/**
 * A 4/4 guitar bar with four quarter notes, then a second bar with two halves.
 * NOTE: alphaTex string numbers are guitarist-style (1 = highest), while the
 * model's note.string is 1 = lowest. On a 6-string: model = 7 - tex.
 * Model view of bar 0: 3@s4, 5@s4, 7@s3, 5@s5. Bar 1: 3@s4, 5@s4.
 */
export const TEX_TWO_BARS = `\\ts 4 4 3.3.4 5.3.4 7.4.4 5.2.4 | :2 3.3 5.3`;

export function voice0(score: alphaTab.model.Score, barIndex: number): alphaTab.model.Voice {
    return score.tracks[0].staves[0].bars[barIndex].voices[0];
}

/** Serialize the full score to alphaTab's own JSON format (used for deep equality). */
export function scoreJson(score: alphaTab.model.Score): string {
    return alphaTab.model.JsonConverter.scoreToJson(score);
}

/** Walk the song-wide beat chain of track 0 staff 0 voice 0 and return [fret-or-"r"] per beat. */
export function walkBeatChain(score: alphaTab.model.Score): string[] {
    const result: string[] = [];
    let beat: alphaTab.model.Beat | null = score.tracks[0].staves[0].bars[0].voices[0].beats[0];
    let guard = 0;
    while (beat && guard++ < 1000) {
        result.push(beat.isRest ? "r" : String(beat.notes.map((n) => n.fret).join(",")));
        beat = beat.nextBeat;
    }
    return result;
}
