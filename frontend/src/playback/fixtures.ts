/**
 * Shared fixtures for the playback non-regression suite.
 *
 * The suite guards the pipeline the player depends on:
 *   score model -> MIDI generation (what the synth plays)
 *   score model -> Gp7Exporter -> ScoreLoader (what Save writes / the viewer reloads)
 *   score model -> JsonConverter (the editor's structural-edit rebuild path)
 */
import * as alphaTab from "@coderline/alphatab";

/**
 * A playback-rich score: initial tempo 96, distorted guitar (program 30),
 * a mid-song tempo change to 90 plus a 3/4 time-signature change, and a
 * repeated section. alphaTex string numbers are guitarist-style (1 = highest).
 *
 * IMPORTANT: the initial tempo is deliberately NOT 120 — 120 is alphaTab's
 * default, so a fixture at 120 cannot detect "initial tempo dropped and fell
 * back to the default" regressions (that is exactly how the 2026-07-06
 * insertBar(0) tempo-loss bug stayed invisible at first).
 */
export const TEX_PLAYBACK = `\\title "Playback Fixture"
\\tempo 96
\\instrument 30
.
\\ts 4 4 3.3.4 5.3.4 7.4.4 5.2.4 |
\\ro \\ts 3 4 \\tempo 90 3.3.4 5.3.4 7.4.4 |
\\rc 2 3.3.4 5.3.4 7.4.4`;

export interface PlaybackFixture {
    score: alphaTab.model.Score;
    settings: alphaTab.Settings;
}

export function loadPlaybackTex(tex: string = TEX_PLAYBACK): PlaybackFixture {
    const settings = new alphaTab.Settings();
    const score = alphaTab.importer.ScoreLoader.loadAlphaTex(tex, settings);
    return { score, settings };
}

/** Give track 0 clearly non-default playback info so round-trip loss is visible. */
export function markPlaybackInfo(score: alphaTab.model.Score): void {
    const info = score.tracks[0].playbackInfo;
    info.volume = 11;
    info.balance = 3;
    info.isMute = false;
    info.isSolo = true;
}

/** Generate the synth MIDI for a score, exactly like AlphaTabApi.loadMidiForScore does. */
export function generateMidi(score: alphaTab.model.Score, settings: alphaTab.Settings) {
    const midiFile = new alphaTab.midi.MidiFile();
    const handler = new alphaTab.midi.AlphaSynthMidiFileHandler(midiFile);
    const generator = new alphaTab.midi.MidiFileGenerator(score, settings, handler);
    generator.generate();
    return { midiFile, generator };
}

/** All MIDI events of a given type. */
export function eventsOfType(midiFile: alphaTab.midi.MidiFile, type: alphaTab.midi.MidiEventType) {
    return midiFile.events.filter((e) => e.type === type);
}

/** Export with Gp7Exporter and reload — the editor's exact Save pipeline. */
export function gp7RoundTrip(score: alphaTab.model.Score, settings: alphaTab.Settings): alphaTab.model.Score {
    const bytes = new alphaTab.exporter.Gp7Exporter().export(score, settings);
    return alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
}
