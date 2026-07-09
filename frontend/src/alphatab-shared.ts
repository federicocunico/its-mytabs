import * as alphaTab from "@coderline/alphatab";
import { baseURL } from "./app.js";

/**
 * Shared alphaTab setup helpers used by the player (Tab.vue) and the editor (TabEditor.vue).
 */

export function getFileURL(tabID: number | string, tempToken: string): string {
    return baseURL + `/api/tab/${tabID}/file?tempToken=${tempToken}`;
}

/**
 * AlphaTab fetches the tab file itself and cannot send cookies, so a short-lived
 * token is embedded in the file URL instead.
 */
export async function getTempToken(tabID: number | string): Promise<string> {
    const fileURL = baseURL + `/api/tab/${tabID}/temp-token`;

    const response = await fetch(fileURL, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to get get temp token");
    }
    return (await response.json()).token;
}

/**
 * The Studio always renders the notation on a white sheet (a white card inside
 * the dark score pane), so the display resources are forced to a legible
 * black-on-white palette regardless of the user's `scoreColor` setting. The old
 * dark/light full-page tint paths are retired — the sheet is white by definition.
 *
 * `_setting` is accepted for call-site compatibility but intentionally ignored.
 */
export function buildDisplayResources(_setting?: { scoreColor?: string }): Record<string, string> {
    return {
        tablatureFont: "bold 14px 'IBM Plex Mono', monospace",
        mainGlyphColor: "#191d23", // notes / stems (near-black)
        secondaryGlyphColor: "#4a5058",
        staffLineColor: "#c9ccd1",
        barSeparatorColor: "#b6bcc4",
        barNumberColor: "#9aa0a8",
        scoreInfoColor: "#22262b",
    };
}

export function getStaveProfile(setting: { scoreStyle?: string }): alphaTab.StaveProfile {
    if (setting.scoreStyle === "tab" || setting.scoreStyle === "horizontal-tab") {
        return alphaTab.StaveProfile.Tab;
    } else if (setting.scoreStyle === "score") {
        return alphaTab.StaveProfile.Score;
    } else if (setting.scoreStyle === "score-tab") {
        return alphaTab.StaveProfile.ScoreTab;
    } else {
        return alphaTab.StaveProfile.Default;
    }
}

/** The editor's three visualization modes (top-bar segmented control). */
export type ViewMode = "tab" | "score" | "score-tab";

/** A staff has no fretboard strings (percussion / drums) — a tablature staff can't represent it. */
export function staffHasStrings(staff: alphaTab.model.Staff): boolean {
    return staff.tuning.length > 0;
}

/**
 * alphaTab's synth reserves MIDI channel 16 internally for the metronome
 * click (`SynthConstants.MetronomeChannel`, not part of the public API).
 * Legacy GP3/4/5 binary files assign track channels from a flat 64-slot
 * table in file order (alphaTab's `Gp3To5Importer.readPlaybackInfos`), so a
 * track that happens to land on slot 8+ gets primary/secondary channel 16+.
 * Whenever the metronome or count-in is then enabled, alphaTab reprograms
 * channel 16 into a drum kit, silently replacing that track's real
 * instrument with drum hits for the rest of playback. Modern GP7/8 (gpif)
 * files store in-range channel numbers explicitly, so this only ever
 * surfaces on old-format imports.
 */
const RESERVED_METRONOME_CHANNEL = 16;

export function sanitizeTrackChannels(score: alphaTab.model.Score): void {
    const used = new Set<number>();
    for (const track of score.tracks) {
        if (track.playbackInfo.primaryChannel < RESERVED_METRONOME_CHANNEL) {
            used.add(track.playbackInfo.primaryChannel);
        }
        if (track.playbackInfo.secondaryChannel < RESERVED_METRONOME_CHANNEL) {
            used.add(track.playbackInfo.secondaryChannel);
        }
    }
    const nextFreeChannel = (): number => {
        for (let channel = 0; channel < RESERVED_METRONOME_CHANNEL; channel++) {
            if (channel === 9) {
                continue; // reserved for percussion
            }
            if (!used.has(channel)) {
                used.add(channel);
                return channel;
            }
        }
        return RESERVED_METRONOME_CHANNEL - 1; // channels exhausted; last resort
    };
    for (const track of score.tracks) {
        const info = track.playbackInfo;
        const isPercussion = info.primaryChannel === 9 && info.secondaryChannel === 9;
        if (isPercussion) {
            continue;
        }
        if (info.primaryChannel >= RESERVED_METRONOME_CHANNEL) {
            info.primaryChannel = nextFreeChannel();
        }
        if (info.secondaryChannel >= RESERVED_METRONOME_CHANNEL) {
            info.secondaryChannel = nextFreeChannel();
        }
    }
}

/**
 * Force per-staff visibility on the track that's about to render, driven by the
 * view mode. This is authoritative because alphaTab honours a staff's own
 * `showTablature` / `showStandardNotation` flags over the stave profile, and
 * some Guitar Pro files ship tracks with a staff that has *every* representation
 * hidden — laying such a track out crashes alphaTab with "Cannot read
 * properties of undefined (reading 'staves')".
 *
 * Rules: a tab staff needs strings; a stringless (percussion) staff always
 * falls back to standard notation; and every staff keeps at least one visible
 * representation.
 *
 * The flags are serialized on export, so callers that persist the score must
 * restore the originals first (see the editor's snapshot/restore around save).
 */
export function applyTrackStaffVisibility(track: alphaTab.model.Track, mode: ViewMode): void {
    for (const staff of track.staves) {
        const hasStrings = staffHasStrings(staff);
        let showTab = mode !== "score" && hasStrings;
        let showStd = mode !== "tab" || !hasStrings;
        if (!showTab && !showStd) {
            showStd = true;
        }
        staff.showTablature = showTab;
        staff.showStandardNotation = showStd;
    }
}
