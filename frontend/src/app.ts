import { midiProgramCodeList } from "../../backend/common.ts";
import { notify } from "@kyvg/vue3-notification";
import { SettingSchema } from "./zod.ts";

/**
 * Get the base URL
 * Mainly used for dev, because the backend and the frontend are in different ports.
 * The backend port is configurable via VITE_BACKEND_PORT (frontend/.env.development,
 * overridable per machine in the gitignored frontend/.env.development.local) so a
 * dev backend can run on an alternative port when 47777 is taken (e.g. by a
 * production Docker container).
 * @returns Base URL
 */
export function getBaseURL(): string {
    if (import.meta.env.DEV) {
        const port = import.meta.env.VITE_BACKEND_PORT || "47777";
        return `${location.protocol}//${location.hostname}:${port}`;
    }
    return "";
}

export const baseURL = getBaseURL();

export function getInstrumentName(midiProgram: number) {
    return midiProgramCodeList[midiProgram] || "Unknown";
}

/** Minimal shape of an alphaTab track needed to identify its instrument. */
type InstrumentTrack = { playbackInfo?: { program?: number; primaryChannel?: number } };

/** MIDI channel 10 (zero-based index 9) is the General MIDI percussion channel. */
export function isPercussionTrack(track: InstrumentTrack): boolean {
    return track?.playbackInfo?.primaryChannel === 9;
}

/**
 * Display instrument for a track: percussion tracks read as "Drums" (they carry
 * a program number that would otherwise map to a melodic instrument), everything
 * else uses its General MIDI program name.
 */
export function getTrackInstrumentName(track: InstrumentTrack): string {
    if (isPercussionTrack(track)) {
        return "Drums";
    }
    return getInstrumentName(track?.playbackInfo?.program ?? -1);
}

export async function checkFetch(res: Response): Promise<void> {
    let data;

    try {
        if (!res.ok) {
            data = await res.json();
        }
    } catch (e) {
        throw new Error("Failed to fetch without message: " + res.status);
    }

    if (data) {
        if (data.msg) {
            throw new Error(data.msg);
        } else {
            throw new Error(JSON.stringify(data));
        }
    }

    // if response is not in json type
    if (res.headers.get("content-type") !== "application/json") {
        throw new Error("Response is not in JSON format");
    }
}

export function successMessage(msg: string): void {
    notify({
        text: msg,
        type: "success",
    });
}

export function generalError(e: unknown): void {
    if (!(e instanceof Error)) {
        notify({
            text: "Unknown error",
            type: "error",
        });
        console.error("Unknown error", e);
    } else {
        notify({
            text: e.message,
            type: "error",
        });
    }
}

/**
 * @param alphaTexString
 */
export function convertAlphaTexSyncPoint(alphaTexString: string) {
    // To array each line
    const lines = alphaTexString.split("\n");

    const syncPoints = [];

    for (const line of lines) {
        if (line.trim().startsWith("\\sync")) {
            const parts = line.split(" ");

            const barIndex = parseInt(parts[1]);
            const barOccurence = parseInt(parts[2]);
            const millisecondOffset = parseInt(parts[3]);
            let barPosition = 0;
            if (parts[4]) {
                barPosition = parseInt(parts[4]);
            }

            syncPoints.push({
                barIndex,
                barOccurence,
                millisecondOffset,
                barPosition,
            });
        }
    }

    return syncPoints;
}

export function getSetting() {
    const savedSetting = localStorage.getItem("userSetting");
    try {
        const setting = JSON.parse(savedSetting);
        return SettingSchema.parse(setting);
    } catch (e) {
        return SettingSchema.parse({});
    }
}

export class ActionBuffer {
    delay: number = 2000;
    timer: ReturnType<typeof setTimeout> | null = null;
    action: (() => void) | null = null;

    constructor(delay: number) {
        this.delay = delay;
        this.timer = null;
    }

    run(action: () => void) {
        if (this.timer) {
            //If cold down not finished, place it in buffer
            this.action = action;
            console.log("Action buffered, still in cold down");
        } else {
            // If no timer, run immediately
            action();
            console.log("Action run, start cold down");
            this.timer = setTimeout(() => {
                // Cold down finished, run the buffered action if exists
                if (this.action !== null) {
                    this.action();
                    console.log("Buffered action run after cold down");
                }
                this.timer = null;
                this.action = null;
            }, this.delay);
        }
    }
}

let wakeLock: WakeLockSentinel = null;

// Suggested by https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
document.addEventListener("visibilitychange", async () => {
    if (wakeLock !== null && document.visibilityState === "visible") {
        // Request a wake lock again when the page becomes visible
        await requestWakeLock();
    }
});

export async function requestWakeLock() {
    try {
        if ("wakeLock" in navigator) {
            wakeLock = await navigator.wakeLock.request("screen");
            console.log("Wake lock is active");
            wakeLock.addEventListener("release", () => {
                console.log("Wake lock released");
            });
        } else {
            console.log("Wake Lock API not supported.");
        }
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

export async function releaseWakeLock() {
    try {
        if (wakeLock != null) {
            await wakeLock.release();
            wakeLock = null;
        }
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}
