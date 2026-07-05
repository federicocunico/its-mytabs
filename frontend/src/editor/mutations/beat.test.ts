import { describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import { loadTex, TEX_TWO_BARS, voice0, walkBeatChain } from "../test-utils.ts";
import { deleteBeat, insertBeatAt, makeRest, setBeatDots, setBeatDuration } from "./beat.ts";
import { normalizeScore } from "../normalize.ts";

const { Duration } = alphaTab.model;

describe("setBeatDuration / setBeatDots", () => {
    it("changes duration; under-full bar gets padded on normalize", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const voice = voice0(score, 0);

        setBeatDuration(voice.beats[0], Duration.Eighth);
        const warnings = normalizeScore(score, settings, [voice.bar]);

        expect(warnings).toEqual([]);
        expect(voice.beats[0].duration).toBe(Duration.Eighth);
        // 1/8 missing -> one eighth rest appended
        const last = voice.beats[voice.beats.length - 1];
        expect(last.isRest).toBe(true);
        expect(last.duration).toBe(Duration.Eighth);
    });

    it("toggles dots", () => {
        const { score } = loadTex(TEX_TWO_BARS);
        const beat = voice0(score, 0).beats[0];
        setBeatDots(beat, 1);
        expect(beat.dots).toBe(1);
        setBeatDots(beat, 0);
        expect(beat.dots).toBe(0);
    });
});

describe("makeRest", () => {
    it("clears all notes so the beat becomes a rest", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const beat = voice0(score, 0).beats[0];

        makeRest(beat);
        normalizeScore(score, settings, [beat.voice.bar]);

        expect(beat.isRest).toBe(true);
        expect(beat.notes.length).toBe(0);
    });
});

describe("insertBeatAt", () => {
    it("inserts a rest beat at the index and shifts the rest", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const voice = voice0(score, 0);

        const inserted = insertBeatAt(voice, 1, Duration.Quarter);
        normalizeScore(score, settings, [voice.bar]);

        expect(voice.beats[1]).toBe(inserted);
        expect(inserted.isRest).toBe(true);
        expect(walkBeatChain(score).slice(0, 5)).toEqual(["3", "r", "5", "7", "5"]);
    });
});

describe("deleteBeat", () => {
    it("removes the beat; normalize pads the bar back to full", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const voice = voice0(score, 0);

        deleteBeat(voice, 1); // remove 5@s3
        normalizeScore(score, settings, [voice.bar]);

        expect(walkBeatChain(score)).toEqual(["3", "7", "5", "r", "3", "5"]);
    });

    it("deleting the only beat leaves a whole-rest bar", () => {
        const { score, settings } = loadTex(`\\ts 4 4 3.3.1 | 5.3.1`);
        const voice = voice0(score, 0);

        deleteBeat(voice, 0);
        normalizeScore(score, settings, [voice.bar]);

        expect(voice.beats.length).toBe(1);
        expect(voice.beats[0].isRest).toBe(true);
        expect(voice.beats[0].duration).toBe(Duration.Whole);
    });
});
