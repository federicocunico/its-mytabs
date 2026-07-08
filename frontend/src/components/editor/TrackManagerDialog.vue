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

/** The instrument name at the head of a preset label ("Guitar — Standard…" -> "Guitar"). */
function instrumentOf(preset) {
    return preset.label.split("—")[0].trim();
}

export default defineComponent({
    components: { BModal },
    props: {
        modelValue: { type: Boolean, default: false },
        tracks: { type: Array, required: true },
        currentIndex: { type: Number, required: true },
    },
    emits: ["update:modelValue", "switchTrack", "addTrack", "removeTrack", "renameTrack", "retune"],
    data() {
        return {
            presets: TUNING_PRESETS,
            newPreset: "guitar-standard",
            newName: "",
            nameDirty: false,
            editingIndex: null,
            editingName: "",
            confirmRemoveIndex: null,
            retunePreset: "guitar-standard",
            capo: 0,
        };
    },
    computed: {
        selectedPreset() {
            return this.presets.find((p) => p.id === this.newPreset) ?? this.presets[0];
        },
    },
    watch: {
        modelValue(open) {
            if (open) {
                this.newPreset = "guitar-standard";
                this.resetAddForm();
                this.retunePreset = "guitar-standard";
                this.capo = 0;
                this.editingIndex = null;
                this.confirmRemoveIndex = null;
            }
        },
        newPreset() {
            if (!this.nameDirty) {
                this.newName = instrumentOf(this.selectedPreset);
            }
        },
    },
    methods: {
        resetAddForm() {
            this.nameDirty = false;
            this.newName = instrumentOf(this.selectedPreset);
        },
        onNameInput() {
            this.nameDirty = true;
        },
        add() {
            const name = this.newName.trim();
            if (!name) {
                return;
            }
            const preset = this.selectedPreset;
            this.$emit("addTrack", { name, tuning: [...preset.tuning], program: preset.program });
            this.resetAddForm();
        },
        startEdit(i) {
            this.confirmRemoveIndex = null;
            this.editingIndex = i;
            this.editingName = this.tracks[i]?.name ?? "";
            this.$nextTick(() => {
                const el = this.$refs.renameInput;
                (Array.isArray(el) ? el[0] : el)?.focus();
            });
        },
        commitEdit() {
            const i = this.editingIndex;
            if (i === null) {
                return;
            }
            const name = this.editingName.trim();
            this.editingIndex = null;
            if (name && name !== this.tracks[i]?.name) {
                this.$emit("renameTrack", i, name);
            }
        },
        cancelEdit() {
            this.editingIndex = null;
        },
        onRemoveClick(i) {
            if (this.confirmRemoveIndex === i) {
                this.confirmRemoveIndex = null;
                this.$emit("removeTrack", i);
            } else {
                this.confirmRemoveIndex = i;
            }
        },
        switchTo(i) {
            this.confirmRemoveIndex = null;
            this.$emit("switchTrack", i);
        },
        retune() {
            const preset = this.presets.find((p) => p.id === this.retunePreset);
            if (preset) {
                this.$emit("retune", { tuning: [...preset.tuning], capo: Number(this.capo) || 0 });
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
        ok-title="Done"
        @update:model-value='$emit("update:modelValue", $event)'
    >
        <!-- Track list -->
        <div class="tm-list mb-3">
            <div
                v-for="(track, i) in tracks"
                :key="i"
                class="tm-row"
                :class="{ 'tm-row-active': i === currentIndex }"
            >
                <div class="tm-name">
                    <input
                        v-if="editingIndex === i"
                        ref="renameInput"
                        v-model="editingName"
                        type="text"
                        class="form-control form-control-sm"
                        @keydown.enter.prevent="commitEdit"
                        @keydown.esc.prevent="cancelEdit"
                        @blur="commitEdit"
                    />
                    <button
                        v-else
                        type="button"
                        class="tm-name-btn"
                        title="Rename track"
                        @click="startEdit(i)"
                    >{{ track.name || "Untitled" }}</button>
                </div>
                <span class="tm-strings">{{ track.strings }} str</span>
                <button
                    class="btn btn-sm btn-outline-secondary"
                    :disabled="i === currentIndex"
                    @click="switchTo(i)"
                >{{ i === currentIndex ? "Editing" : "Edit" }}</button>
                <button
                    class="btn btn-sm"
                    :class="confirmRemoveIndex === i ? 'btn-danger' : 'btn-outline-danger'"
                    :disabled="tracks.length <= 1"
                    :title="confirmRemoveIndex === i ? 'Click again to confirm' : 'Remove track'"
                    @click="onRemoveClick(i)"
                >{{ confirmRemoveIndex === i ? "Remove?" : "✕" }}</button>
            </div>
        </div>

        <hr />

        <!-- Add track -->
        <h6 class="mb-2">Add track</h6>
        <div class="tm-form-row mb-3">
            <select class="form-select form-select-sm tm-grow" v-model="newPreset">
                <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.label }}</option>
            </select>
            <input
                type="text"
                class="form-control form-control-sm tm-grow"
                placeholder="Track name"
                v-model="newName"
                @input="onNameInput"
                @keydown.enter.prevent="add"
            />
            <button class="btn btn-sm btn-primary" :disabled="!newName.trim()" @click="add">Add</button>
        </div>

        <!-- Re-tune current track -->
        <h6 class="mb-1">Re-tune current track</h6>
        <p class="text-muted small mb-2">Changing the string count is only possible while the track has no notes.</p>
        <div class="tm-form-row">
            <select class="form-select form-select-sm tm-grow" v-model="retunePreset">
                <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.label }}</option>
            </select>
            <input type="number" class="form-control form-control-sm tm-capo" min="0" max="12" v-model.number="capo" title="Capo" />
            <button class="btn btn-sm btn-secondary" @click="retune">Apply</button>
        </div>
    </BModal>
</template>

<style scoped>
.tm-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.tm-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid var(--bs-border-color, #333);
    border-radius: 6px;
}

.tm-row-active {
    border-color: var(--bs-primary, #5b6ef5);
    background: rgba(91, 110, 245, 0.1);
}

.tm-name {
    flex: 1;
    min-width: 0;
}

.tm-name-btn {
    background: none;
    border: none;
    padding: 2px 0;
    color: inherit;
    text-align: left;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: text;
}

.tm-name-btn:hover {
    text-decoration: underline;
}

.tm-strings {
    flex: none;
    font-size: 12px;
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
}

.tm-form-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.tm-grow {
    flex: 1;
    min-width: 0;
}

.tm-capo {
    flex: none;
    width: 64px;
}
</style>
