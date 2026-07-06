<script>
import { defineComponent } from "vue";

/**
 * Right-rail mixer — a persistent, docked version of the player's old
 * track-list dropdown. Purely presentational: every control emits an event the
 * Studio page maps to an existing alphaTab call (masterVolume, changeTrackMute,
 * changeTrackVolume, changeTrack/switchTrack). No playback logic lives here.
 *
 * Each track: { index, name, instrument, color, solo, mute, volume, selected }
 */
export default defineComponent({
    props: {
        tracks: { type: Array, required: true },
        master: { type: Number, default: 100 },
        playing: { type: Boolean, default: false },
    },
    emits: ["selectTrack", "toggleSolo", "toggleMute", "setVolume", "setMaster", "addTrack"],
    computed: {
        anySolo() {
            return this.tracks.some((t) => t.solo);
        },
    },
    methods: {
        audible(t) {
            return !t.mute && (!this.anySolo || t.solo);
        },
        rowStyle(t) {
            return t.selected
                ? { background: "#1c222b", border: `1px solid ${t.color}66`, boxShadow: `inset 3px 0 0 ${t.color}` }
                : {};
        },
    },
});
</script>

<template>
    <div class="mixer">
        <div class="mixer-head">
            <span class="mixer-title">Mixer</span>
            <span class="mixer-count">{{ tracks.length }} tracks</span>
        </div>

        <div class="master">
            <div class="master-row">
                <span class="master-label">Master</span>
                <span class="master-val">{{ master }}</span>
            </div>
            <input
                type="range"
                min="0"
                max="100"
                :value="master"
                class="slider slider-master"
                @input="$emit('setMaster', +$event.target.value)"
            />
        </div>

        <div class="tracks">
            <div
                v-for="t in tracks"
                :key="t.index"
                class="track"
                :class="{ selected: t.selected }"
                :style="rowStyle(t)"
                @click="$emit('selectTrack', t.index)"
            >
                <div class="track-top">
                    <span class="track-bar" :style="{ background: t.color }"></span>
                    <span class="track-icon" :style="{ background: t.color + '22', borderColor: t.color + '66' }">
                        <svg width="15" height="15" viewBox="0 0 24 24" :fill="t.color"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                    </span>
                    <div class="track-meta">
                        <div class="track-name" :title="t.name">{{ t.name }}</div>
                        <div class="track-inst">{{ t.instrument }}</div>
                    </div>
                    <div class="vu" :class="{ on: playing && audible(t) }">
                        <span :style="{ background: audible(t) ? t.color : '#3a434e', animationDuration: '0.42s' }"></span>
                        <span :style="{ background: audible(t) ? t.color : '#3a434e', animationDuration: '0.33s', animationDelay: '0.08s' }"></span>
                        <span :style="{ background: audible(t) ? t.color : '#3a434e', animationDuration: '0.5s', animationDelay: '0.04s' }"></span>
                    </div>
                </div>
                <div class="track-ctl">
                    <button
                        class="sm-btn solo"
                        :class="{ active: t.solo }"
                        title="Solo"
                        @click.stop="$emit('toggleSolo', t.index)"
                    >S</button>
                    <button
                        class="sm-btn mute"
                        :class="{ active: t.mute }"
                        title="Mute"
                        @click.stop="$emit('toggleMute', t.index)"
                    >M</button>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        :value="t.volume"
                        class="slider"
                        :style="{ accentColor: t.color }"
                        @click.stop
                        @input="$emit('setVolume', { index: t.index, value: +$event.target.value })"
                    />
                    <span class="vol-val">{{ t.volume }}</span>
                </div>
            </div>

            <button class="add-track" title="Manage tracks" @click="$emit('addTrack')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Add track
            </button>
        </div>
    </div>
</template>

<style scoped lang="scss">
@import "../../styles/vars.scss";

.mixer {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-family: $st-font-ui;
    padding-top: 4px;
}

.mixer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 46px 10px 15px;

    .mixer-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        color: $st-text-faint;
    }
    .mixer-count {
        font-family: $st-font-mono;
        font-size: 11px;
        color: #6f7a86;
    }
}

.master {
    margin: 0 12px 6px;
    padding: 10px 12px;
    background: #171c22;
    border: 1px solid $st-border;
    border-radius: 10px;

    .master-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
    }
    .master-label {
        font-size: 12px;
        font-weight: 600;
        color: #cfd6de;
    }
    .master-val {
        font-family: $st-font-mono;
        font-size: 11px;
        color: #8b95a1;
    }
}

.tracks {
    flex: 1;
    padding: 6px 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
}

.track {
    padding: 11px 12px;
    border-radius: 11px;
    background: #171c22;
    border: 1px solid $st-border;
    cursor: pointer;
    transition: background 0.12s;

    &:hover:not(.selected) {
        background: #1a2028;
    }
}

.track-top {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 9px;
}

.track-bar {
    width: 4px;
    height: 30px;
    border-radius: 3px;
    flex: none;
}

.track-icon {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    flex: none;
    display: grid;
    place-items: center;
    border: 1px solid;
}

.track-meta {
    flex: 1;
    min-width: 0;
    line-height: 1.2;

    .track-name {
        font-size: 13px;
        font-weight: 600;
        color: #e6ebf1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .track-inst {
        font-size: 11px;
        color: #717c88;
    }
}

.vu {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 20px;
    flex: none;

    span {
        display: block;
        width: 3px;
        height: 16px;
        border-radius: 1px;
        transform-origin: bottom;
        transform: scaleY(0.28);
    }
    &.on span {
        animation-name: vu;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
        animation-direction: alternate;
    }
}

.track-ctl {
    display: flex;
    align-items: center;
    gap: 9px;
}

.sm-btn {
    width: 26px;
    height: 24px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    background: #20262e;
    border: 1px solid #2f3843;
    color: #8b95a1;

    &.solo.active {
        background: $st-solo-amber;
        border-color: $st-solo-amber;
        color: #1a1d21;
    }
    &.mute.active {
        background: $st-mute-red;
        border-color: $st-mute-red;
        color: #fff;
    }
}

.slider {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    border-radius: 3px;
    background: #333c47;
    outline: none;
    flex: 1;

    &::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: #e8edf3;
        cursor: pointer;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
    }
}
.slider-master {
    width: 100%;
    accent-color: #e8edf3;
}

.vol-val {
    font-family: $st-font-mono;
    font-size: 10.5px;
    color: #8b95a1;
    width: 24px;
    text-align: right;
}

.add-track {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 10px;
    border: 1px dashed #303842;
    border-radius: 10px;
    background: transparent;
    color: $st-text-muted;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 2px;

    &:hover {
        background: #171c22;
        color: #a9b3bd;
    }
}

@keyframes vu {
    0% {
        transform: scaleY(0.28);
    }
    100% {
        transform: scaleY(1);
    }
}
</style>
