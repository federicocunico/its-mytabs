/**
 * Pure geometry for the editor's string caret.
 *
 * In tab view alphaTab exposes the staff-line span of a system via
 * MasterBarBounds.lineAlignedBounds (y = top string line, y + h = bottom
 * string line). The caret for a string must sit exactly on that string's
 * line — anchoring to another string's note head or interpolating over a
 * beat's stem-inclusive visualBounds draws it offset from the tab lines.
 */

export interface LineSpan {
    /** Y of the top staff line. */
    y: number;
    /** Distance from the top to the bottom staff line. */
    h: number;
}

/**
 * Y center of a string's line. `string` uses the model numbering
 * (1 = lowest pitch = bottom line, stringCount = highest = top line).
 */
export function caretYOnLines(lines: LineSpan, stringCount: number, string: number): number {
    const spacing = stringCount > 1 ? lines.h / (stringCount - 1) : 0;
    return lines.y + (stringCount - string) * spacing;
}
