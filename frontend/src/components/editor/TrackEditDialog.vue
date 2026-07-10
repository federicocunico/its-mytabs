<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Button } from "@/components/ui/button/index.ts";
import { Input } from "@/components/ui/input/index.ts";
import { Label } from "@/components/ui/label/index.ts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog/index.ts";
import { ColorSwatches } from "@/components/ui/color-picker/index.ts";
import { instrumentList } from "@/app.ts";
import { matchPresetId, TUNING_PRESETS } from "@/editor/tunings.ts";

/**
 * Per-track Edit dialog opened from the mixer's three-dots button. Edits name,
 * instrument (MIDI program), tuning + capo, and colour for one specific track.
 * Each control emits its own change (index-parameterised) so the page can route
 * it to the matching EditorController method; the parent re-opens the dialog with
 * a fresh `track` after each edit so the fields stay in sync.
 */
interface TrackEditTarget {
    index: number;
    name: string;
    program: number;
    tuning: number[];
    capo: number;
    strings: number;
    color: string;
    isPercussion: boolean;
}

const props = defineProps<{ track: TrackEditTarget | null }>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
    renameTrack: [index: number, name: string];
    setInstrument: [index: number, program: number];
    retune: [index: number, payload: { tuning: number[]; capo: number }];
    setColor: [index: number, hex: string];
}>();

const INSTRUMENTS = instrumentList();

// Local editable state, seeded from the target track whenever the dialog opens
// or the target changes (the parent hands us a fresh object after each edit).
const name = ref("");
const program = ref(0);
const tuningPreset = ref<string>("");
const capo = ref<number>(0);

watch(
    () => props.track,
    (t) => {
        if (!t) {
            return;
        }
        name.value = t.name;
        program.value = t.program;
        tuningPreset.value = matchPresetId(t.tuning) ?? "";
        capo.value = t.capo;
    },
    { immediate: true },
);

const currentColor = computed(() => props.track?.color ?? "");

function commitName() {
    const t = props.track;
    if (!t) {
        return;
    }
    const trimmed = name.value.trim();
    if (trimmed && trimmed !== t.name) {
        emit("renameTrack", t.index, trimmed);
    }
}

function onInstrumentChange() {
    const t = props.track;
    if (t) {
        emit("setInstrument", t.index, Number(program.value));
    }
}

function applyTuning() {
    const t = props.track;
    if (!t) {
        return;
    }
    const preset = TUNING_PRESETS.find((p) => p.id === tuningPreset.value);
    if (preset) {
        emit("retune", t.index, { tuning: [...preset.tuning], capo: Number(capo.value) || 0 });
    }
}

function onColorSelect(hex: string) {
    const t = props.track;
    if (t) {
        emit("setColor", t.index, hex);
    }
}

// Native <select> styling — mirrors TrackManagerDialog: a native select avoids a
// reka Select portal that teleports out of DialogContent and auto-dismisses it.
const SELECT_CLASS =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Edit track</DialogTitle>
                <DialogDescription>Change this track's name, instrument, tuning and colour.</DialogDescription>
            </DialogHeader>

            <div v-if="track" class="grid gap-4">
                <!-- Name -->
                <div class="grid gap-1.5">
                    <Label>Name</Label>
                    <Input
                        v-model="name"
                        placeholder="Track name"
                        @keydown.enter.prevent="commitName"
                        @blur="commitName"
                    />
                </div>

                <!-- Instrument -->
                <div class="grid gap-1.5">
                    <Label>Instrument</Label>
                    <select
                        v-if="!track.isPercussion"
                        v-model.number="program"
                        :class="SELECT_CLASS"
                        @change="onInstrumentChange"
                    >
                        <option v-for="i in INSTRUMENTS" :key="i.program" :value="i.program">{{ i.name }}</option>
                    </select>
                    <p v-else class="text-sm text-muted-foreground">Percussion track (drum kit) — no melodic instrument.</p>
                </div>

                <!-- Tuning -->
                <div class="grid gap-1.5">
                    <Label>Tuning</Label>
                    <p class="text-xs text-muted-foreground">Changing the string count is only possible while the track has no notes.</p>
                    <div class="flex flex-wrap items-end gap-2">
                        <div class="min-w-40 flex-1">
                            <select v-model="tuningPreset" :class="SELECT_CLASS">
                                <option v-if="!tuningPreset" value="" disabled>Custom ({{ track.strings }} strings)</option>
                                <option v-for="p in TUNING_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
                            </select>
                        </div>
                        <div class="w-20">
                            <Label class="mb-1 block text-xs text-muted-foreground">Capo</Label>
                            <Input v-model.number="capo" type="number" min="0" max="12" />
                        </div>
                        <Button variant="secondary" :disabled="!tuningPreset" @click="applyTuning">Apply</Button>
                    </div>
                </div>

                <!-- Colour -->
                <div class="grid gap-1.5">
                    <Label>Colour</Label>
                    <ColorSwatches :model-value="currentColor" @select="onColorSelect" />
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Done</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
