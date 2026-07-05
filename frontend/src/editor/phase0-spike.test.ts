/**
 * Phase 0 spike tests — answer the design's open technical questions:
 *   1. Does the alphaTab model/importer/exporter layer run headless (Node)?
 *   2. Is re-running voice.finish() idempotent (Tier-1 normalization viability)?
 *   3. Does JsonConverter round-trip a score losslessly (undo mechanism)?
 *   4. Does Gp7Exporter round-trip edits (save mechanism)?
 */
import { describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";

const { Settings } = alphaTab;
const { ScoreLoader } = alphaTab.importer;
const { JsonConverter, Duration } = alphaTab.model;

const TEX = `\\title "Spike" \\tempo 120 . \\ts 4 4 3.3.4 5.3.4 7.4.4 (3.3 5.4).4 | 8.3.8 10.3.8 :2 12.3 | r.1`;

function loadTex(): alphaTab.model.Score {
    const settings = new Settings();
    return ScoreLoader.loadAlphaTex(TEX, settings);
}

describe("phase 0 spikes", () => {
    it("loads alphaTex headless in Node", () => {
        const score = loadTex();
        expect(score.tracks.length).toBe(1);
        expect(score.masterBars.length).toBe(3);
        const bar0 = score.tracks[0].staves[0].bars[0];
        expect(bar0.voices[0].beats.length).toBe(4);
        expect(bar0.voices[0].beats[0].notes[0].fret).toBe(3);
    });

    it("re-running voice.finish() is idempotent", () => {
        const settings = new Settings();
        const score = ScoreLoader.loadAlphaTex(TEX, settings);

        const capture = () => {
            const rows: unknown[] = [];
            for (const staff of score.tracks[0].staves) {
                for (const bar of staff.bars) {
                    for (const voice of bar.voices) {
                        for (const beat of voice.beats) {
                            rows.push({
                                bar: bar.index,
                                beat: beat.index,
                                duration: beat.duration,
                                dots: beat.dots,
                                playbackStart: beat.playbackStart,
                                playbackDuration: beat.playbackDuration,
                                displayStart: beat.displayStart,
                                notes: beat.notes.map((n) => ({ fret: n.fret, string: n.string })),
                            });
                        }
                    }
                }
            }
            return JSON.stringify(rows);
        };

        const before = capture();

        // Re-run finish on every voice/bar as Tier-1 normalization would
        const sharedDataBag = new Map<string, unknown>();
        for (const staff of score.tracks[0].staves) {
            for (const bar of staff.bars) {
                for (const voice of bar.voices) {
                    voice.finish(settings, sharedDataBag);
                }
            }
        }

        expect(capture()).toBe(before);
    });

    it("JsonConverter round-trips a score losslessly", () => {
        const settings = new Settings();
        const score = ScoreLoader.loadAlphaTex(TEX, settings);
        const json = JsonConverter.scoreToJson(score);
        const restored = JsonConverter.jsonToScore(json, settings);
        expect(JsonConverter.scoreToJson(restored)).toBe(json);
        expect(restored.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(3);
    });

    it("supports basic mutation + re-finish (add a note to an existing beat)", () => {
        const settings = new Settings();
        const score = ScoreLoader.loadAlphaTex(TEX, settings);
        const voice = score.tracks[0].staves[0].bars[0].voices[0];
        const beat = voice.beats[0];

        const note = new alphaTab.model.Note();
        note.fret = 5;
        note.string = 2;
        beat.addNote(note);
        voice.finish(settings, new Map());

        expect(beat.notes.length).toBe(2);
        expect(beat.hasNoteOnString(2)).toBe(true);
    });

    it("Gp7Exporter round-trips an edited score", () => {
        const settings = new Settings();
        const score = ScoreLoader.loadAlphaTex(TEX, settings);

        // Edit: change first note's fret and beat duration
        const voice = score.tracks[0].staves[0].bars[0].voices[0];
        voice.beats[0].notes[0].fret = 9;
        voice.beats[0].duration = Duration.Eighth;
        voice.finish(settings, new Map());

        const bytes = new alphaTab.exporter.Gp7Exporter().export(score, settings);
        expect(bytes.length).toBeGreaterThan(0);

        const reloaded = ScoreLoader.loadScoreFromBytes(bytes, settings);
        const rBeat = reloaded.tracks[0].staves[0].bars[0].voices[0].beats[0];
        expect(rBeat.notes[0].fret).toBe(9);
        expect(rBeat.duration).toBe(Duration.Eighth);
    });
});
