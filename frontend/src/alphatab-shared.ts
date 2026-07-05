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

export function buildDisplayResources(setting: { scoreColor?: string }): Record<string, string> {
    let displayResources: Record<string, string> = {
        tablatureFont: "bold 14px Arial",
        barNumberColor: "#6D6D6D",
    };

    if (setting.scoreColor === "dark") {
        displayResources = {
            ...displayResources,
            staffLineColor: "#6D6D6D",
            barSeparatorColor: "#6D6D6D",
            mainGlyphColor: "#A4A4A4",
            secondaryGlyphColor: "#A4A4A4",
            scoreInfoColor: "#A3A3A3",
            barNumberColor: "#6D6D6D",
        };
    }

    return displayResources;
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
