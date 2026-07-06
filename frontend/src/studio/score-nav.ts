import type * as alphaTab from "@coderline/alphatab";

const SECTION_COLORS = ["#5b6ef5", "#14b8a6", "#f4a52b", "#a855c7", "#d23b34", "#2f8f2f"];

export type NavSection = { name: string; start: number; len: number; color: string };

/** Per-track per-bar matrix: truthy when the track has notes in that bar. */
export function buildPresenceMatrix(score: alphaTab.model.Score): boolean[][] {
    const barCount = score.masterBars.length;
    return score.tracks.map((track) => {
        const row = new Array<boolean>(barCount).fill(false);
        const staff = track.staves[0];
        if (!staff) {
            return row;
        }
        for (const bar of staff.bars) {
            if (bar.index >= barCount) {
                continue;
            }
            for (const voice of bar.voices) {
                for (const beat of voice.beats) {
                    if (beat.notes?.length) {
                        row[bar.index] = true;
                        break;
                    }
                }
                if (row[bar.index]) {
                    break;
                }
            }
        }
        return row;
    });
}

/** Section spans for the navigator lane (consecutive bars with the same section name). */
export function buildSections(masterBars: alphaTab.model.MasterBar[]): NavSection[] {
    const sections: NavSection[] = [];
    let i = 0;
    while (i < masterBars.length) {
        const text = masterBars[i].section?.text;
        if (!text) {
            i++;
            continue;
        }
        const start = i;
        while (i < masterBars.length && masterBars[i].section?.text === text) {
            i++;
        }
        sections.push({
            name: text,
            start,
            len: i - start,
            color: SECTION_COLORS[sections.length % SECTION_COLORS.length],
        });
    }
    return sections;
}

export function barIndexFromTick(score: alphaTab.model.Score, tick: number): number {
    const masterBars = score.masterBars;
    if (!masterBars.length) {
        return 0;
    }
    let bar = 0;
    for (let i = 0; i < masterBars.length; i++) {
        if ((masterBars[i].start ?? 0) <= tick) {
            bar = i;
        } else {
            break;
        }
    }
    return bar;
}

export function scoreEndTick(score: alphaTab.model.Score): number {
    const last = score.masterBars[score.masterBars.length - 1];
    if (!last) {
        return 0;
    }
    // MasterBar has no `end` — its span is start + duration.
    return (last.start ?? 0) + last.calculateDuration();
}

/** Rough ms from tick using the first master-bar tempo (alphaTab: 960 ticks per quarter). */
export function tickToMs(score: alphaTab.model.Score, tick: number): number {
    const tempo = score.masterBars[0]?.tempoAutomations[0]?.value ?? 120;
    return (tick / 960) * (60000 / tempo);
}

export function formatTimeMs(ms: number): string {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

export function loopBarSpan(
    score: alphaTab.model.Score,
    playbackRange: { startTick: number; endTick: number } | null,
): { start: number; end: number } | null {
    if (!playbackRange) {
        return null;
    }
    return {
        start: barIndexFromTick(score, playbackRange.startTick),
        end: barIndexFromTick(score, playbackRange.endTick),
    };
}
