<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Upload } from "@lucide/vue";
import { collectDroppedFiles, type DroppedFile } from "@/storage/dropped-files.ts";

const emit = defineEmits<{
    files: [files: DroppedFile[]];
}>();

const active = ref(false);
let depth = 0;

function hasFiles(e: DragEvent): boolean {
    return !!e.dataTransfer?.types.includes("Files");
}

function onDragEnter(e: DragEvent) {
    if (!hasFiles(e)) return;
    depth++;
    active.value = true;
}

function onDragLeave(e: DragEvent) {
    if (!hasFiles(e)) return;
    if (depth > 0 && --depth === 0) active.value = false;
}

function onDragOver(e: DragEvent) {
    if (hasFiles(e)) e.preventDefault();
}

async function onDrop(e: DragEvent) {
    depth = 0;
    active.value = false;
    if (!hasFiles(e)) return;
    // Folder cards handle their own drops and stop propagation; anything that
    // reaches the window imports into the current folder.
    e.preventDefault();
    const dataTransfer = e.dataTransfer;
    if (!dataTransfer) return;
    const files = await collectDroppedFiles(dataTransfer);
    if (files.length) emit("files", files);
}

onMounted(() => {
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
});

onBeforeUnmount(() => {
    window.removeEventListener("dragenter", onDragEnter);
    window.removeEventListener("dragleave", onDragLeave);
    window.removeEventListener("dragover", onDragOver);
    window.removeEventListener("drop", onDrop);
});
</script>

<template>
    <Transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150"
        leave-to-class="opacity-0"
    >
        <div v-if="active" class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div class="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-card px-12 py-10 shadow-lg">
                <Upload class="size-8 text-primary" />
                <p class="text-sm font-medium text-foreground">Drop files or folders to import</p>
                <p class="text-xs text-muted-foreground">Guitar Pro files open in the editor; other files are stored in your library</p>
            </div>
        </div>
    </Transition>
</template>
