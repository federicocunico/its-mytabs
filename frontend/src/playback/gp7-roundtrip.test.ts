/**
 * Playback category — GP7 export/reload round-trip.
 *
 * Saving in the editor replaces the tab file with Gp7Exporter output, which
 * the viewer then reloads. Anything this round-trip drops changes how a saved
 * tab PLAYS. These tests pin every playback-relevant field.
 */
import { describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import { eventsOfType, generateMidi, gp7RoundTrip, loadPlaybackTex, markPlaybackInfo } from "./fixtures.ts";

describe("Gp7 export -> reload round-trip", () => {
    it("produces a PK zip container (what the backend save endpoint validates)", () => {
        const { score, settings } = loadPlaybackTex();
        const bytes = new alphaTab.exporter.Gp7Exporter().export(score, settings);
        expect(bytes[0]).toBe(0x50); // P
        expect(bytes[1]).toBe(0x4b); // K
    });

    it("preserves the initial tempo and mid-song tempo automation", () => {
        const { score, settings } = loadPlaybackTex();
        const reloaded = gp7RoundTrip(score, settings);

        expect(reloaded.tempo).toBe(96);
        expect(reloaded.masterBars[0].tempoAutomations[0]?.value).toBe(96);
        expect(reloaded.masterBars[1].tempoAutomations[0]?.value).toBe(90);
    });

    it("preserves time signatures and repeats", () => {
        const { score, settings } = loadPlaybackTex();
        const reloaded = gp7RoundTrip(score, settings);

        expect(reloaded.masterBars[0].timeSignatureNumerator).toBe(4);
        expect(reloaded.masterBars[1].timeSignatureNumerator).toBe(3);
        expect(reloaded.masterBars[1].isRepeatStart).toBe(true);
        expect(reloaded.masterBars[2].repeatCount).toBe(2);
    });

    it("preserves the track playback info (program, volume, balance, solo)", () => {
        const { score, settings } = loadPlaybackTex();
        markPlaybackInfo(score);
        const reloaded = gp7RoundTrip(score, settings);

        const info = reloaded.tracks[0].playbackInfo;
        expect(info.program).toBe(30);
        expect(info.volume).toBe(11);
        expect(info.balance).toBe(3);
        expect(info.isSolo).toBe(true);
        expect(info.isMute).toBe(false);
    });

    it("preserves the staff tuning", () => {
        const { score, settings } = loadPlaybackTex();
        const original = [...score.tracks[0].staves[0].tuning];
        const reloaded = gp7RoundTrip(score, settings);
        expect([...reloaded.tracks[0].staves[0].tuning]).toEqual(original);
    });

    it("regenerates the same note-on/tempo MIDI profile after the round-trip", () => {
        const { score, settings } = loadPlaybackTex();
        const profile = (s: alphaTab.model.Score) => {
            const { midiFile } = generateMidi(s, settings);
            return {
                noteOns: eventsOfType(midiFile, alphaTab.midi.MidiEventType.NoteOn).length,
                tempos: eventsOfType(midiFile, alphaTab.midi.MidiEventType.TempoChange)
                    .map((e) => (e as alphaTab.midi.TempoChangeEvent).microSecondsPerQuarterNote),
            };
        };
        const before = profile(score);
        const after = profile(gp7RoundTrip(score, settings));
        expect(after).toEqual(before);
    });
});
