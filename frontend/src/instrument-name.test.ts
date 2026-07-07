import { describe, expect, it } from "vitest";
import { getInstrumentName, getTrackInstrumentName, isPercussionTrack } from "./app.ts";

const track = (program: number, primaryChannel: number) => ({ playbackInfo: { program, primaryChannel } });

describe("getInstrumentName", () => {
    it("maps program 0 to Acoustic Grand Piano (not Drums)", () => {
        expect(getInstrumentName(0)).toBe("Acoustic Grand Piano");
    });
    it("returns Unknown for an out-of-range program", () => {
        expect(getInstrumentName(999)).toBe("Unknown");
    });
});

describe("isPercussionTrack", () => {
    it("is true only on the GM drum channel (index 9)", () => {
        expect(isPercussionTrack(track(0, 9))).toBe(true);
        expect(isPercussionTrack(track(0, 8))).toBe(false);
    });
});

describe("getTrackInstrumentName", () => {
    it("labels a channel-9 track as Drums regardless of its program number", () => {
        expect(getTrackInstrumentName(track(0, 9))).toBe("Drums");
        expect(getTrackInstrumentName(track(48, 9))).toBe("Drums");
    });
    it("labels a program-0 melodic track as Acoustic Grand Piano, not Drums", () => {
        // The old program===0 heuristic mislabeled real piano/vocal tracks as Drums.
        expect(getTrackInstrumentName(track(0, 8))).toBe("Acoustic Grand Piano");
    });
    it("uses the GM program name for other instruments", () => {
        expect(getTrackInstrumentName(track(66, 4))).toBe("Tenor Sax");
    });
});
