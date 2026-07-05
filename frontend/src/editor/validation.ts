/**
 * Musical correctness rules enforced before mutations run.
 * Hard violations throw EditorValidationError and the transaction is rejected.
 */
import * as alphaTab from "@coderline/alphatab";

type Beat = alphaTab.model.Beat;
type Note = alphaTab.model.Note;
type Staff = alphaTab.model.Staff;

export const MAX_FRET = 30;

export class EditorValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EditorValidationError";
    }
}

export function assertFret(fret: number): void {
    if (!Number.isInteger(fret) || fret < 0 || fret > MAX_FRET) {
        throw new EditorValidationError(`Invalid fret ${fret} (expected an integer 0..${MAX_FRET})`);
    }
}

export function assertString(staff: Staff, string: number): void {
    const stringCount = staff.tuning.length;
    if (!Number.isInteger(string) || string < 1 || string > stringCount) {
        throw new EditorValidationError(`Invalid string ${string} (staff has ${stringCount} strings)`);
    }
}

/**
 * Find the note a tie on `string` would connect back to: the nearest previous
 * beat (walking the song-wide beat chain, across bars) with a note on that string.
 */
export function findTieOriginNote(beat: Beat, string: number): Note | null {
    let current: Beat | null = beat.previousBeat;
    while (current) {
        const note = current.getNoteOnString(string);
        if (note) {
            return note;
        }
        current = current.previousBeat;
    }
    return null;
}
