import { describe, expect, it } from "vitest";
import { caretYOnLines } from "./caret-geometry.ts";

describe("caretYOnLines", () => {
    // 6-string staff: top line at 100, bottom line at 150 (spacing 10).
    const lines = { y: 100, h: 50 };

    it("puts the highest string (model 6) on the top line", () => {
        expect(caretYOnLines(lines, 6, 6)).toBe(100);
    });

    it("puts the lowest string (model 1) on the bottom line", () => {
        expect(caretYOnLines(lines, 6, 1)).toBe(150);
    });

    it("spaces inner strings evenly", () => {
        expect(caretYOnLines(lines, 6, 5)).toBe(110);
        expect(caretYOnLines(lines, 6, 3)).toBe(130);
        expect(caretYOnLines(lines, 6, 2)).toBe(140);
    });

    it("handles 4-string basses", () => {
        const bass = { y: 0, h: 30 };
        expect(caretYOnLines(bass, 4, 4)).toBe(0);
        expect(caretYOnLines(bass, 4, 3)).toBe(10);
        expect(caretYOnLines(bass, 4, 1)).toBe(30);
    });

    it("degrades to the top line for a single-string staff", () => {
        expect(caretYOnLines({ y: 20, h: 0 }, 1, 1)).toBe(20);
    });
});
