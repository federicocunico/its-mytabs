<script>
import { defineComponent } from "vue";
import { BModal } from "bootstrap-vue-next";

export const TUNING_PRESETS = [
    { id: "guitar-standard", label: "Guitar — Standard (EADGBE)", tuning: [64, 59, 55, 50, 45, 40], program: 25 },
    { id: "guitar-drop-d", label: "Guitar — Drop D", tuning: [64, 59, 55, 50, 45, 38], program: 25 },
    { id: "guitar-7", label: "Guitar — 7-string", tuning: [64, 59, 55, 50, 45, 40, 35], program: 25 },
    { id: "bass-4", label: "Bass — 4-string (EADG)", tuning: [43, 38, 33, 28], program: 33 },
    { id: "bass-5", label: "Bass — 5-string (BEADG)", tuning: [43, 38, 33, 28, 23], program: 33 },
];

export default defineComponent({
    components: { BModal },
    props: {
        modelValue: {
            type: Boolean,
            default: false,
        },
        tracks: {
            type: Array,
            required: true,
        },
        currentIndex: {
            type: Number,
            required: true,
        },
    },
    emits: ["update:modelValue", "switchTrack", "addTrack", "removeTrack", "retune"],
    data() {
        return {
            presets: TUNING_PRESETS,
            newName: "",
            newPreset: "guitar-standard",
            retunePreset: "guitar-standard",
            capo: 0,
        };
    },
    methods: {
        add() {
            const preset = this.presets.find((p) => p.id === this.newPreset);
            if (!preset || !this.newName.trim()) {
                return;
            }
            this.$emit("addTrack", { name: this.newName.trim(), tuning: [...preset.tuning], program: preset.program });
            this.newName = "";
        },
        retune() {
            const preset = this.presets.find((p) => p.id === this.retunePreset);
            if (preset) {
                this.$emit("retune", { tuning: [...preset.tuning], capo: this.capo });
            }
        },
    },
});
</script>

<template>
    <BModal
        :model-value="modelValue"
        title="Tracks"
        ok-only
        @update:model-value='$emit("update:modelValue", $event)'
    >
        <table class="table table-sm table-dark align-middle">
            <tbody>
                <tr v-for="(track, i) in tracks" :key="i" :class="{ 'table-active': i === currentIndex }">
                    <td>{{ track.name }}</td>
                    <td class="text-muted">{{ track.strings }} strings</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-secondary me-1" :disabled="i === currentIndex" @click='$emit("switchTrack", i)'>Edit</button>
                        <button class="btn btn-sm btn-outline-danger" :disabled="tracks.length <= 1" @click='$emit("removeTrack", i)'>Remove</button>
                    </td>
                </tr>
            </tbody>
        </table>

        <hr />

        <h6>Add track</h6>
        <div class="row g-2 mb-3">
            <div class="col-5">
                <input type="text" class="form-control form-control-sm" placeholder="Track name" v-model="newName" />
            </div>
            <div class="col-5">
                <select class="form-select form-select-sm" v-model="newPreset">
                    <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.label }}</option>
                </select>
            </div>
            <div class="col-2">
                <button class="btn btn-sm btn-primary w-100" :disabled="!newName.trim()" @click="add">Add</button>
            </div>
        </div>

        <h6>Re-tune current track</h6>
        <p class="text-muted small mb-2">Changing the string count is only possible while the track has no notes.</p>
        <div class="row g-2">
            <div class="col-6">
                <select class="form-select form-select-sm" v-model="retunePreset">
                    <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.label }}</option>
                </select>
            </div>
            <div class="col-3">
                <input type="number" class="form-control form-control-sm" min="0" max="12" v-model.number="capo" title="Capo" />
            </div>
            <div class="col-3">
                <button class="btn btn-sm btn-secondary w-100" @click="retune">Apply</button>
            </div>
        </div>
    </BModal>
</template>
