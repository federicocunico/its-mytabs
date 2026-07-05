/**
 * Keydown dispatcher for the editor: focus guards, keymap lookup and the
 * GP-style multi-digit fret buffer (typing 1 then 2 within the timeout turns
 * fret 1 into fret 12).
 */
import { matchBinding } from "./keymap.ts";
import { MAX_FRET } from "./validation.ts";

export type CommandDispatch = (command: string, arg?: number) => void;

const FRET_BUFFER_TIMEOUT_MS = 750;

function isTypingTarget(target: EventTarget | null): boolean {
    const el = target as { tagName?: string; isContentEditable?: boolean } | null;
    if (!el || !el.tagName) {
        return false;
    }
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable === true;
}

const DIGIT_CODES: Record<string, number> = {};
for (let i = 0; i <= 9; i++) {
    DIGIT_CODES[`Digit${i}`] = i;
    DIGIT_CODES[`Numpad${i}`] = i;
}

export class KeyboardController {
    /** When true (e.g. a modal is open), only Escape is handled. */
    isBlocked: () => boolean = () => false;

    private fretBuffer = "";
    private fretTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly dispatch: CommandDispatch) {}

    /** The digits typed so far within the buffer window (status-bar display). */
    get pendingFret(): string {
        return this.fretBuffer;
    }

    clearFretBuffer(): void {
        this.fretBuffer = "";
        if (this.fretTimer !== null) {
            clearTimeout(this.fretTimer);
            this.fretTimer = null;
        }
    }

    /** Returns true when the event was handled (and default prevented). */
    handleKeydown(e: KeyboardEvent): boolean {
        if (isTypingTarget(e.target)) {
            return false;
        }

        if (this.isBlocked()) {
            if (e.code === "Escape") {
                e.preventDefault();
                this.dispatch("escape");
                return true;
            }
            return false;
        }

        // Fret entry
        const digit = DIGIT_CODES[e.code];
        if (digit !== undefined && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            this.enterDigit(digit);
            return true;
        }

        const binding = matchBinding(e);
        if (!binding) {
            return false;
        }

        e.preventDefault();
        this.clearFretBuffer();
        this.dispatch(binding.command);
        return true;
    }

    private enterDigit(digit: number): void {
        let fret: number;
        const combined = this.fretBuffer.length > 0 ? parseInt(this.fretBuffer + String(digit)) : NaN;

        if (!Number.isNaN(combined) && combined <= MAX_FRET) {
            fret = combined;
        } else {
            fret = digit;
            this.clearFretBuffer();
        }

        this.dispatch("setFret", fret);

        // A two-digit fret consumes the buffer; a first digit opens the window.
        if (this.fretBuffer.length > 0) {
            this.clearFretBuffer();
        } else {
            this.fretBuffer = String(fret);
            this.fretTimer = setTimeout(() => this.clearFretBuffer(), FRET_BUFFER_TIMEOUT_MS);
        }
    }
}
