<script>
import { defineComponent } from "vue";

/**
 * Bottom transport row — always visible (even when the navigator is collapsed).
 * Presentational: emits transport intents the Studio page maps to existing
 * alphaTab calls. Synth-only for now, so there is no audio-source selector and
 * metronome / count-in are always available.
 */
export default defineComponent({
    props: {
        playing: { type: Boolean, default: false },
        looping: { type: Boolean, default: false },
        metronome: { type: Boolean, default: false },
        countIn: { type: Boolean, default: false },
        speed: { type: Number, default: 100 },
        timeCur: { type: String, default: "0:00" },
        timeTotal: { type: String, default: "0:00" },
        bottomOpen: { type: Boolean, default: true },
        metronomeDisabled: { type: Boolean, default: false },
        countInDisabled: { type: Boolean, default: false },
    },
    emits: [
        "playPause",
        "toStart",
        "toEnd",
        "toggleLoop",
        "toggleMetronome",
        "toggleCountIn",
        "setSpeed",
        "toggleBottom",
    ],
});
</script>

<template>
    <div class="transport">
        <div class="t-left">
            <slot name="audioLeft" />
            <button class="t-btn t-collapse" title="Collapse / expand track panel" @click="$emit('toggleBottom')">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path :d="bottomOpen ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'" />
                </svg>
            </button>
        </div>

        <div class="t-spacer"></div>

        <div class="t-cluster">
            <span class="t-time">{{ timeCur }} <span class="t-time-sep">/ {{ timeTotal }}</span></span>

            <button class="t-btn" title="To start" @click="$emit('toStart')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h2v12H6zM20 6L9 12l11 6z" />
                </svg>
            </button>

            <button class="t-play" :class="{ playing }" title="Play / Pause (Space)" @click="$emit('playPause')">
                <svg v-if="playing" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-left: 2px">
                    <path d="M7 5v14l12-7z" />
                </svg>
            </button>

            <button class="t-btn" title="To end" @click="$emit('toEnd')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 6h2v12h-2zM4 6l11 6L4 18z" />
                </svg>
            </button>

            <button class="t-btn" :class="{ active: looping, 'accent-indigo': looping }" title="Loop" @click="$emit('toggleLoop')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 2l4 4-4 4" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <path d="M7 22l-4-4 4-4" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
            </button>

            <button
                class="t-btn"
                :class="{ active: metronome, 'accent-teal': metronome, disabled: metronomeDisabled }"
                :disabled="metronomeDisabled"
                title="Metronome"
                @click="$emit('toggleMetronome')"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 21h12L15 3H9L6 21z" />
                    <path d="M8 15h8" />
                    <path d="M12 15L16 6" />
                </svg>
            </button>

            <button
                class="t-btn"
                :class="{ active: countIn, 'accent-amber': countIn, disabled: countInDisabled }"
                :disabled="countInDisabled"
                title="Count-in"
                @click="$emit('toggleCountIn')"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4l2 2" />
                </svg>
            </button>
        </div>

        <div class="t-spacer"></div>

        <div class="t-speed">
            <span class="t-speed-label">SPEED</span>
            <input
                type="range"
                min="20"
                max="1000"
                step="5"
                :value="speed"
                @input="$emit('setSpeed', +$event.target.value)"
            />
            <span class="t-speed-val">{{ speed }}%</span>
        </div>
    </div>
</template>

<style scoped lang="scss">
@import "../../styles/vars.scss";

.transport {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 16px 8px;
    font-family: $st-font-ui;
}

.t-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
}

.t-spacer {
    flex: 1;
}

.t-btn {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    border: 1px solid $st-border-2;
    background: $st-panel-2;
    color: $st-text;
    cursor: pointer;
    transition: all 0.12s;
    flex: none;

    &:hover {
        background: #232b34;
    }
    &.active.accent-indigo {
        background: rgba(91, 110, 245, 0.13);
        border-color: $st-accent;
        color: $st-accent;
    }
    &.active.accent-teal {
        background: rgba(20, 184, 166, 0.13);
        border-color: #14b8a6;
        color: #14b8a6;
    }
    &.active.accent-amber {
        background: rgba(244, 165, 43, 0.13);
        border-color: $st-solo-amber;
        color: $st-solo-amber;
    }
    &.disabled,
    &:disabled {
        opacity: 0.4;
        cursor: default;
    }
}

.t-cluster {
    display: flex;
    align-items: center;
    gap: 8px;
}

.t-time {
    font-family: $st-font-mono;
    font-size: 12.5px;
    font-weight: 600;
    color: #e6ebf1;
    margin-right: 6px;

    .t-time-sep {
        color: $st-text-faint;
    }
}

.t-play {
    width: 52px;
    height: 44px;
    display: grid;
    place-items: center;
    border: none;
    border-radius: 11px;
    cursor: pointer;
    transition: all 0.12s;
    color: #fff;
    background: $st-play-green;
    box-shadow: 0 3px 12px rgba(31, 157, 85, 0.4);

    &.playing {
        background: $st-playhead;
        box-shadow: none;
    }
}

.t-speed {
    display: flex;
    align-items: center;
    gap: 9px;
    flex: none;
    background: $st-panel-2;
    border: 1px solid $st-border-2;
    border-radius: 9px;
    padding: 0 12px;
    height: 38px;

    .t-speed-label {
        font-size: 11px;
        color: $st-text-muted;
        font-weight: 600;
    }
    input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        width: 110px;
        height: 4px;
        border-radius: 3px;
        background: #333c47;
        outline: none;
        accent-color: $st-accent;

        &::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 13px;
            height: 13px;
            border-radius: 50%;
            background: #e8edf3;
            cursor: pointer;
        }
    }
    .t-speed-val {
        font-family: $st-font-mono;
        font-size: 12.5px;
        font-weight: 600;
        color: #e6ebf1;
        width: 40px;
        text-align: right;
    }
}
</style>
