<script setup lang="ts">
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button/index.ts";
import { Input } from "@/components/ui/input/index.ts";
import { Label } from "@/components/ui/label/index.ts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog/index.ts";

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
    create: [name: string];
}>();

const name = ref("");
const error = ref("");

watch(open, (v) => {
    if (v) {
        name.value = "";
        error.value = "";
    }
});

function submit() {
    const n = name.value.trim();
    if (!n) {
        error.value = "Enter a folder name.";
        return;
    }
    if (/[/\\]/.test(n)) {
        error.value = "Folder names can't contain slashes.";
        return;
    }
    open.value = false;
    emit("create", n);
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>New folder</DialogTitle>
                <DialogDescription>Create a folder inside the current location.</DialogDescription>
            </DialogHeader>
            <form class="grid gap-2" @submit.prevent="submit">
                <Label for="new-folder-name">Name</Label>
                <Input id="new-folder-name" v-model="name" autofocus placeholder="e.g. Rock" />
                <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
            </form>
            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button @click="submit">Create folder</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
