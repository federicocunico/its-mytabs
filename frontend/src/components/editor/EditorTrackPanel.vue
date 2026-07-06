<script>
import { defineComponent } from "vue";

/**
 * GP-style bottom panel: one row per track (rendering stays single-track —
 * clicking a row switches which track renders) plus a horizontally scrollable
 * bar navigator. Invalid bars are highlighted; clicking a bar number jumps
 * the cursor there.
 */
export default defineComponent({
    props: {
        /** [{ index, name, strings }] */
        tracks: {
            type: Array,
            required: true,
        },
        currentIndex: {
            type: Number,
            default: 0,
        },
        barIndex: {
            type: Number,
            default: 0,
        },
        barCount: {
            type: Number,
            default: 1,
        },
        /** Bar indices failing time-signature validation. */
        invalidBars: {
            type: Array,
            default: () => [],
        },
        disabled: {
            type: Boolean,
            default: false,
        },
    },
    emits: ["switchTrack", "openTrackManager", "goToBar"],
    computed: {
        invalidSet() {
            return new Set(this.invalidBars);
        },
    },
    watch: {
        barIndex() {
            this.$nextTick(() => {
                const el = this.$refs.barStrip?.querySelector(".bar-btn.active");
                el?.scrollIntoView({ block: "nearest", inline: "nearest" });
            });
        },
    },
});
</script>

<template>
    <div class="editor-track-panel">
        <div class="tracks">
            <button
                v-for="t in tracks"
                :key="t.index"
                type="button"
                class="btn btn-sm btn-secondary track-btn"
                :class="{ active: t.index === currentIndex }"
                :title="`Edit track: ${t.name}`"
                :disabled="disabled"
                @click="$emit('switchTrack', t.index)"
            >
                {{ t.name }} <span class="strings">{{ t.strings }}str</span>
            </button>
            <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                title="Add, remove or retune tracks"
                :disabled="disabled"
                @click="$emit('openTrackManager')"
            >
                + Track
            </button>
        </div>

        <div class="bars" ref="barStrip">
            <button
                v-for="n in barCount"
                :key="n"
                type="button"
                class="btn btn-sm btn-secondary bar-btn"
                :class="{ active: n - 1 === barIndex, 'text-danger': invalidSet.has(n - 1) }"
                :title="invalidSet.has(n - 1) ? `Bar ${n} — content doesn't match the time signature` : `Go to bar ${n}`"
                :disabled="disabled"
                @click="$emit('goToBar', n - 1)"
            >
                {{ n }}
            </button>
        </div>
    </div>
</template>

<style scoped lang="scss">
.editor-track-panel {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 15px;
    border-bottom: 1px solid #222;

    .tracks {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        max-width: 40%;
        overflow-x: auto;

        .track-btn {
            white-space: nowrap;

            .strings {
                font-size: 10px;
                opacity: 0.7;
                margin-left: 3px;
            }
        }
    }

    .bars {
        display: flex;
        align-items: center;
        gap: 3px;
        overflow-x: auto;
        flex: 1;

        .bar-btn {
            min-width: 34px;
            padding: 2px 4px;
            flex-shrink: 0;
        }
    }
}
</style>
