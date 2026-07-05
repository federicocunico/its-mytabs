import { describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import { loadTex, voice0, walkBeatChain } from "../test-utils.ts";
import { appendBar, deleteBar, insertBar } from "./bar.ts";
import { rebuildScore } from "../normalize.ts";
import { EditorValidationError } from "../validation.ts";

const { Duration } = alphaTab.model;

const TEX = `\\ts 3 4 3.3.4 5.3.4 7.3.4 | 8.3.4 10.3.4 12.3.4`;

describe("appendBar", () => {
    it("adds a rest-only bar at the end for every staff", () => {
        let { score, settings } = loadTex(TEX);

        appendBar(score);
        score = rebuildScore(score, settings);

        expect(score.masterBars.length).toBe(3);
        const newBar = score.tracks[0].staves[0].bars[2];
        expect(newBar.isRestOnly).toBe(true);
        expect(score.masterBars[2].timeSignatureNumerator).toBe(3);
        expect(score.masterBars[2].timeSignatureDenominator).toBe(4);
        expect(walkBeatChain(score)).toEqual(["3", "5", "7", "8", "10", "12", "r"]);
    });
});

describe("insertBar", () => {
    it("inserts a rest bar before the given index and shifts content", () => {
        let { score, settings } = loadTex(TEX);

        insertBar(score, 1);
        score = rebuildScore(score, settings);

        expect(score.masterBars.length).toBe(3);
        expect(voice0(score, 1).beats[0].isRest).toBe(true);
        expect(voice0(score, 2).beats[0].notes[0].fret).toBe(8);
        expect(walkBeatChain(score)).toEqual(["3", "5", "7", "r", "8", "10", "12"]);
    });

    it("keeps repeat/tempo structure valid after rebuild (indices consistent)", () => {
        let { score, settings } = loadTex(TEX);

        insertBar(score, 0);
        score = rebuildScore(score, settings);

        expect(score.masterBars.map((mb) => mb.index)).toEqual([0, 1, 2]);
        expect(score.masterBars[1].start).toBeGreaterThan(0);
    });
});

describe("deleteBar", () => {
    it("removes the bar from masterBars and every staff", () => {
        let { score, settings } = loadTex(TEX);

        deleteBar(score, 0);
        score = rebuildScore(score, settings);

        expect(score.masterBars.length).toBe(1);
        expect(walkBeatChain(score)).toEqual(["8", "10", "12"]);
    });

    it("refuses to delete the only remaining bar", () => {
        const { score, settings } = loadTex(`\\ts 4 4 3.3.1`);
        expect(settings).toBeDefined();
        expect(() => deleteBar(score, 0)).toThrow(EditorValidationError);
    });
});

describe("multi-track", () => {
    const MULTI = `\\track "Guitar" \\ts 4 4 3.3.4 5.3.4 7.3.4 5.3.4 \\track "Bass" \\tuning E1 A1 D2 G2 1.2.4 3.2.4 5.2.4 3.2.4`;

    it("bar operations stay in sync across all tracks", () => {
        let { score, settings } = loadTex(MULTI);
        expect(score.tracks.length).toBe(2);

        appendBar(score);
        insertBar(score, 0);
        score = rebuildScore(score, settings);

        expect(score.masterBars.length).toBe(3);
        for (const track of score.tracks) {
            for (const staff of track.staves) {
                expect(staff.bars.length).toBe(3);
            }
        }
    });
});

describe("rebuildScore", () => {
    it("returns an equivalent score that exports identically", () => {
        const { score, settings } = loadTex(TEX);
        const rebuilt = rebuildScore(score, settings);
        const a = new alphaTab.exporter.Gp7Exporter().export(score, settings);
        const b = new alphaTab.exporter.Gp7Exporter().export(rebuilt, settings);
        expect(b.length).toBe(a.length);
        expect(rebuilt.tracks[0].staves[0].bars[0].voices[0].beats[0].duration).toBe(Duration.Quarter);
    });
});
