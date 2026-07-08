<script setup lang="ts">
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button/index.ts";
import { Input } from "@/components/ui/input/index.ts";
import { Label } from "@/components/ui/label/index.ts";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog/index.ts";

const KEY_NAMES: Record<string, string> = {
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

const DENOMINATORS = [1, 2, 4, 8, 16, 32];
const FEELS = [
    { value: 0, label: "None" },
    { value: 1, label: "Triplet 16th" },
    { value: 2, label: "Triplet 8th" },
    { value: 3, label: "Dotted 16th" },
    { value: 4, label: "Dotted 8th" },
    { value: 5, label: "Scottish 16th" },
    { value: 6, label: "Scottish 8th" },
];

const SELECT_CLASS =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const props = defineProps<{ initial: Record<string, unknown> }>();
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ apply: [form: Record<string, unknown>] }>();

const form = ref<Record<string, unknown>>({});

watch(open, (v) => {
    if (v) {
        form.value = { ...props.initial };
    }
});

function apply() {
    emit("apply", { ...form.value, initial: props.initial });
    open.value = false;
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Bar settings</DialogTitle>
            </DialogHeader>

            <div class="grid grid-cols-3 items-end gap-3">
                <div class="grid gap-1.5">
                    <Label>Time sig.</Label>
                    <Input type="number" min="1" max="32" v-model.number="form.tsNumerator" />
                </div>
                <div class="grid gap-1.5">
                    <Label>/</Label>
                    <select :class="SELECT_CLASS" v-model.number="form.tsDenominator">
                        <option v-for="d in DENOMINATORS" :key="d" :value="d">{{ d }}</option>
                    </select>
                </div>
                <label class="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" v-model="form.tsFollowing" class="accent-[var(--primary)]" />
                    Apply to following
                </label>
            </div>

            <div class="grid grid-cols-3 items-end gap-3">
                <div class="grid gap-1.5">
                    <Label>Tempo (BPM)</Label>
                    <Input type="number" min="10" max="500" placeholder="unchanged" v-model.number="form.tempo" />
                </div>
                <div class="grid gap-1.5">
                    <Label>Key</Label>
                    <select :class="SELECT_CLASS" v-model.number="form.key">
                        <option v-for="(name, value) in KEY_NAMES" :key="value" :value="parseInt(value)">{{ name }}</option>
                    </select>
                </div>
                <div class="grid gap-1.5">
                    <Label>Mode</Label>
                    <select :class="SELECT_CLASS" v-model.number="form.keyType">
                        <option :value="0">Major</option>
                        <option :value="1">Minor</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-3 items-end gap-3">
                <label class="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" v-model="form.repeatStart" class="accent-[var(--primary)]" />
                    Repeat start
                </label>
                <div class="grid gap-1.5">
                    <Label>Repeat count (end)</Label>
                    <Input type="number" min="0" max="100" v-model.number="form.repeatCount" />
                </div>
                <div class="grid gap-1.5">
                    <Label>Triplet feel</Label>
                    <select :class="SELECT_CLASS" v-model.number="form.tripletFeel">
                        <option v-for="f in FEELS" :key="f.value" :value="f.value">{{ f.label }}</option>
                    </select>
                </div>
            </div>

            <div class="grid gap-1.5">
                <Label>Section name</Label>
                <Input type="text" placeholder="e.g. Chorus (empty = none)" v-model="form.section" />
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button @click="apply">Apply</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
