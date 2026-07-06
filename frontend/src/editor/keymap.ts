/**
 * Declarative keyboard map for the editor — the single source of truth used
 * both for dispatching (keyboard-controller.ts) and for rendering the
 * shortcuts help. Digits are NOT listed here; fret entry (with the multi-digit
 * buffer) is handled directly by the KeyboardController.
 *
 * Letters/arrows match on e.code (layout-stable), punctuation matches on e.key.
 * Browser-reserved combos (Ctrl+W/T/N/D/P/O...) are never bound.
 */

export interface KeyBinding {
    /** e.code to match (preferred for letters/digits/arrows). */
    code?: string;
    /** e.key to match (for punctuation that moves between layouts). */
    key?: string;
    ctrl?: boolean;
    shift?: boolean;
    command: string;
    /** Human-readable key label for the help dialog. */
    keyLabel: string;
    description: string;
    group: string;
}

export const KEYMAP: KeyBinding[] = [
    // ---- Transport ----
    { code: "Space", command: "playPause", keyLabel: "Space", description: "Play / pause from the cursor", group: "Playback" },
    { code: "Space", shift: true, command: "playFromBarStart", keyLabel: "Shift+Space", description: "Play from the start of the current bar", group: "Playback" },

    // ---- Navigation ----
    { code: "ArrowLeft", command: "moveLeft", keyLabel: "←", description: "Previous beat", group: "Navigation" },
    { code: "ArrowRight", command: "moveRight", keyLabel: "→", description: "Next beat (appends a bar at the end)", group: "Navigation" },
    { code: "ArrowUp", command: "stringUp", keyLabel: "↑", description: "Higher string", group: "Navigation" },
    { code: "ArrowDown", command: "stringDown", keyLabel: "↓", description: "Lower string", group: "Navigation" },
    { code: "ArrowLeft", ctrl: true, command: "prevBar", keyLabel: "Ctrl+←", description: "Previous bar", group: "Navigation" },
    { code: "ArrowRight", ctrl: true, command: "nextBar", keyLabel: "Ctrl+→", description: "Next bar", group: "Navigation" },
    { code: "Tab", command: "nextBar", keyLabel: "Tab", description: "Next bar", group: "Navigation" },
    { code: "Tab", shift: true, command: "prevBar", keyLabel: "Shift+Tab", description: "Previous bar", group: "Navigation" },
    { code: "Home", command: "barStart", keyLabel: "Home", description: "First beat of the bar", group: "Navigation" },
    { code: "End", command: "barEnd", keyLabel: "End", description: "Last beat of the bar", group: "Navigation" },
    { code: "Home", ctrl: true, command: "scoreStart", keyLabel: "Ctrl+Home", description: "Start of the score", group: "Navigation" },
    { code: "End", ctrl: true, command: "scoreEnd", keyLabel: "Ctrl+End", description: "End of the score", group: "Navigation" },

    // ---- Notes & rhythm ----
    { code: "Delete", command: "deleteNote", keyLabel: "Del", description: "Delete the note at the cursor (on a rest: delete the beat)", group: "Notes" },
    { code: "Backspace", command: "deleteNote", keyLabel: "Backspace", description: "Delete the note at the cursor (on a rest: delete the beat)", group: "Notes" },
    { code: "Delete", shift: true, command: "deleteBeat", keyLabel: "Shift+Del", description: "Delete the whole beat", group: "Notes" },
    { code: "Insert", command: "insertBeat", keyLabel: "Ins", description: "Insert a beat before the cursor", group: "Notes" },
    { code: "KeyR", command: "toggleRest", keyLabel: "R", description: "Turn the beat into a rest", group: "Notes" },
    { code: "KeyL", command: "toggleTie", keyLabel: "L", description: "Tie to the previous note", group: "Notes" },
    { key: "+", command: "durationLonger", keyLabel: "+", description: "Longer duration", group: "Rhythm" },
    { key: "=", command: "durationLonger", keyLabel: "+", description: "Longer duration", group: "Rhythm" },
    { key: "-", command: "durationShorter", keyLabel: "-", description: "Shorter duration", group: "Rhythm" },
    { key: ".", command: "toggleDot", keyLabel: ".", description: "Toggle dotted note", group: "Rhythm" },

    // ---- Bars ----
    { code: "Insert", ctrl: true, command: "insertBar", keyLabel: "Ctrl+Ins", description: "Insert a bar before the current one", group: "Bars" },
    { code: "Insert", ctrl: true, shift: true, command: "appendBar", keyLabel: "Ctrl+Shift+Ins", description: "Append a bar at the end", group: "Bars" },
    { code: "Delete", ctrl: true, command: "deleteBar", keyLabel: "Ctrl+Del", description: "Delete the current bar", group: "Bars" },

    // ---- Effects ----
    { code: "KeyH", command: "toggleHammer", keyLabel: "H", description: "Hammer-on / pull-off", group: "Effects" },
    { code: "KeyB", command: "bendDialog", keyLabel: "B", description: "Bend…", group: "Effects" },
    { code: "KeyV", command: "cycleVibrato", keyLabel: "V", description: "Vibrato (none → slight → wide)", group: "Effects" },
    { code: "KeyS", command: "toggleSlideShift", keyLabel: "S", description: "Shift slide to the next note", group: "Effects" },
    { code: "KeyS", shift: true, command: "toggleSlideLegato", keyLabel: "Shift+S", description: "Legato slide to the next note", group: "Effects" },
    { code: "KeyP", command: "togglePalmMute", keyLabel: "P", description: "Palm mute", group: "Effects" },
    { code: "KeyI", command: "toggleLetRing", keyLabel: "I", description: "Let ring", group: "Effects" },
    { code: "KeyX", command: "toggleDead", keyLabel: "X", description: "Dead note", group: "Effects" },
    { code: "KeyO", command: "toggleGhost", keyLabel: "O", description: "Ghost note", group: "Effects" },
    { code: "KeyT", command: "toggleTap", keyLabel: "T", description: "Tapping", group: "Effects" },
    { code: "KeyT", shift: true, command: "trillDialog", keyLabel: "Shift+T", description: "Trill…", group: "Effects" },
    { code: "KeyG", command: "cycleGrace", keyLabel: "G", description: "Grace note (none → before beat → on beat)", group: "Effects" },
    { code: "KeyN", command: "cycleHarmonic", keyLabel: "N", description: "Harmonics (natural → artificial → pinch → tap)", group: "Effects" },
    { code: "KeyA", command: "cycleAccent", keyLabel: "A", description: "Accent (none → normal → heavy)", group: "Effects" },
    { code: "KeyD", command: "toggleStaccato", keyLabel: "D", description: "Staccato", group: "Effects" },
    { code: "KeyY", command: "cycleTremolo", keyLabel: "Y", description: "Tremolo picking (off → 8th → 16th → 32nd)", group: "Effects" },

    // ---- Clipboard ----
    { code: "KeyC", ctrl: true, command: "copyBeat", keyLabel: "Ctrl+C", description: "Copy beat", group: "Edit" },
    { code: "KeyX", ctrl: true, command: "cutBeat", keyLabel: "Ctrl+X", description: "Cut beat", group: "Edit" },
    { code: "KeyV", ctrl: true, command: "pasteBeat", keyLabel: "Ctrl+V", description: "Paste beat", group: "Edit" },

    // ---- Edit / file ----
    { code: "KeyZ", ctrl: true, command: "undo", keyLabel: "Ctrl+Z", description: "Undo", group: "Edit" },
    { code: "KeyY", ctrl: true, command: "redo", keyLabel: "Ctrl+Y", description: "Redo", group: "Edit" },
    { code: "KeyZ", ctrl: true, shift: true, command: "redo", keyLabel: "Ctrl+Shift+Z", description: "Redo", group: "Edit" },
    { code: "KeyS", ctrl: true, command: "save", keyLabel: "Ctrl+S", description: "Save to server", group: "Edit" },
    { code: "KeyS", ctrl: true, shift: true, command: "download", keyLabel: "Ctrl+Shift+S", description: "Download as .gp file", group: "Edit" },
    { code: "Escape", command: "escape", keyLabel: "Esc", description: "Cancel input / stop playback", group: "Edit" },
    { code: "Slash", shift: true, command: "help", keyLabel: "?", description: "Show keyboard shortcuts", group: "Edit" },
];

/**
 * Primary shortcut label for a command (first binding wins — later bindings
 * for the same command are aliases). Empty string when the command has no
 * keyboard binding. Used for sidebar/tooltip shortcut hints.
 */
export function keyLabelFor(command: string): string {
    return KEYMAP.find((b) => b.command === command)?.keyLabel ?? "";
}

export function matchBinding(e: Pick<KeyboardEvent, "code" | "key" | "ctrlKey" | "shiftKey" | "altKey">): KeyBinding | null {
    for (const binding of KEYMAP) {
        if (binding.code !== undefined && binding.code !== e.code) {
            continue;
        }
        if (binding.key !== undefined && binding.key !== e.key) {
            continue;
        }
        if (binding.code === undefined && binding.key === undefined) {
            continue;
        }
        if ((binding.ctrl ?? false) !== e.ctrlKey) {
            continue;
        }
        // key-based bindings ("+", "?") already encode Shift in the produced
        // character; only code-based bindings check the modifier explicitly.
        if (binding.code !== undefined && (binding.shift ?? false) !== e.shiftKey) {
            continue;
        }
        if (e.altKey) {
            continue;
        }
        return binding;
    }
    return null;
}
