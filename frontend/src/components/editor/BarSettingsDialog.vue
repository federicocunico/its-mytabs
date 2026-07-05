<script>
import { defineComponent } from "vue";
import { BModal } from "bootstrap-vue-next";

const KEY_NAMES = {
    "-7": "Cb",
    "-6": "Gb",
    "-5": "Db",
    "-4": "Ab",
    "-3": "Eb",
    "-2": "Bb",
    "-1": "F",
    "0": "C",
    "1": "G",
    "2": "D",
    "3": "A",
    "4": "E",
    "5": "B",
    "6": "F#",
    "7": "C#",
};

export default defineComponent({
    components: { BModal },
    props: {
        modelValue: {
            type: Boolean,
            default: false,
        },
        /** Current values of the bar at the cursor. */
        initial: {
            type: Object,
            required: true,
        },
    },
    emits: ["update:modelValue", "apply"],
    data() {
        return {
            form: {},
            KEY_NAMES,
            denominators: [1, 2, 4, 8, 16, 32],
            feels: [
                { value: 0, label: "None" },
                { value: 1, label: "Triplet 16th" },
                { value: 2, label: "Triplet 8th" },
                { value: 3, label: "Dotted 16th" },
                { value: 4, label: "Dotted 8th" },
                { value: 5, label: "Scottish 16th" },
                { value: 6, label: "Scottish 8th" },
            ],
        };
    },
    watch: {
        modelValue(open) {
            if (open) {
                // Copy the current bar state into the form on every open
                this.form = { ...this.initial };
            }
        },
    },
    methods: {
        apply() {
            this.$emit("apply", { ...this.form, initial: this.initial });
            this.$emit("update:modelValue", false);
        },
    },
});
</script>

<template>
    <BModal
        :model-value="modelValue"
        title="Bar settings"
        @update:model-value='$emit("update:modelValue", $event)'
        @ok="apply"
    >
        <div class="row g-2 mb-3 align-items-end">
            <div class="col-3">
                <label class="form-label">Time sig.</label>
                <input type="number" class="form-control form-control-sm" min="1" max="32" v-model.number="form.tsNumerator" />
            </div>
            <div class="col-3">
                <label class="form-label">/</label>
                <select class="form-select form-select-sm" v-model.number="form.tsDenominator">
                    <option v-for="d in denominators" :key="d" :value="d">{{ d }}</option>
                </select>
            </div>
            <div class="col-6">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="tsFollowing" v-model="form.tsFollowing" />
                    <label class="form-check-label" for="tsFollowing">Apply to following bars</label>
                </div>
            </div>
        </div>

        <div class="row g-2 mb-3 align-items-end">
            <div class="col-4">
                <label class="form-label">Tempo (BPM)</label>
                <input type="number" class="form-control form-control-sm" min="10" max="500" v-model.number="form.tempo" placeholder="unchanged" />
            </div>
            <div class="col-4">
                <label class="form-label">Key</label>
                <select class="form-select form-select-sm" v-model.number="form.key">
                    <option v-for="(name, value) in KEY_NAMES" :key="value" :value="parseInt(value)">{{ name }}</option>
                </select>
            </div>
            <div class="col-4">
                <label class="form-label">Mode</label>
                <select class="form-select form-select-sm" v-model.number="form.keyType">
                    <option :value="0">Major</option>
                    <option :value="1">Minor</option>
                </select>
            </div>
        </div>

        <div class="row g-2 mb-3 align-items-end">
            <div class="col-4">
                <div class="form-check mt-4">
                    <input class="form-check-input" type="checkbox" id="repeatStart" v-model="form.repeatStart" />
                    <label class="form-check-label" for="repeatStart">Repeat start</label>
                </div>
            </div>
            <div class="col-4">
                <label class="form-label">Repeat count (end)</label>
                <input type="number" class="form-control form-control-sm" min="0" max="100" v-model.number="form.repeatCount" />
            </div>
            <div class="col-4">
                <label class="form-label">Triplet feel</label>
                <select class="form-select form-select-sm" v-model.number="form.tripletFeel">
                    <option v-for="f in feels" :key="f.value" :value="f.value">{{ f.label }}</option>
                </select>
            </div>
        </div>

        <div class="mb-2">
            <label class="form-label">Section name</label>
            <input type="text" class="form-control form-control-sm" v-model="form.section" placeholder="e.g. Chorus (empty = none)" />
        </div>
    </BModal>
</template>
