<script>
import { defineComponent } from "vue";

const DURATIONS = [
    { value: 1, label: "1/1", title: "Whole" },
    { value: 2, label: "1/2", title: "Half" },
    { value: 4, label: "1/4", title: "Quarter" },
    { value: 8, label: "1/8", title: "Eighth" },
    { value: 16, label: "1/16", title: "16th" },
    { value: 32, label: "1/32", title: "32nd" },
    { value: 64, label: "1/64", title: "64th" },
];

export default defineComponent({
    props: {
        duration: {
            type: Number,
            default: 4,
        },
        dots: {
            type: Number,
            default: 0,
        },
        disabled: {
            type: Boolean,
            default: false,
        },
    },
    emits: ["command"],
    data() {
        return { DURATIONS };
    },
});
</script>

<template>
    <div class="btn-group btn-group-sm duration-picker" role="group" aria-label="Note duration">
        <button
            v-for="d in DURATIONS"
            :key="d.value"
            type="button"
            class="btn btn-secondary"
            :class="{ active: duration === d.value }"
            :title="d.title"
            :disabled="disabled"
            @click='$emit("command", "setDuration", d.value)'
        >
            {{ d.label }}
        </button>
        <button
            type="button"
            class="btn btn-secondary"
            :class="{ active: dots > 0 }"
            title="Dotted note (.)"
            :disabled="disabled"
            @click='$emit("command", "toggleDot")'
        >
            •
        </button>
    </div>
</template>
