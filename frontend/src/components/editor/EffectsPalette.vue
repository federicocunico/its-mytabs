<script>
import { defineComponent } from "vue";

/**
 * Second toolbar row with effect toggle buttons. `fx` reflects the note/beat
 * at the cursor; buttons emit the same command ids as the keyboard shortcuts.
 */
export default defineComponent({
    props: {
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
            noteToggles: [
                { command: "toggleHammer", label: "H", title: "Hammer-on / pull-off (H)", active: "hammer" },
                { command: "togglePalmMute", label: "PM", title: "Palm mute (P)", active: "palmMute" },
                { command: "toggleLetRing", label: "LR", title: "Let ring (I)", active: "letRing" },
                { command: "toggleDead", label: "X", title: "Dead note (X)", active: "dead" },
                { command: "toggleGhost", label: "( )", title: "Ghost note (O)", active: "ghost" },
                { command: "toggleStaccato", label: "Stac.", title: "Staccato (D)", active: "staccato" },
            ],
            cycles: [
                { command: "cycleVibrato", label: "Vib", title: "Vibrato (V)", active: "vibrato" },
                { command: "cycleHarmonic", label: "Harm", title: "Harmonics (N)", active: "harmonic" },
                { command: "cycleAccent", label: ">", title: "Accent (A)", active: "accent" },
                { command: "cycleTremolo", label: "Trem", title: "Tremolo picking (Y)", active: "tremolo" },
                { command: "cycleGrace", label: "Grace", title: "Grace note (G)", active: "grace" },
            ],
            slides: [
                { command: "toggleSlideShift", label: "Sl.", title: "Shift slide (S)", active: "slideShift" },
                { command: "toggleSlideLegato", label: "Sl.leg", title: "Legato slide (Shift+S)", active: "slideLegato" },
            ],
        };
    },
});
</script>

<template>
    <div class="effects-palette">
        <div class="btn-group btn-group-sm" role="group">
            <button
                v-for="b in noteToggles"
                :key="b.command"
                type="button"
                class="btn btn-secondary"
                :class="{ active: fx[b.active] }"
                :title="b.title"
                :disabled="disabled"
                @click='$emit("command", b.command)'
            >
                {{ b.label }}
            </button>
        </div>

        <div class="btn-group btn-group-sm" role="group">
            <button
                type="button"
                class="btn btn-secondary"
                :class="{ active: fx.bend }"
                title="Bend… (B)"
                :disabled="disabled"
                @click='$emit("command", "bendDialog")'
            >
                Bend
            </button>
            <button
                v-for="b in slides"
                :key="b.command"
                type="button"
                class="btn btn-secondary"
                :class="{ active: fx[b.active] }"
                :title="b.title"
                :disabled="disabled"
                @click='$emit("command", b.command)'
            >
                {{ b.label }}
            </button>
        </div>

        <div class="btn-group btn-group-sm" role="group">
            <button
                v-for="b in cycles"
                :key="b.command"
                type="button"
                class="btn btn-secondary"
                :class="{ active: fx[b.active] }"
                :title="b.title"
                :disabled="disabled"
                @click='$emit("command", b.command)'
            >
                {{ b.label }}
            </button>
            <button
                type="button"
                class="btn btn-secondary"
                :class="{ active: fx.tap }"
                title="Tapping (T)"
                :disabled="disabled"
                @click='$emit("command", "toggleTap")'
            >
                Tap
            </button>
            <button
                type="button"
                class="btn btn-secondary"
                :class="{ active: fx.trill }"
                title="Trill… (Shift+T)"
                :disabled="disabled"
                @click='$emit("command", "trillDialog")'
            >
                Trill
            </button>
        </div>
    </div>
</template>

<style scoped lang="scss">
.effects-palette {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding-top: 6px;
}
</style>
