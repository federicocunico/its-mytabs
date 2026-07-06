/**
 * Playback category — MIDI generation.
 *
 * The synth plays whatever MidiFileGenerator produces from the score model.
 * These tests pin that pipeline headlessly (no AudioContext involved) so a
 * model or generator regression is caught before it reaches the player.
 */
import { describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import { eventsOfType, generateMidi, loadPlaybackTex } from "./fixtures.ts";

describe("MIDI generation from the score model", () => {
    it("produces note-on events for every played note (repeats expanded)", () => {
        const { score, settings } = loadPlaybackTex();
        const { midiFile } = generateMidi(score, settings);

        const noteOns = eventsOfType(midiFile, alphaTab.midi.MidiEventType.NoteOn)
            // channel 9 is the metronome/percussion channel alphaTab may emit on
            .filter((e) => (e as alphaTab.midi.NoteOnEvent).channel !== 9);

        // Bar 1: 4 notes. Bars 2+3 are a repeated section played twice: (3+3)*2.
        expect(noteOns.length).toBe(4 + (3 + 3) * 2);
    });

    it("emits the initial tempo and the mid-song tempo change", () => {
        const { score, settings } = loadPlaybackTex();
        const { midiFile } = generateMidi(score, settings);

        const tempos = eventsOfType(midiFile, alphaTab.midi.MidiEventType.TempoChange)
            .map((e) => ({
                tick: e.tick,
                bpm: Math.round(60000000 / (e as alphaTab.midi.TempoChangeEvent).microSecondsPerQuarterNote),
            }));

        expect(tempos[0]).toEqual({ tick: 0, bpm: 96 });
        // Bar 2 starts after a full 4/4 bar = 4 * 960 ticks.
        expect(tempos).toContainEqual({ tick: 3840, bpm: 90 });
    });

    it("builds a tick lookup that resolves mid-song positions to bars", () => {
        const { score, settings } = loadPlaybackTex();
        const { generator } = generateMidi(score, settings);

        const lookup = generator.tickLookup;
        expect(lookup.masterBars.length).toBeGreaterThanOrEqual(3);

        // A tick inside the second bar must resolve to masterbar index 1.
        const secondBar = lookup.masterBars.find((mb) => mb.start <= 4000 && mb.end > 4000);
        expect(secondBar).toBeTruthy();
        expect(secondBar!.masterBar.index).toBe(1);
    });

    it("honours the track's MIDI program in the generated events", () => {
        const { score, settings } = loadPlaybackTex();
        expect(score.tracks[0].playbackInfo.program).toBe(30);

        const { midiFile } = generateMidi(score, settings);
        const programChanges = eventsOfType(midiFile, alphaTab.midi.MidiEventType.ProgramChange)
            .map((e) => (e as alphaTab.midi.ProgramChangeEvent).program);
        expect(programChanges).toContain(30);
    });
});
