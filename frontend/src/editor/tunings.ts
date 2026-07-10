/**
 * Shared tuning presets for the track dialogs (Track Manager add/re-tune, and the
 * per-track Edit dialog). Each preset carries a full MIDI-note tuning (highest
 * string first, matching staff.tuning) and the MIDI program to seed new tracks.
 */
export interface TuningPreset {
    id: string;
    label: string;
    tuning: number[];
    program: number;
}

export const TUNING_PRESETS: TuningPreset[] = [
    { id: "guitar-standard", label: "Guitar — Standard (EADGBE)", tuning: [64, 59, 55, 50, 45, 40], program: 25 },
    { id: "guitar-drop-d", label: "Guitar — Drop D", tuning: [64, 59, 55, 50, 45, 38], program: 25 },
    { id: "guitar-7", label: "Guitar — 7-string", tuning: [64, 59, 55, 50, 45, 40, 35], program: 25 },
    { id: "bass-4", label: "Bass — 4-string (EADG)", tuning: [43, 38, 33, 28], program: 33 },
    { id: "bass-5", label: "Bass — 5-string (BEADG)", tuning: [43, 38, 33, 28, 23], program: 33 },
];

/** The instrument name at the head of a preset label ("Guitar — Standard…" -> "Guitar"). */
export function instrumentOf(preset: TuningPreset): string {
    return preset.label.split("—")[0].trim();
}

/** The preset id whose tuning exactly matches `tuning`, or null if none (custom tuning). */
export function matchPresetId(tuning: number[]): string | null {
    const preset = TUNING_PRESETS.find((p) => p.tuning.length === tuning.length && p.tuning.every((n, i) => n === tuning[i]));
    return preset?.id ?? null;
}
