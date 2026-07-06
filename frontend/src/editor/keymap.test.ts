import { describe, expect, it } from "vitest";
import { keyLabelFor, KEYMAP } from "./keymap.ts";

describe("keyLabelFor", () => {
    it("returns the primary key label for a command", () => {
        expect(keyLabelFor("deleteNote")).toBe("Del"); // not the "Backspace" alias
        expect(keyLabelFor("playPause")).toBe("Space");
        expect(keyLabelFor("insertBar")).toBe("Ctrl+Ins");
        expect(keyLabelFor("toggleRest")).toBe("R");
    });

    it("returns the first binding's label when a command has several", () => {
        const commandsWithAliases = new Set<string>();
        const seen = new Set<string>();
        for (const b of KEYMAP) {
            if (seen.has(b.command)) {
                commandsWithAliases.add(b.command);
            }
            seen.add(b.command);
        }
        for (const command of commandsWithAliases) {
            const first = KEYMAP.find((b) => b.command === command)!;
            expect(keyLabelFor(command)).toBe(first.keyLabel);
        }
    });

    it("returns an empty string for an unbound command", () => {
        expect(keyLabelFor("noSuchCommand")).toBe("");
        expect(keyLabelFor("deleteBarWithConfirm")).toBe("");
    });
});
