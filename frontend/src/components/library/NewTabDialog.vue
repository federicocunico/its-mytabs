<script setup lang="ts">
import { ref, watch } from "vue";
import { Guitar } from "@lucide/vue";
import { Button } from "@/components/ui/button/index.ts";
import { Input } from "@/components/ui/input/index.ts";
import { Label } from "@/components/ui/label/index.ts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog/index.ts";

export type TabTemplate = "guitar" | "bass";

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
    create: [name: string, template: TabTemplate];
}>();

const name = ref("");
const template = ref<TabTemplate>("guitar");
const error = ref("");

watch(open, (v) => {
    if (v) {
        name.value = "";
        template.value = "guitar";
        error.value = "";
    }
});

function submit() {
    const n = name.value.trim();
    if (!n) {
        error.value = "Enter a name for the tab.";
        return;
    }
    if (/[/\\]/.test(n)) {
        error.value = "Names can't contain slashes.";
        return;
    }
    open.value = false;
    emit("create", n, template.value);
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>New tab</DialogTitle>
                <DialogDescription>Start from an empty template and open it in the editor.</DialogDescription>
            </DialogHeader>
            <form class="grid gap-4" @submit.prevent="submit">
                <div class="grid gap-2">
                    <Label for="new-tab-name">Name</Label>
                    <Input id="new-tab-name" v-model="name" autofocus placeholder="e.g. My new song" />
                    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
                </div>
                <div class="grid gap-2">
                    <Label>Instrument</Label>
                    <div class="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            class="flex flex-col items-center gap-1.5 rounded-md border p-3 text-sm transition-colors"
                            :class="template === 'guitar'
                                ? 'border-primary bg-accent text-accent-foreground'
                                : 'border-border text-muted-foreground hover:border-ring/40 hover:text-foreground'"
                            @click="template = 'guitar'"
                        >
                            <Guitar class="size-5" />
                            Guitar
                            <span class="font-mono text-[10px] text-muted-foreground">6 strings</span>
                        </button>
                        <button
                            type="button"
                            class="flex flex-col items-center gap-1.5 rounded-md border p-3 text-sm transition-colors"
                            :class="template === 'bass'
                                ? 'border-primary bg-accent text-accent-foreground'
                                : 'border-border text-muted-foreground hover:border-ring/40 hover:text-foreground'"
                            @click="template = 'bass'"
                        >
                            <Guitar class="size-5" />
                            Bass
                            <span class="font-mono text-[10px] text-muted-foreground">4 strings</span>
                        </button>
                    </div>
                </div>
            </form>
            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button @click="submit">Create and open</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
