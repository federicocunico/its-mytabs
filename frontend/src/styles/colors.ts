/**
 * Shared colour system for MyTabs.
 *
 * `STRING_COLORS` is the guitar-string → colour map used by the on-sheet fret
 * colouring in `Tab.vue::applyColors()` (kept here so the UI and the score share
 * one source of truth). Index is the 1-based *visual* string number (1 = highest
 * string, top line of the tab).
 *
 * `STRING_COLORS_LIGHT` are the slightly darkened variants that stay legible on
 * the white score sheet (the sheet is white by definition in the Studio shell).
 *
 * `TRACK_COLORS` is a deliberately *different* palette used to colour-code tracks
 * in the mixer and the bottom bar-navigator, so track coding never collides with
 * string coding.
 */

export const STRING_COLORS: Record<number, string> = {
    1: "#bf3732",
    2: "#fff800",
    3: "#0080ff",
    4: "#e07b39",
    5: "#2A8E08",
    6: "#A349A4",
};

/** Darkened for legibility on a white sheet (yellow/blue are the problem cases). */
export const STRING_COLORS_LIGHT: Record<number, string> = {
    ...STRING_COLORS,
    2: "#c98a00",
    3: "#1173d4",
};

/**
 * Track palette for the mixer / navigator. Auto-assigned by track index
 * (wrapping) until per-track editable colours land (see INTEGRATION_PLAN §8b).
 */
export const TRACK_COLORS: string[] = [
    "#5b6ef5", // indigo  (Lead)
    "#14b8a6", // teal    (Rhythm)
    "#f4a52b", // amber   (Bass)
    "#a855c9", // purple  (Drums)
    "#d23b34", // red
    "#2f8f2f", // green
    "#1173d4", // blue
    "#e0629b", // pink
    "#e07b39", // orange
    "#8b95a1", // grey
];

/** Stable colour for a track given its index. */
export function trackColor(index: number): string {
    return TRACK_COLORS[index % TRACK_COLORS.length];
}
