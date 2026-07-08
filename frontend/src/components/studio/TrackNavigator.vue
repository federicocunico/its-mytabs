<script>
import { defineComponent } from "vue";

/**
 * Bottom multi-track BAR navigator (Guitar-Pro global view). Not a waveform:
 * one row per track, columns = bars, colored blocks where a track plays. All
 * navigation is by bar. Presentational — clicking a cell/label emits an event
 * the Studio page maps to `api.tickPosition` / track switch.
 *
 * Props:
 *   tracks     [{ index, name, color, mute, solo, selected }]
 *   barCount   number of master bars
 *   presence   presence[trackIndex][barIndex] -> truthy when the track has notes
 *   sections   [{ name, start, len, color }]
 *   currentBar 0-based master-bar index under the playhead (cell highlight)
 *   playhead   0..1 fractional position across the whole grid (vertical line)
 *   loop       { start, end } bar span to shade, or null
 */
const LABEL_W = 168;
const CELL = 26;

export default defineComponent({
    props: {
        tracks: { type: Array, required: true },
        barCount: { type: Number, default: 0 },
        presence: { type: Array, default: () => [] },
        sections: { type: Array, default: () => [] },
        currentBar: { type: Number, default: 0 },
        playhead: { type: Number, default: 0 },
        loop: { type: Object, default: null },
    },
    emits: ["seekBar", "selectTrack", "moveTrack"],
    data() {
        return { LABEL_W, CELL, dragFrom: null, dragOverIndex: null };
    },
    computed: {
        gridW() {
            return this.barCount * CELL;
        },
        anySolo() {
            return this.tracks.some((t) => t.solo);
        },
        bars() {
            return Array.from({ length: this.barCount }, (_, i) => i);
        },
        sectionByBar() {
            const map = [];
            for (const s of this.sections) {
                for (let i = s.start; i < s.start + s.len && i < this.barCount; i++) {
                    map[i] = s;
                }
            }
            return map;
        },
        loopStyle() {
            if (!this.loop) {
                return null;
            }
            return {
                left: `${LABEL_W + this.loop.start * CELL}px`,
                width: `${(this.loop.end - this.loop.start + 1) * CELL}px`,
            };
        },
        playheadStyle() {
            return { left: `${LABEL_W + this.playhead * this.gridW}px` };
        },
    },
    methods: {
        audible(t) {
            return !t.mute && (!this.anySolo || t.solo);
        },
        sectionStartAt(bi) {
            const s = this.sectionByBar[bi];
            return s && s.start === bi ? s : null;
        },
        onDragStart(index, e) {
            this.dragFrom = index;
            e.dataTransfer.effectAllowed = "move";
            try {
                e.dataTransfer.setData("text/plain", String(index));
            } catch {
                // ignore browsers that disallow setData here
            }
        },
        onDragOver(index) {
            if (this.dragFrom !== null) {
                this.dragOverIndex = index;
            }
        },
        onDrop(index) {
            if (this.dragFrom !== null && this.dragFrom !== index) {
                this.$emit("moveTrack", { from: this.dragFrom, to: index });
            }
            this.onDragEnd();
        },
        onDragEnd() {
            this.dragFrom = null;
            this.dragOverIndex = null;
        },
    },
});
</script>

<template>
    <div class="navigator">
        <!-- loop shade -->
        <div v-if="loopStyle" class="nav-loop" :style="loopStyle"></div>

        <!-- ruler -->
        <div class="nav-ruler">
            <div class="corner corner-ruler">Tracks</div>
            <div class="lane" :style="{ width: gridW + 'px' }">
                <div v-for="bi in bars" :key="bi" class="ruler-cell" :style="{ width: CELL + 'px' }">
                    <span v-if="bi % 4 === 0" class="ruler-num">{{ bi + 1 }}</span>
                </div>
            </div>
        </div>

        <!-- section lane -->
        <div class="nav-sections">
            <div class="corner corner-sec"></div>
            <div class="lane" :style="{ width: gridW + 'px' }">
                <div
                    v-for="bi in bars"
                    :key="bi"
                    class="sec-cell"
                    :style="{ width: CELL + 'px', background: sectionByBar[bi] ? sectionByBar[bi].color + '22' : 'transparent' }"
                >
                    <span v-if="sectionStartAt(bi)" class="sec-name" :style="{ color: sectionStartAt(bi).color }">{{ sectionStartAt(bi).name }}</span>
                </div>
            </div>
        </div>

        <!-- track rows -->
        <div
            v-for="t in tracks"
            :key="t.index"
            class="nav-row"
        >
            <div
                class="row-label"
                :class="{ selected: t.selected, dragging: dragFrom === t.index, 'drag-over': dragOverIndex === t.index && dragFrom !== null && dragFrom !== t.index }"
                :style="t.selected ? { background: 'var(--st-selected)', boxShadow: 'inset 3px 0 0 ' + t.color } : {}"
                @click="$emit('selectTrack', t.index)"
                @dragover.prevent="onDragOver(t.index)"
                @drop.prevent="onDrop(t.index)"
            >
                <span
                    class="row-grip"
                    draggable="true"
                    title="Drag to reorder"
                    @click.stop
                    @dragstart="onDragStart(t.index, $event)"
                    @dragend="onDragEnd"
                >
                    <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                        <circle cx="2" cy="3" r="1.1" />
                        <circle cx="6" cy="3" r="1.1" />
                        <circle cx="2" cy="7" r="1.1" />
                        <circle cx="6" cy="7" r="1.1" />
                        <circle cx="2" cy="11" r="1.1" />
                        <circle cx="6" cy="11" r="1.1" />
                    </svg>
                </span>
                <span class="row-idx">{{ t.index + 1 }}</span>
                <span class="row-dot" :style="{ background: t.color }"></span>
                <span class="row-name" :class="{ muted: t.mute }" :style="{ fontWeight: t.selected ? 600 : 500 }">{{ t.name }}</span>
                <span v-if="t.mute" class="flag flag-m">M</span>
                <span v-if="t.solo" class="flag flag-s">S</span>
            </div>
            <div class="lane" :style="{ width: gridW + 'px' }">
                <div
                    v-for="bi in bars"
                    :key="bi"
                    class="cell"
                    :class="{ current: bi === currentBar }"
                    :style="{ width: CELL + 'px' }"
                    :title="'Go to bar ' + (bi + 1)"
                    @click="$emit('seekBar', bi)"
                >
                    <div
                        v-if="presence[t.index] && presence[t.index][bi]"
                        class="block"
                        :style="{ background: t.color, opacity: audible(t) ? 1 : 0.35 }"
                    ></div>
                </div>
            </div>
        </div>

        <!-- playhead -->
        <div class="nav-playhead" :style="playheadStyle">
            <div class="nav-playhead-cap"></div>
        </div>
    </div>
</template>

<style scoped lang="scss">
@import "../../styles/vars.scss";

.navigator {
    position: relative;
    height: 100%;
    overflow: auto;
    background: $st-nav-bg;
    font-family: $st-font-ui;
}

.lane {
    display: flex;
    flex: none;
}

// frozen columns / rows
.corner {
    width: 168px;
    flex: none;
    position: sticky;
    left: 0;
    border-right: 1px solid $st-border;
}

.nav-ruler {
    display: flex;
    position: sticky;
    top: 0;
    z-index: 3;
    height: 22px;
    background: $st-panel-bg;
    border-bottom: 1px solid $st-border;

    .corner-ruler {
        z-index: 4;
        display: flex;
        align-items: center;
        padding: 0 14px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.7px;
        text-transform: uppercase;
        color: $st-text-faint;
        background: $st-panel-bg;
    }
    .ruler-cell {
        flex: none;
        position: relative;
        border-left: 1px solid $st-border;
    }
    .ruler-num {
        position: absolute;
        left: 3px;
        top: 5px;
        font-family: $st-font-mono;
        font-size: 9.5px;
        color: $st-text-muted;
        font-weight: 600;
    }
}

.nav-sections {
    display: flex;
    height: 16px;

    .corner-sec {
        z-index: 2;
        background: $st-rail-bg;
    }
    .sec-cell {
        flex: none;
        border-left: 1px solid $st-border;
        display: flex;
        align-items: center;
        overflow: visible;
    }
    .sec-name {
        font-size: 8.5px;
        font-weight: 700;
        padding: 0 3px;
        white-space: nowrap;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }
}

.nav-row {
    display: flex;
    height: 30px;
    border-bottom: 1px solid $st-border;
}

.row-label {
    width: 168px;
    flex: none;
    position: sticky;
    left: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 14px;
    cursor: pointer;
    border-right: 1px solid $st-border;
    background: $st-rail-bg;

    &.dragging {
        opacity: 0.4;
    }
    &.drag-over {
        box-shadow: inset 0 3px 0 -1px $st-accent;
    }

    .row-grip {
        flex: none;
        display: grid;
        place-items: center;
        width: 10px;
        margin-left: -6px;
        color: $st-text-faint;
        cursor: grab;

        &:hover {
            color: $st-text;
        }
        &:active {
            cursor: grabbing;
        }
    }

    .row-idx {
        font-family: $st-font-mono;
        font-size: 10px;
        color: $st-text-muted;
        width: 12px;
        flex: none;
    }
    .row-dot {
        width: 9px;
        height: 9px;
        border-radius: 3px;
        flex: none;
    }
    .row-name {
        flex: 1;
        font-size: 12.5px;
        color: $st-text-strong;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        &.muted {
            color: $st-text-faint;
            text-decoration: line-through;
        }
    }
    .flag {
        font-size: 9px;
        font-weight: 700;
        flex: none;

        &.flag-m {
            color: $st-mute-red;
        }
        &.flag-s {
            color: $st-solo-amber;
        }
    }
}

.cell {
    flex: none;
    border-left: 1px solid $st-border;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3px;

    &.current {
        background: $st-cell-current;
    }
    .block {
        width: 100%;
        height: 100%;
        border-radius: 2px;
    }
}

.nav-loop {
    position: absolute;
    top: 22px;
    bottom: 0;
    background: $st-accent-soft;
    border-left: 2px solid $st-accent;
    border-right: 2px solid $st-accent;
    z-index: 1;
    pointer-events: none;
}

.nav-playhead {
    position: absolute;
    top: 22px;
    bottom: 0;
    width: 2px;
    background: $st-nav-playhead;
    box-shadow: 0 0 6px var(--st-accent-soft);
    z-index: 2;
    pointer-events: none;
    transition: left 0.1s linear;

    .nav-playhead-cap {
        position: absolute;
        top: 0;
        left: -4px;
        width: 10px;
        height: 6px;
        background: $st-nav-playhead;
        clip-path: polygon(0 0, 100% 0, 50% 100%);
    }
}
</style>
