import { describe, expect, it } from "vitest";
import * as alphaTab from "@coderline/alphatab";
import { applyTrackStaffVisibility, staffHasStrings } from "./alphatab-shared.ts";

/** Minimal stand-in for an alphaTab Staff — the helpers only read tuning and set show flags. */
function fakeStaff(tuning: number[], show: Partial<{ showTablature: boolean; showStandardNotation: boolean }> = {}) {
    return { tuning, showTablature: show.showTablature ?? true, showStandardNotation: show.showStandardNotation ?? true } as unknown as alphaTab.model.Staff;
}

function fakeTrack(staves: alphaTab.model.Staff[]): alphaTab.model.Track {
    return { staves } as unknown as alphaTab.model.Track;
}

describe("staffHasStrings", () => {
    it("is true for a 6-string guitar staff", () => {
        expect(staffHasStrings(fakeStaff([64, 59, 55, 50, 45, 40]))).toBe(true);
    });
    it("is false for a stringless percussion staff", () => {
        expect(staffHasStrings(fakeStaff([]))).toBe(false);
    });
});

describe("applyTrackStaffVisibility", () => {
    it("shows tab-only for a guitar track in tab mode", () => {
        const staff = fakeStaff([64, 59, 55, 50, 45, 40]);
        applyTrackStaffVisibility(fakeTrack([staff]), "tab");
        expect(staff.showTablature).toBe(true);
        expect(staff.showStandardNotation).toBe(false);
    });

    it("shows standard-only for a guitar track in score mode", () => {
        const staff = fakeStaff([64, 59, 55, 50, 45, 40]);
        applyTrackStaffVisibility(fakeTrack([staff]), "score");
        expect(staff.showTablature).toBe(false);
        expect(staff.showStandardNotation).toBe(true);
    });

    it("shows both for score-tab mode", () => {
        const staff = fakeStaff([64, 59, 55, 50, 45, 40]);
        applyTrackStaffVisibility(fakeTrack([staff]), "score-tab");
        expect(staff.showTablature).toBe(true);
        expect(staff.showStandardNotation).toBe(true);
    });

    it("falls back to standard notation for a stringless (drum) staff even in tab mode", () => {
        // The drum-track crash: a tab staff can't represent 0 strings.
        const staff = fakeStaff([], { showTablature: false, showStandardNotation: false });
        applyTrackStaffVisibility(fakeTrack([staff]), "tab");
        expect(staff.showTablature).toBe(false);
        expect(staff.showStandardNotation).toBe(true);
    });

    it("never leaves a staff with nothing visible", () => {
        // A file that ships a staff with every representation hidden must still render.
        const staff = fakeStaff([64, 59, 55, 50, 45, 40], { showTablature: false, showStandardNotation: false });
        for (const mode of ["tab", "score", "score-tab"] as const) {
            applyTrackStaffVisibility(fakeTrack([staff]), mode);
            expect(staff.showTablature || staff.showStandardNotation).toBe(true);
        }
    });
});
