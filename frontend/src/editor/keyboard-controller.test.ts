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

    it("supports numpad digits (NumLock on)", () => {
        kb.handleKeydown(keyEvent({ code: "Numpad7", key: "7" }));
        expect(dispatched).toEqual([{ command: "setFret", arg: 7 }]);
    });

    it("enters frets on each string of the same beat via numpad + arrow navigation", () => {
        kb.handleKeydown(keyEvent({ code: "Numpad3", key: "3" }));
        kb.handleKeydown(keyEvent({ code: "ArrowDown" }));
        kb.handleKeydown(keyEvent({ code: "Numpad5", key: "5" }));
        kb.handleKeydown(keyEvent({ code: "ArrowDown" }));
        kb.handleKeydown(keyEvent({ code: "Numpad0", key: "0" }));
        expect(dispatched.map((d) => d.command)).toEqual([
            "setFret",
            "stringDown",
            "setFret",
            "stringDown",
            "setFret",
        ]);
        expect(dispatched.map((d) => d.arg)).toEqual([3, undefined, 5, undefined, 0]);
    });

    it("routes NumLock-off numpad keys to their control meaning", () => {
        // Numpad0 with NumLock off produces key "Insert" -> insert beat, NOT fret 0
        expect(kb.handleKeydown(keyEvent({ code: "Numpad0", key: "Insert" }))).toBe(true);
        // NumpadDecimal -> Delete
        expect(kb.handleKeydown(keyEvent({ code: "NumpadDecimal", key: "Delete" }))).toBe(true);
        // Numpad4 -> ArrowLeft, Numpad8 -> ArrowUp
        expect(kb.handleKeydown(keyEvent({ code: "Numpad4", key: "ArrowLeft" }))).toBe(true);
        expect(kb.handleKeydown(keyEvent({ code: "Numpad8", key: "ArrowUp" }))).toBe(true);
        // Numpad7 -> Home, Numpad1 -> End
        expect(kb.handleKeydown(keyEvent({ code: "Numpad7", key: "Home" }))).toBe(true);
        expect(kb.handleKeydown(keyEvent({ code: "Numpad1", key: "End" }))).toBe(true);
        // Numpad9 -> PageUp, Numpad3 -> PageDown (must not enter frets)
        expect(kb.handleKeydown(keyEvent({ code: "Numpad9", key: "PageUp" }))).toBe(false);
        expect(kb.handleKeydown(keyEvent({ code: "Numpad3", key: "PageDown" }))).toBe(false);

        expect(dispatched.map((d) => d.command)).toEqual([
            "insertBeat",
            "deleteNote",
            "moveLeft",
            "stringUp",
            "barStart",
            "barEnd",
        ]);
    });

    it("numpad plus/minus/decimal work regardless of NumLock", () => {
        kb.handleKeydown(keyEvent({ code: "NumpadAdd", key: "+" }));
        kb.handleKeydown(keyEvent({ code: "NumpadSubtract", key: "-" }));
        kb.handleKeydown(keyEvent({ code: "NumpadDecimal", key: "." }));
        expect(dispatched.map((d) => d.command)).toEqual(["durationLonger", "durationShorter", "toggleDot"]);
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
