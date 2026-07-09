<script setup lang="ts">
import { FilePlus, Upload } from "@lucide/vue";
import { Button } from "@/components/ui/button/index.ts";

defineProps<{
    /** True when this is the library root (wording differs from a subfolder). */
    isRoot: boolean;
}>();

const emit = defineEmits<{
    "new-tab": [];
    upload: [];
}>();
</script>

<template>
    <div class="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div class="relative mb-6 flex h-12 w-40 flex-col justify-between opacity-70" aria-hidden="true">
            <div v-for="i in 6" :key="i" class="h-px w-full bg-strings" />
        </div>
        <h2 class="mb-1 text-lg font-medium text-foreground">{{ isRoot ? "No tabs yet" : "This folder is empty" }}</h2>
        <p class="mb-6 max-w-sm text-sm text-muted-foreground">
            Create a new tab from a template, or drop files or folders anywhere on this page to import them.
        </p>
        <div class="flex flex-wrap items-center justify-center gap-2">
            <Button @click="emit('new-tab')">
                <FilePlus />
                New tab
            </Button>
            <Button variant="outline" @click="emit('upload')">
                <Upload />
                Upload files
            </Button>
        </div>
    </div>
</template>
