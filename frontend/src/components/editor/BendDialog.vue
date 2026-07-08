<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@/components/ui/button/index.ts";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog/index.ts";
import { BEND_PRESETS } from "@/editor/mutations/effects.ts";

const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ apply: [preset: (typeof BEND_PRESETS)[number]] }>();

const selected = ref("bend-full");

function apply() {
    const preset = BEND_PRESETS.find((p) => p.id === selected.value);
    if (preset) {
        emit("apply", preset);
    }
    open.value = false;
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>Bend</DialogTitle>
            </DialogHeader>
            <div class="grid gap-1">
                <label
                    v-for="preset in BEND_PRESETS"
                    :key="preset.id"
                    class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                >
                    <input type="radio" name="bendPreset" :value="preset.id" v-model="selected" class="accent-[var(--primary)]" />
                    {{ preset.label }}
                </label>
            </div>
            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button @click="apply">Apply</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
