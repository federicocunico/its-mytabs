/**
 * Playback category — JsonConverter round-trip (the editor's rebuildScore path).
 *
 * Every structural edit (bar/track splice, time-sig change, undo/redo) rebuilds
 * the score through JsonConverter. Anything dropped here silently degrades the
 * score the user keeps editing and eventually saves.
 */
import { describe, expect, it } from "vitest";
import { rebuildScore } from "../editor/normalize.ts";
import { loadPlaybackTex, markPlaybackInfo } from "./fixtures.ts";

describe("rebuildScore (JsonConverter) round-trip", () => {
    it("preserves tempo automations", () => {
        const { score, settings } = loadPlaybackTex();
        const rebuilt = rebuildScore(score, settings);

        expect(rebuilt.tempo).toBe(96);
        expect(rebuilt.masterBars[0].tempoAutomations[0]?.value).toBe(96);
        expect(rebuilt.masterBars[1].tempoAutomations[0]?.value).toBe(90);
    });

    it("preserves time signatures and repeats", () => {
        const { score, settings } = loadPlaybackTex();
        const rebuilt = rebuildScore(score, settings);

        expect(rebuilt.masterBars[1].timeSignatureNumerator).toBe(3);
        expect(rebuilt.masterBars[1].isRepeatStart).toBe(true);
        expect(rebuilt.masterBars[2].repeatCount).toBe(2);
    });

    it("preserves playback info and tuning", () => {
        const { score, settings } = loadPlaybackTex();
        markPlaybackInfo(score);
        const originalTuning = [...score.tracks[0].staves[0].tuning];
        const rebuilt = rebuildScore(score, settings);

        const info = rebuilt.tracks[0].playbackInfo;
        expect(info.program).toBe(30);
        expect(info.volume).toBe(11);
        expect(info.balance).toBe(3);
        expect(info.isSolo).toBe(true);
        expect([...rebuilt.tracks[0].staves[0].tuning]).toEqual(originalTuning);
    });
});
