<script>
import { defineComponent } from "vue";
import { keyLabelFor } from "../../editor/keymap.ts";
import DurationPicker from "./DurationPicker.vue";

/**
 * GP-style left tool palette. Emits the same command ids as the keyboard
 * shortcuts — zero new plumbing; TabEditor.dispatch() handles everything.
 * `ui` drives rhythm/beat state, `fx` the effect toggle states.
 */
export default defineComponent({
    components: { DurationPicker },
    props: {
        ui: {
            type: Object,
            required: true,
        },
        fx: {
            type: Object,
            required: true,
        },
        disabled: {
            type: Boolean,
            default: false,
        },
    },
    emits: ["command"],
    data() {
        return {
            beatOps: [
                { command: "toggleRest", label: "Rest", description: "Turn the beat into a rest", uiActive: "isRest" },
                { command: "toggleTie", label: "Tie", description: "Tie to the previous note", uiActive: "tie" },
                { command: "insertBeat", label: "+Beat", description: "Insert a beat before the cursor" },
                { command: "deleteBeat", label: "−Beat", description: "Delete the whole beat" },
            ],
            noteEffects: [
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
            beatEffects: [
                { command: "toggleTap", label: "Tap", description: "Tapping", active: "tap" },
                { command: "cycleTremolo", label: "Trem", description: "Tremolo picking", active: "tremolo" },
                { command: "cycleGrace", label: "Grace", description: "Grace note", active: "grace" },
            ],
            barOps: [
                { command: "insertBar", label: "+Bar", description: "Insert a bar before the current one" },
                { command: "appendBar", label: "Append", description: "Append a bar at the end" },
                { command: "deleteBar", label: "−Bar", description: "Delete the current bar" },
                { command: "barSettings", label: "Bar…", description: "Bar settings: time signature, tempo, key, repeats, section" },
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
    },
});
</script>

<template>
    <div class="editor-sidebar">
        <div class="group">
            <h6>Duration</h6>
            <DurationPicker :duration="ui.duration" :dots="ui.dots" :disabled="disabled" @command="command" />
        </div>

        <div class="group" v-for="group in [
            { name: 'Beat', items: beatOps },
            { name: 'Note effects', items: noteEffects },
            { name: 'Beat effects', items: beatEffects },
            { name: 'Bar', items: barOps },
        ]" :key="group.name">
            <h6>{{ group.name }}</h6>
            <div class="buttons">
                <button
                    v-for="item in group.items"
                    :key="item.command"
                    type="button"
                    class="btn btn-sm btn-secondary"
                    :class="{ active: isActive(item) }"
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
.editor-sidebar {
    width: 170px;
    flex-shrink: 0;
    align-self: flex-start;
    position: sticky;
    top: 60px;
    max-height: calc(100vh - 170px);
    overflow-y: auto;
    padding: 8px 10px;

    .group {
        margin-bottom: 12px;

        h6 {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #7f96a8;
            margin-bottom: 6px;
        }
    }

    .buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    // Let the horizontal duration picker wrap inside the narrow palette
    :deep(.duration-picker) {
        flex-wrap: wrap;
        gap: 4px;

        .btn {
            border-radius: 4px !important;
        }
    }

    .kbd {
        font-size: 10px;
        color: #93a8ba;
        border: 1px solid #3a4652;
        border-radius: 3px;
        padding: 0 3px;
        margin-left: 3px;
    }
}
</style>
