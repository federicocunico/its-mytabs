import { ref } from "vue";

/**
 * App-wide light/dark theme. Every page — the editor/studio included — follows
 * the stored preference, defaulting to the OS scheme. index.html applies the
 * same logic pre-paint to avoid a flash.
 */
export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

function readStored(): ThemePreference {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v === "light" || v === "dark" ? v : "system";
    } catch {
        return "system";
    }
}

/** Reactive preference for UI controls (sidebar toggle, settings page). */
export const themePreference = ref<ThemePreference>(readStored());

function systemDark(): boolean {
    return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

function apply(dark: boolean): void {
    document.documentElement.classList.toggle("dark", dark);
}

export function effectiveDark(): boolean {
    return themePreference.value === "dark" || (themePreference.value === "system" && systemDark());
}

/** Apply the stored preference. */
export function applyTheme(): void {
    apply(effectiveDark());
}

export function setTheme(pref: ThemePreference): void {
    themePreference.value = pref;
    try {
        if (pref === "system") localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, pref);
    } catch {
        // Ignore storage failures (private mode etc.); theme still applies.
    }
    apply(effectiveDark());
}

globalThis.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (themePreference.value === "system") apply(systemDark());
});
