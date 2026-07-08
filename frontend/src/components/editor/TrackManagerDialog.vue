<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Check, Guitar, Pencil, Plus, X } from "@lucide/vue";
import { Button } from "@/components/ui/button/index.ts";
import { Input } from "@/components/ui/input/index.ts";
import { Label } from "@/components/ui/label/index.ts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog/index.ts";

interface TuningPreset {
    id: string;
    label: string;
    tuning: number[];
    program: number;
}

const TUNING_PRESETS: TuningPreset[] = [
    { id: "guitar-standard", label: "Guitar — Standard (EADGBE)", tuning: [64, 59, 55, 50, 45, 40], program: 25 },
    { id: "guitar-drop-d", label: "Guitar — Drop D", tuning: [64, 59, 55, 50, 45, 38], program: 25 },
    { id: "guitar-7", label: "Guitar — 7-string", tuning: [64, 59, 55, 50, 45, 40, 35], program: 25 },
    { id: "bass-4", label: "Bass — 4-string (EADG)", tuning: [43, 38, 33, 28], program: 33 },
    { id: "bass-5", label: "Bass — 5-string (BEADG)", tuning: [43, 38, 33, 28, 23], program: 33 },
];

/** The instrument name at the head of a preset label ("Guitar — Standard…" -> "Guitar"). */
function instrumentOf(preset: TuningPreset): string {
    return preset.label.split("—")[0].trim();
}

const props = defineProps<{
    tracks: { name: string; strings: number }[];
    currentIndex: number;
}>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
    switchTrack: [index: number];
    addTrack: [template: { name: string; tuning: number[]; program: number }];
    removeTrack: [index: number];
    renameTrack: [index: number, name: string];
    retune: [payload: { tuning: number[]; capo: number }];
}>();

// ---- add track ----
const newPreset = ref("guitar-standard");
const newName = ref("");
// Once the user types a custom name, stop auto-filling it from the preset.
const nameDirty = ref(false);

const selectedPreset = computed(() => TUNING_PRESETS.find((p) => p.id === newPreset.value) ?? TUNING_PRESETS[0]);

function resetAddForm() {
    nameDirty.value = false;
    newName.value = instrumentOf(selectedPreset.value);
}

watch(open, (v) => {
    if (v) {
        newPreset.value = "guitar-standard";
        resetAddForm();
        retunePreset.value = "guitar-standard";
        capo.value = 0;
        editingIndex.value = null;
        confirmRemoveIndex.value = null;
    }
});

watch(newPreset, () => {
    if (!nameDirty.value) {
        newName.value = instrumentOf(selectedPreset.value);
    }
});

function onNameInput() {
    nameDirty.value = true;
}

function add() {
    const name = newName.value.trim();
    if (!name) {
        return;
    }
    const preset = selectedPreset.value;
    emit("addTrack", { name, tuning: [...preset.tuning], program: preset.program });
    // The dialog stays open (parent refreshes the list); reset the form so the
    // next add is ready to go.
    resetAddForm();
}

// ---- inline rename ----
const editingIndex = ref<number | null>(null);
const editingName = ref("");

function startEdit(i: number) {
    confirmRemoveIndex.value = null;
    editingIndex.value = i;
    editingName.value = props.tracks[i]?.name ?? "";
}

function commitEdit() {
    const i = editingIndex.value;
    if (i === null) {
        return;
    }
    const name = editingName.value.trim();
    editingIndex.value = null;
    if (name && name !== props.tracks[i]?.name) {
        emit("renameTrack", i, name);
    }
}

function cancelEdit() {
    editingIndex.value = null;
}

// ---- remove (two-step confirm) ----
const confirmRemoveIndex = ref<number | null>(null);

function onRemoveClick(i: number) {
    if (confirmRemoveIndex.value === i) {
        confirmRemoveIndex.value = null;
        emit("removeTrack", i);
    } else {
        confirmRemoveIndex.value = i;
    }
}

function switchTo(i: number) {
    confirmRemoveIndex.value = null;
    emit("switchTrack", i);
}

// ---- re-tune current track ----
const retunePreset = ref("guitar-standard");
const capo = ref<number>(0);

function retune() {
    const preset = TUNING_PRESETS.find((p) => p.id === retunePreset.value);
    if (preset) {
        emit("retune", { tuning: [...preset.tuning], capo: Number(capo.value) || 0 });
    }
}

// Shared class for the native <select> triggers — mirrors the Input styling so
// the dropdowns read as part of the same kit. A native select (rather than the
// reka Select) avoids a portal that teleports outside DialogContent, which made
// the Dialog auto-dismiss the moment the dropdown opened.
const SELECT_CLASS =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Tracks</DialogTitle>
                <DialogDescription>Add, rename, re-tune or remove the instruments in this song.</DialogDescription>
            </DialogHeader>

            <!-- Track list -->
            <div class="overflow-hidden rounded-md border border-border">
                <div
                    v-for="(track, i) in tracks"
                    :key="i"
                    class="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
                    :class="i === currentIndex ? 'bg-accent/60' : ''"
                >
                    <Guitar class="size-4 shrink-0 text-muted-foreground" />

                    <!-- name: inline-editable -->
                    <div class="min-w-0 flex-1">
                        <Input
                            v-if="editingIndex === i"
                            v-model="editingName"
                            autofocus
                            class="h-7"
                            @keydown.enter.prevent="commitEdit"
                            @keydown.esc.prevent="cancelEdit"
                            @blur="commitEdit"
                        />
                        <button
                            v-else
                            type="button"
                            class="group flex min-w-0 items-center gap-1.5 text-left text-sm"
                            title="Rename track"
                            @click="startEdit(i)"
                        >
                            <span class="truncate">{{ track.name || "Untitled" }}</span>
                            <Pencil class="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                    </div>

                    <span class="shrink-0 font-mono text-xs text-muted-foreground">{{ track.strings }} str</span>

                    <Button
                        v-if="editingIndex !== i"
                        size="sm"
                        variant="ghost"
                        class="shrink-0"
                        :disabled="i === currentIndex"
                        @click="switchTo(i)"
                    >
                        {{ i === currentIndex ? "Editing" : "Edit" }}
                    </Button>
                    <Button
                        v-if="editingIndex === i"
                        size="sm"
                        variant="ghost"
                        class="shrink-0"
                        title="Save name"
                        @mousedown.prevent="commitEdit"
                    >
                        <Check class="size-4" />
                    </Button>

                    <!-- remove: two-step confirm -->
                    <Button
                        size="sm"
                        :variant="confirmRemoveIndex === i ? 'destructive' : 'ghost'"
                        class="shrink-0"
                        :disabled="tracks.length <= 1"
                        :title="confirmRemoveIndex === i ? 'Click again to confirm' : 'Remove track'"
                        @click="onRemoveClick(i)"
                    >
                        <template v-if="confirmRemoveIndex === i">Remove?</template>
                        <X v-else class="size-4" />
                    </Button>
                </div>
            </div>

            <!-- Add track -->
            <div class="grid gap-2">
                <Label>Add track</Label>
                <div class="flex flex-wrap items-end gap-2">
                    <div class="min-w-40 flex-1">
                        <select v-model="newPreset" :class="SELECT_CLASS">
                            <option v-for="p in TUNING_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
                        </select>
                    </div>
                    <div class="min-w-32 flex-1">
                        <Input v-model="newName" placeholder="Track name" @input="onNameInput" @keydown.enter.prevent="add" />
                    </div>
                    <Button :disabled="!newName.trim()" @click="add">
                        <Plus class="size-4" />
                        Add
                    </Button>
                </div>
            </div>

            <!-- Re-tune current track -->
            <div class="grid gap-2 border-t border-border pt-4">
                <Label>Re-tune current track</Label>
                <p class="text-xs text-muted-foreground">Changing the string count is only possible while the track has no notes.</p>
                <div class="flex flex-wrap items-end gap-2">
                    <div class="min-w-40 flex-1">
                        <select v-model="retunePreset" :class="SELECT_CLASS">
                            <option v-for="p in TUNING_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
                        </select>
                    </div>
                    <div class="w-24">
                        <Label class="mb-1 block text-xs text-muted-foreground">Capo</Label>
                        <Input v-model="capo" type="number" min="0" max="12" />
                    </div>
                    <Button variant="secondary" @click="retune">Apply</Button>
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Done</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
