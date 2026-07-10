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
 * Track palette for the mixer / navigator. Used both as the auto-assigned
 * fallback (by track slot, wrapping) and as the preset swatches offered by the
 * per-track colour picker. A track's own colour (`Track.color`, persisted in the
 * .gp) overrides this — see `resolveTrackColor`.
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
    "#d4b106", // gold
    "#0ea5a5", // cyan
];

/** Stable colour for a track given its index. */
export function trackColor(index: number): string {
    return TRACK_COLORS[index % TRACK_COLORS.length];
}

/** Minimal shape of an alphaTab Color (r/g/b 0-255). */
interface RgbColor {
    r: number;
    g: number;
    b: number;
}

/** AlphaTab's default `Track.color` (200,0,0) — treated as "no explicit colour set". */
function isDefaultTrackColor(c: RgbColor): boolean {
    return c.r === 200 && c.g === 0 && c.b === 0;
}

/**
 * Display colour for a track: the track's own `Track.color` (persisted in the
 * .gp, set by the user or read from the file) when it is meaningfully set,
 * otherwise the curated palette colour for `fallbackSlot`. A user picking exactly
 * rgb(200,0,0) collides with the "unset" sentinel and falls back to the palette
 * — the red preset swatch is `#d23b34`, not pure `#c80000`, to avoid this.
 */
export function resolveTrackColor(track: { color?: RgbColor | null } | null | undefined, fallbackSlot: number): string {
    const c = track?.color;
    if (c && !isDefaultTrackColor(c)) {
        return `rgb(${c.r}, ${c.g}, ${c.b})`;
    }
    return trackColor(fallbackSlot);
}
