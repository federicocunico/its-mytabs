/**
 * Playback category — pins for bugs found during the 2026-07-06 diagnosis.
 *
 * Each test reproduces a confirmed playback-affecting bug end-to-end through
 * the editor's real mutation + rebuild + save pipeline.
 */
import { describe, expect, it } from "vitest";
import { deleteBar, insertBar } from "../editor/mutations/bar.ts";
import { rebuildScore } from "../editor/normalize.ts";
import { gp7RoundTrip, loadPlaybackTex } from "./fixtures.ts";

describe("regression: initial tempo survives bar edits at index 0", () => {
    // Bug (2026-07-06): inserting a bar before bar 0 left the initial tempo
    // automation on the OLD first bar; after save+reload score.tempo fell back
    // to the 120 default and the song started at the wrong speed.
    it("insertBar(0) keeps the song start tempo through rebuild + save round-trip", () => {
        const { score, settings } = loadPlaybackTex();
        expect(score.tempo).toBe(96);

        insertBar(score, 0);
        const rebuilt = rebuildScore(score, settings);
        const reloaded = gp7RoundTrip(rebuilt, settings);

        expect(reloaded.tempo).toBe(96);
        expect(reloaded.masterBars[0].tempoAutomations[0]?.value).toBe(96);
        // The original mid-song change moved with its bar (now index 2).
        expect(reloaded.masterBars[2].tempoAutomations[0]?.value).toBe(90);
    });

    it("deleteBar(0) keeps the song start tempo when the next bar has no tempo change", () => {
        // Simple 3-bar score at 84 BPM with no mid-song tempo changes.
        const { score, settings } = loadPlaybackTex(
            `\\tempo 84 . \\ts 4 4 3.3.4 5.3.4 7.4.4 5.2.4 | 3.3.4 5.3.4 7.4.4 5.2.4 | 3.3.4 5.3.4 7.4.4 5.2.4`,
        );
        expect(score.tempo).toBe(84);

        deleteBar(score, 0);
        const rebuilt = rebuildScore(score, settings);
        const reloaded = gp7RoundTrip(rebuilt, settings);

        expect(reloaded.tempo).toBe(84);
        expect(reloaded.masterBars[0].tempoAutomations[0]?.value).toBe(84);
    });

    it("deleteBar(0) lets an explicit tempo change on the next bar take over", () => {
        const { score, settings } = loadPlaybackTex();

        deleteBar(score, 0); // bar 1 carries its own \tempo 90 automation
        const rebuilt = rebuildScore(score, settings);
        const reloaded = gp7RoundTrip(rebuilt, settings);

        expect(reloaded.masterBars[0].tempoAutomations[0]?.value).toBe(90);
        expect(reloaded.tempo).toBe(90);
    });
});
