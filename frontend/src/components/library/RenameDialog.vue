<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { extname, stripExt } from "@/storage/paths.ts";
import { Button } from "@/components/ui/button/index.ts";
import { Input } from "@/components/ui/input/index.ts";
import { Label } from "@/components/ui/label/index.ts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog/index.ts";

const props = defineProps<{
    /** Current file/folder name (tabs include the extension). */
    currentName: string;
    isFolder: boolean;
}>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
    rename: [newName: string];
}>();

// Tabs keep their extension; the user edits only the stem.
const ext = computed(() => (props.isFolder ? "" : extname(props.currentName)));
const stem = ref("");
const error = ref("");

watch(open, (v) => {
    if (v) {
        stem.value = props.isFolder ? props.currentName : stripExt(props.currentName);
        error.value = "";
    }
});

function submit() {
    const n = stem.value.trim();
    if (!n) {
        error.value = "Enter a name.";
        return;
    }
    if (/[/\\]/.test(n)) {
        error.value = "Names can't contain slashes.";
        return;
    }
    const full = ext.value ? `${n}.${ext.value}` : n;
    open.value = false;
    if (full !== props.currentName) emit("rename", full);
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>Rename {{ isFolder ? "folder" : "tab" }}</DialogTitle>
                <DialogDescription>“{{ currentName }}” will be renamed on disk.</DialogDescription>
            </DialogHeader>
            <form class="grid gap-2" @submit.prevent="submit">
                <Label for="rename-input">New name</Label>
                <div class="flex items-center gap-2">
                    <Input id="rename-input" v-model="stem" autofocus />
                    <span v-if="ext" class="shrink-0 font-mono text-xs text-muted-foreground">.{{ ext }}</span>
                </div>
                <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
            </form>
            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button @click="submit">Rename</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
