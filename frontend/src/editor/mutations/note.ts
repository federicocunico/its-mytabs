/**
 * Note-level mutations. Pure model operations — callers are responsible for
 * running normalizeScore() afterwards (the EditorController does this).
 */
import * as alphaTab from "@coderline/alphatab";
import { assertFret, assertString, EditorValidationError, findTieOriginNote } from "../validation.ts";

type Beat = alphaTab.model.Beat;
type Note = alphaTab.model.Note;

/** Create or update the note on `string` and give it `fret`. */
export function setNoteFret(beat: Beat, string: number, fret: number): Note {
    assertString(beat.voice.bar.staff, string);
    assertFret(fret);

    let note = beat.getNoteOnString(string);
    if (note) {
        note.fret = fret;
        note.isTieDestination = false;
    } else {
        note = new alphaTab.model.Note();
        note.string = string;
        note.fret = fret;
        beat.addNote(note);
    }
    beat.isEmpty = false;
    return note;
}

/** Remove the note on `string`. Returns false when the string was already free. */
export function removeNoteOnString(beat: Beat, string: number): boolean {
    const note = beat.getNoteOnString(string);
    if (!note) {
        return false;
    }
    beat.removeNote(note);
    return true;
}

/**
 * Tie the note on `string` to the previous note on the same string.
 * The destination note is created if missing; its fret always copies the origin
 * (a tie continues the same pitch).
 */
export function toggleTie(beat: Beat, string: number, on: boolean): void {
    assertString(beat.voice.bar.staff, string);

    if (!on) {
        const note = beat.getNoteOnString(string);
        if (note) {
            note.isTieDestination = false;
        }
        return;
    }

    const origin = findTieOriginNote(beat, string);
    if (!origin) {
        throw new EditorValidationError(`No previous note on string ${string} to tie to`);
    }

    let note = beat.getNoteOnString(string);
    if (!note) {
        note = new alphaTab.model.Note();
        note.string = string;
        beat.addNote(note);
    }
    note.fret = origin.fret;
    note.isTieDestination = true;
    beat.isEmpty = false;
}
