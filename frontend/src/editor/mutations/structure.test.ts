import { describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import { loadTex, voice0 } from "../test-utils.ts";
import { addTrack, removeTrack, setKeySignature, setRepeat, setSection, setStaffTuning, setTempo, setTimeSignature, setTripletFeel } from "./structure.ts";
import { normalizeScore, rebuildScore } from "../normalize.ts";
import { EditorValidationError } from "../validation.ts";

const { KeySignature, KeySignatureType, TripletFeel } = alphaTab.model;

const TEX = `\\ts 4 4 3.3.4 5.3.4 7.3.4 5.3.4 | 3.3.4 5.3.4 7.3.4 5.3.4 | 3.3.1`;

describe("setTimeSignature", () => {
    it("changes one bar's time signature", () => {
        const { score, settings } = loadTex(TEX);
        setTimeSignature(score, 0, 3, 4, false);
        const warnings = normalizeScore(score, settings, [score.tracks[0].staves[0].bars[0]]);

        expect(score.masterBars[0].timeSignatureNumerator).toBe(3);
        expect(score.masterBars[1].timeSignatureNumerator).toBe(4);
        // the 4-quarter bar is now over-full in 3/4 -> warned, not truncated
        expect(warnings).toEqual([{ trackIndex: 0, barIndex: 0, kind: "overflow" }]);
    });

    it("applies to following bars with the same old signature", () => {
        const { score } = loadTex(TEX);
        setTimeSignature(score, 1, 6, 8, true);
        expect(score.masterBars.map((mb) => `${mb.timeSignatureNumerator}/${mb.timeSignatureDenominator}`)).toEqual(["4/4", "6/8", "6/8"]);
    });

    it("rejects invalid signatures", () => {
        const { score } = loadTex(TEX);
        expect(() => setTimeSignature(score, 0, 0, 4, false)).toThrow(EditorValidationError);
        expect(() => setTimeSignature(score, 0, 4, 3, false)).toThrow(EditorValidationError);
    });
});

describe("setTempo", () => {
    it("sets a tempo automation on the master bar", () => {
        const { score } = loadTex(TEX);
        setTempo(score.masterBars[1], 140);
        expect(score.masterBars[1].tempoAutomations.length).toBe(1);
        expect(score.masterBars[1].tempoAutomations[0].value).toBe(140);
    });

    it("replaces an existing automation and validates the range", () => {
        const { score } = loadTex(TEX);
        setTempo(score.masterBars[1], 140);
        setTempo(score.masterBars[1], 90);
        expect(score.masterBars[1].tempoAutomations.length).toBe(1);
        expect(score.masterBars[1].tempoAutomations[0].value).toBe(90);
        expect(() => setTempo(score.masterBars[0], 5)).toThrow(EditorValidationError);
    });
});

describe("setKeySignature", () => {
    it("applies to the bars of every track at the index", () => {
        const { score, settings } = loadTex(TEX);
        setKeySignature(score, 1, KeySignature.D, KeySignatureType.Major, false);
        normalizeScore(score, settings, []);

        for (const track of score.tracks) {
            expect(track.staves[0].bars[1].keySignature).toBe(KeySignature.D);
            expect(track.staves[0].bars[0].keySignature).toBe(KeySignature.C);
        }
    });
});

describe("repeats / sections / feel", () => {
    it("sets repeat start/end and rebuilds repeat groups", () => {
        const { score, settings } = loadTex(TEX);
        setRepeat(score, 0, { start: true });
        setRepeat(score, 1, { count: 2 });
        normalizeScore(score, settings, []);

        expect(score.masterBars[0].isRepeatStart).toBe(true);
        expect(score.masterBars[1].repeatCount).toBe(2);
        expect(score.masterBars[1].isRepeatEnd).toBe(true);
    });

    it("sets and clears sections", () => {
        const { score } = loadTex(TEX);
        setSection(score.masterBars[0], "Chorus");
        expect(score.masterBars[0].section!.text).toBe("Chorus");
        setSection(score.masterBars[0], null);
        expect(score.masterBars[0].section == null).toBe(true);
    });

    it("sets triplet feel", () => {
        const { score } = loadTex(TEX);
        setTripletFeel(score.masterBars[0], TripletFeel.Triplet8th);
        expect(score.masterBars[0].tripletFeel).toBe(TripletFeel.Triplet8th);
    });
});

describe("tracks", () => {
    it("adds a track padded to the score length with unique channels", () => {
        let { score, settings } = loadTex(TEX);

        addTrack(score, { name: "Bass", tuning: [43, 38, 33, 28], program: 33 });
        score = rebuildScore(score, settings);

        expect(score.tracks.length).toBe(2);
        const bass = score.tracks[1];
        expect(bass.name).toBe("Bass");
        expect(bass.staves[0].bars.length).toBe(score.masterBars.length);
        expect(bass.staves[0].tuning.length).toBe(4);
        expect(bass.playbackInfo.program).toBe(33);
        expect(bass.playbackInfo.primaryChannel).not.toBe(score.tracks[0].playbackInfo.primaryChannel);

        // export survives
        const bytes = new alphaTab.exporter.Gp7Exporter().export(score, settings);
        const reloaded = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
        expect(reloaded.tracks.length).toBe(2);
        expect(reloaded.tracks[1].staves[0].tuning.length).toBe(4);
    });

    it("removes a track but never the last one", () => {
        let { score, settings } = loadTex(TEX);
        addTrack(score, { name: "Bass", tuning: [43, 38, 33, 28], program: 33 });
        score = rebuildScore(score, settings);

        removeTrack(score, 1);
        score = rebuildScore(score, settings);
        expect(score.tracks.length).toBe(1);

        expect(() => removeTrack(score, 0)).toThrow(EditorValidationError);
    });

    it("re-tunes a staff with the same string count", () => {
        const { score, settings } = loadTex(TEX);
        const staff = score.tracks[0].staves[0];
        const dropD = [64, 59, 55, 50, 45, 38];

        setStaffTuning(staff, dropD, 0);
        normalizeScore(score, settings, []);

        expect([...staff.tuning]).toEqual(dropD);
    });

    it("rejects a string-count change when the staff has notes", () => {
        const { score } = loadTex(TEX);
        const staff = score.tracks[0].staves[0];
        expect(() => setStaffTuning(staff, [43, 38, 33, 28], 0)).toThrow(EditorValidationError);
    });
});
