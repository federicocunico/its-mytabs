import { describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import { loadTex, scoreJson, TEX_TWO_BARS, voice0, walkBeatChain } from "./test-utils.ts";
import { beatTicks, normalizeScore } from "./normalize.ts";

const { Duration } = alphaTab.model;

describe("beatTicks", () => {
    it("computes ticks from duration", () => {
        const beat = new alphaTab.model.Beat();
        beat.duration = Duration.Quarter;
        expect(beatTicks(beat)).toBe(960);
        beat.duration = Duration.Whole;
        expect(beatTicks(beat)).toBe(3840);
        beat.duration = Duration.Sixteenth;
        expect(beatTicks(beat)).toBe(240);
    });

    it("applies dots", () => {
        const beat = new alphaTab.model.Beat();
        beat.duration = Duration.Quarter;
        beat.dots = 1;
        expect(beatTicks(beat)).toBe(1440);
        beat.dots = 2;
        expect(beatTicks(beat)).toBe(1680);
    });

    it("applies tuplets", () => {
        const beat = new alphaTab.model.Beat();
        beat.duration = Duration.Eighth;
        beat.tupletNumerator = 3;
        beat.tupletDenominator = 2;
        expect(beatTicks(beat)).toBe(320);
    });
});

describe("normalizeScore", () => {
    it("whole-score finish() re-run is idempotent (Tier-1 foundation)", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const before = scoreJson(score);
        score.finish(settings);
        expect(scoreJson(score)).toBe(before);
    });

    it("pads an under-full voice with rests up to the bar duration", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const voice = voice0(score, 0);

        // Delete the last quarter beat -> 3/4 filled bar in 4/4
        voice.beats.splice(3, 1);
        const warnings = normalizeScore(score, settings, [voice.bar]);

        expect(warnings).toEqual([]);
        expect(voice.beats.length).toBe(4);
        const padded = voice.beats[3];
        expect(padded.isRest).toBe(true);
        expect(padded.duration).toBe(Duration.Quarter);
        expect(voice.calculateDuration()).toBe(voice.bar.masterBar.calculateDuration());
    });

    it("pads with greedy largest-fit rests (half + quarter for a 3-quarter gap)", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const voice = voice0(score, 0);

        // Keep only the first quarter note -> 3 quarters missing
        voice.beats.splice(1, 3);
        normalizeScore(score, settings, [voice.bar]);

        expect(voice.beats.length).toBe(3);
        expect(voice.beats[1].isRest).toBe(true);
        expect(voice.beats[1].duration).toBe(Duration.Half);
        expect(voice.beats[2].isRest).toBe(true);
        expect(voice.beats[2].duration).toBe(Duration.Quarter);
    });

    it("replaces a fully-emptied voice with a whole rest", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const voice = voice0(score, 0);

        voice.beats.splice(0, voice.beats.length);
        normalizeScore(score, settings, [voice.bar]);

        expect(voice.beats.length).toBe(1);
        expect(voice.beats[0].isRest).toBe(true);
        expect(voice.beats[0].duration).toBe(Duration.Whole);
    });

    it("keeps over-full voices intact and reports an overflow warning", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const voice = voice0(score, 0);

        // Grow the last beat: quarter -> half => 4.5/4 total
        voice.beats[3].duration = Duration.Half;
        const warnings = normalizeScore(score, settings, [voice.bar]);

        expect(voice.beats.length).toBe(4);
        expect(warnings).toEqual([{ trackIndex: 0, barIndex: 0, kind: "overflow" }]);
    });

    it("relinks the song-wide beat chain after a structural change", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const voice = voice0(score, 0);

        voice.beats.splice(3, 1); // delete beat 4 of bar 1
        normalizeScore(score, settings, [voice.bar]);

        // chain: 3, 5, 7, padded rest, then bar 2's two half notes
        expect(walkBeatChain(score)).toEqual(["3", "5", "7", "r", "3", "5"]);
    });

    it("does not pad placeholder-empty voices (GP multi-voice files)", () => {
        const { score, settings } = loadTex(TEX_TWO_BARS);
        const bar = score.tracks[0].staves[0].bars[0];

        // GP files carry unused voice slots holding a single empty beat. Every bar
        // of a staff must have the same voice count, so add the slot to all bars.
        for (const b of score.tracks[0].staves[0].bars) {
            const emptyVoice = new alphaTab.model.Voice();
            const emptyBeat = new alphaTab.model.Beat();
            emptyBeat.isEmpty = true;
            emptyVoice.addBeat(emptyBeat);
            b.addVoice(emptyVoice);
        }
        const emptyVoice = bar.voices[1];
        score.finish(settings);

        normalizeScore(score, settings, [bar]);

        expect(emptyVoice.beats.length).toBe(1);
        expect(emptyVoice.isEmpty).toBe(true);
    });
});
