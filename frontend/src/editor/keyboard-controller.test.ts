import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeyboardController } from "./keyboard-controller.ts";
import { matchBinding } from "./keymap.ts";

function keyEvent(init: Partial<KeyboardEvent> & { code?: string; key?: string }): KeyboardEvent {
    return {
        code: init.code ?? "",
        key: init.key ?? "",
        ctrlKey: init.ctrlKey ?? false,
        shiftKey: init.shiftKey ?? false,
        altKey: init.altKey ?? false,
        metaKey: false,
        target: init.target ?? null,
        preventDefault: init.preventDefault ?? (() => {}),
    } as unknown as KeyboardEvent;
}

describe("matchBinding", () => {
    it("matches plain keys by code", () => {
        expect(matchBinding(keyEvent({ code: "ArrowRight" }))?.command).toBe("moveRight");
        expect(matchBinding(keyEvent({ code: "KeyR" }))?.command).toBe("toggleRest");
    });

    it("distinguishes modifier combos", () => {
        expect(matchBinding(keyEvent({ code: "ArrowRight", ctrlKey: true }))?.command).toBe("nextBar");
        expect(matchBinding(keyEvent({ code: "KeyZ", ctrlKey: true }))?.command).toBe("undo");
        expect(matchBinding(keyEvent({ code: "KeyZ", ctrlKey: true, shiftKey: true }))?.command).toBe("redo");
        expect(matchBinding(keyEvent({ code: "KeyS", ctrlKey: true }))?.command).toBe("save");
    });

    it("matches punctuation by key", () => {
        expect(matchBinding(keyEvent({ code: "Period", key: "." }))?.command).toBe("toggleDot");
        expect(matchBinding(keyEvent({ code: "Equal", key: "+" }))?.command).toBe("durationLonger");
        expect(matchBinding(keyEvent({ code: "Slash", key: "?", shiftKey: true }))?.command).toBe("help");
    });

    it("returns null for unbound keys", () => {
        expect(matchBinding(keyEvent({ code: "KeyQ" }))).toBeNull();
        expect(matchBinding(keyEvent({ code: "KeyW", ctrlKey: true }))).toBeNull();
    });
});

describe("KeyboardController", () => {
    let dispatched: Array<{ command: string; arg?: number }>;
    let kb: KeyboardController;

    beforeEach(() => {
        vi.useFakeTimers();
        dispatched = [];
        kb = new KeyboardController((command, arg) => {
            dispatched.push({ command, arg });
            return true;
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("dispatches a fret immediately on the first digit", () => {
        expect(kb.handleKeydown(keyEvent({ code: "Digit5", key: "5" }))).toBe(true);
        expect(dispatched).toEqual([{ command: "setFret", arg: 5 }]);
        expect(kb.pendingFret).toBe("5");
    });

    it("combines two digits within the timeout window (1 then 2 -> 12)", () => {
        kb.handleKeydown(keyEvent({ code: "Digit1", key: "1" }));
        kb.handleKeydown(keyEvent({ code: "Digit2", key: "2" }));
        expect(dispatched).toEqual([
            { command: "setFret", arg: 1 },
            { command: "setFret", arg: 12 },
        ]);
        expect(kb.pendingFret).toBe(""); // two digits consumed the buffer
    });

    it("starts a fresh entry when the combination exceeds MAX_FRET", () => {
        kb.handleKeydown(keyEvent({ code: "Digit9", key: "9" }));
        kb.handleKeydown(keyEvent({ code: "Digit9", key: "9" }));
        expect(dispatched).toEqual([
            { command: "setFret", arg: 9 },
            { command: "setFret", arg: 9 },
        ]);
    });

    it("clears the buffer after the timeout", () => {
        kb.handleKeydown(keyEvent({ code: "Digit1", key: "1" }));
        vi.advanceTimersByTime(800);
        expect(kb.pendingFret).toBe("");
        kb.handleKeydown(keyEvent({ code: "Digit2", key: "2" }));
        expect(dispatched[1]).toEqual({ command: "setFret", arg: 2 });
    });

    it("clears the buffer on movement commands", () => {
        kb.handleKeydown(keyEvent({ code: "Digit1", key: "1" }));
        kb.handleKeydown(keyEvent({ code: "ArrowRight" }));
        expect(kb.pendingFret).toBe("");
        expect(dispatched.map((d) => d.command)).toEqual(["setFret", "moveRight"]);
    });

    it("supports numpad digits", () => {
        kb.handleKeydown(keyEvent({ code: "Numpad7", key: "7" }));
        expect(dispatched).toEqual([{ command: "setFret", arg: 7 }]);
    });

    it("ignores keystrokes while typing in an input", () => {
        const input = { tagName: "INPUT", isContentEditable: false };
        expect(kb.handleKeydown(keyEvent({ code: "Digit5", key: "5", target: input as unknown as EventTarget }))).toBe(false);
        expect(dispatched).toEqual([]);
    });

    it("only lets Escape through while a dialog is open", () => {
        kb.isBlocked = () => true;
        expect(kb.handleKeydown(keyEvent({ code: "Digit5", key: "5" }))).toBe(false);
        expect(kb.handleKeydown(keyEvent({ code: "Escape", key: "Escape" }))).toBe(true);
        expect(dispatched).toEqual([{ command: "escape" }]);
    });

    it("prevents default for handled keys only", () => {
        let prevented = 0;
        const pd = () => prevented++;
        kb.handleKeydown(keyEvent({ code: "Digit5", key: "5", preventDefault: pd }));
        kb.handleKeydown(keyEvent({ code: "KeyQ", key: "q", preventDefault: pd }));
        expect(prevented).toBe(1);
    });
});
