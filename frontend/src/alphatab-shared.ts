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
