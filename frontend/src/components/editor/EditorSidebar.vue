<script>
import { defineComponent } from "vue";
import { keyLabelFor } from "../../editor/keymap.ts";
import DurationPicker from "./DurationPicker.vue";

/**
 * GP-style left tool palette. Emits the same command ids as the keyboard
 * shortcuts — zero new plumbing; TabEditor.dispatch() handles everything.
 * `ui` drives rhythm/beat state, `fx` the effect toggle states.
 *
 * Restyled for the Studio shell: colour-accented groups (each header gets a
 * coloured dot), chip buttons, keyboard-shortcut hint chips retained.
 */
export default defineComponent({
    components: { DurationPicker },
    props: {
        ui: { type: Object, required: true },
        fx: { type: Object, required: true },
        disabled: { type: Boolean, default: false },
    },
    emits: ["command"],
    data() {
        return {
            groups: [
                {
                    name: "Note Effects",
                    accent: "#5b6ef5",
                    items: [
                        { command: "toggleHammer", label: "H", description: "Hammer-on / pull-off", active: "hammer" },
                        { command: "togglePalmMute", label: "PM", description: "Palm mute", active: "palmMute" },
                        { command: "toggleLetRing", label: "LR", description: "Let ring", active: "letRing" },
                        { command: "toggleDead", label: "X", description: "Dead note", active: "dead" },
                        { command: "toggleGhost", label: "( )", description: "Ghost note", active: "ghost" },
                        { command: "toggleStaccato", label: "Stac.", description: "Staccato", active: "staccato" },
                        { command: "bendDialog", label: "Bend", description: "Bend…", active: "bend" },
                        { command: "toggleSlideShift", label: "Sl.", description: "Shift slide", active: "slideShift" },
                        { command: "toggleSlideLegato", label: "Sl.leg", description: "Legato slide", active: "slideLegato" },
                        { command: "cycleVibrato", label: "Vib", description: "Vibrato", active: "vibrato" },
                        { command: "cycleHarmonic", label: "Harm", description: "Harmonics", active: "harmonic" },
                        { command: "cycleAccent", label: ">", description: "Accent", active: "accent" },
                        { command: "trillDialog", label: "Trill", description: "Trill…", active: "trill" },
                    ],
                },
                {
                    name: "Beat Effects",
                    accent: "#f4a52b",
                    items: [
                        { command: "toggleTap", label: "Tap", description: "Tapping", active: "tap" },
                        { command: "cycleTremolo", label: "Trem", description: "Tremolo picking", active: "tremolo" },
                        { command: "cycleGrace", label: "Grace", description: "Grace note", active: "grace" },
                    ],
                },
                {
                    name: "Beat",
                    accent: "#14b8a6",
                    items: [
                        { command: "toggleRest", label: "Rest", description: "Turn the beat into a rest", uiActive: "isRest" },
                        { command: "toggleTie", label: "Tie", description: "Tie to the previous note", uiActive: "tie" },
                        { command: "insertBeat", label: "+Beat", description: "Insert a beat before the cursor" },
                        { command: "deleteBeat", label: "−Beat", description: "Delete the whole beat" },
                    ],
                },
                {
                    name: "Bar",
                    accent: "#a855c9",
                    items: [
                        { command: "insertBar", label: "+Bar", description: "Insert a bar before the current one" },
                        { command: "appendBar", label: "Append", description: "Append a bar at the end" },
                        { command: "deleteBar", label: "−Bar", description: "Delete the current bar" },
                        { command: "barSettings", label: "Bar…", description: "Bar settings: time signature, tempo, key, repeats, section" },
                    ],
                },
            ],
        };
    },
    methods: {
        command(name, arg) {
            this.$emit("command", name, arg);
        },
        keyLabel(command) {
            return keyLabelFor(command);
        },
        titleFor(item) {
            const key = keyLabelFor(item.command);
            return key ? `${item.description} (${key})` : item.description;
        },
        isActive(item) {
            if (item.uiActive) {
                return !!this.ui[item.uiActive];
            }
            if (item.active) {
                return !!this.fx[item.active];
            }
            return false;
        },
        chipStyle(item, accent) {
            return this.isActive(item)
                ? { background: accent, borderColor: accent, color: "#fff", boxShadow: `0 2px 8px ${accent}55` }
                : {};
        },
    },
});
</script>

<template>
    <div class="editor-sidebar">
        <div class="group">
            <div class="group-head">Duration</div>
            <DurationPicker :duration="ui.duration" :dots="ui.dots" :disabled="disabled" @command="command" />
        </div>

        <div class="group" v-for="group in groups" :key="group.name">
            <div class="group-head">
                <span class="dot" :style="{ background: group.accent }"></span>
                {{ group.name }}
            </div>
            <div class="chips">
                <button
                    v-for="item in group.items"
                    :key="item.command"
                    type="button"
                    class="chip"
                    :class="{ active: isActive(item) }"
                    :style="chipStyle(item, group.accent)"
                    :title="titleFor(item)"
                    :disabled="disabled"
                    @click="command(item.command)"
                >
                    {{ item.label }}
                    <span class="kbd" v-if="keyLabel(item.command)">{{ keyLabel(item.command) }}</span>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
@import "../../styles/vars.scss";

.editor-sidebar {
    padding: 12px 12px 40px;
    font-family: $st-font-ui;

    .group {
        margin-bottom: 14px;

        &:not(:first-child) {
            border-top: 1px solid #20272f;
            padding-top: 12px;
        }
    }

    .group-head {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        color: $st-text-faint;
        margin-bottom: 9px;

        .dot {
            width: 8px;
            height: 8px;
            border-radius: 2px;
            flex: none;
        }
    }

    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
    }

    .chip {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        min-width: 32px;
        height: 30px;
        padding: 0 8px;
        font-family: $st-font-ui;
        font-size: 12px;
        font-weight: 600;
        border-radius: 7px;
        border: 1px solid $st-border-2;
        background: $st-panel-2;
        color: #b3bcc6;
        cursor: pointer;
        transition: all 0.12s;

        &:hover:not(:disabled):not(.active) {
            background: #232b34;
        }
        &:disabled {
            opacity: 0.45;
            cursor: default;
        }
    }

    .kbd {
        font-size: 10px;
        color: #93a8ba;
        border: 1px solid #3a4652;
        border-radius: 3px;
        padding: 0 3px;
    }

    .chip.active .kbd {
        color: rgba(255, 255, 255, 0.85);
        border-color: rgba(255, 255, 255, 0.4);
    }

    // Duration picker → chips inside the narrow rail
    :deep(.duration-picker) {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;

        .btn {
            min-width: 32px;
            height: 30px;
            border-radius: 7px !important;
            border: 1px solid $st-border-2;
            background: $st-panel-2;
            color: #b3bcc6;
            font-size: 12px;
            font-weight: 600;

            &.active {
                background: #3d4657;
                border-color: #3d4657;
                color: #fff;
            }
        }
    }
}
</style>
