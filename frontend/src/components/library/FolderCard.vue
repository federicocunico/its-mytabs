<script setup lang="ts">
import { ref } from "vue";
import { Folder, FolderInput, MoreVertical, Pencil, Trash2 } from "@lucide/vue";
import type { FolderEntry } from "@/storage/types.ts";
import { INTERNAL_DRAG_TYPE } from "./drag.ts";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu/index.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu/index.ts";

const props = defineProps<{
    folder: FolderEntry;
    view: "grid" | "list";
}>();

const emit = defineEmits<{
    open: [];
    rename: [];
    move: [];
    delete: [];
    /** An internal entry (tab or folder path) was dropped onto this folder. */
    "move-into": [path: string];
    /** OS files were dropped onto this folder. */
    "import-into": [files: FileList];
}>();

const dragOver = ref(false);

function onDragOver(e: DragEvent) {
    if (!e.dataTransfer) return;
    const types = e.dataTransfer.types;
    if (types.includes(INTERNAL_DRAG_TYPE) || types.includes("Files")) {
        e.preventDefault();
        dragOver.value = true;
    }
}

function onDrop(e: DragEvent) {
    dragOver.value = false;
    if (!e.dataTransfer) return;
    e.preventDefault();
    e.stopPropagation();
    const internal = e.dataTransfer.getData(INTERNAL_DRAG_TYPE);
    if (internal) {
        if (internal !== props.folder.path) emit("move-into", internal);
    } else if (e.dataTransfer.files.length) {
        emit("import-into", e.dataTransfer.files);
    }
}

function onDragStart(e: DragEvent) {
    e.dataTransfer?.setData(INTERNAL_DRAG_TYPE, props.folder.path);
}
</script>

<template>
    <ContextMenu>
        <ContextMenuTrigger as-child>
            <div
                class="group relative cursor-pointer rounded-lg border bg-card outline-none transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
                :class="[
                    dragOver ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-ring/40',
                    view === 'grid' ? 'flex items-center gap-3 p-3' : 'flex items-center gap-3 px-3 py-2',
                ]"
                role="button"
                tabindex="0"
                draggable="true"
                @click="emit('open')"
                @keydown.enter="emit('open')"
                @dragover="onDragOver"
                @dragleave="dragOver = false"
                @drop="onDrop"
                @dragstart="onDragStart"
            >
                <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Folder class="size-5" />
                </span>
                <span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground" :title="folder.name">{{ folder.name }}</span>

                <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                        <button
                            type="button"
                            class="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                            aria-label="Folder actions"
                            @click.stop
                        >
                            <MoreVertical class="size-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem @select="emit('open')"><Folder />Open</DropdownMenuItem>
                        <DropdownMenuItem @select="emit('rename')"><Pencil />Rename…</DropdownMenuItem>
                        <DropdownMenuItem @select="emit('move')"><FolderInput />Move to…</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive @select="emit('delete')"><Trash2 />Delete…</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
            <ContextMenuItem @select="emit('open')"><Folder />Open</ContextMenuItem>
            <ContextMenuItem @select="emit('rename')"><Pencil />Rename…</ContextMenuItem>
            <ContextMenuItem @select="emit('move')"><FolderInput />Move to…</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem destructive @select="emit('delete')"><Trash2 />Delete…</ContextMenuItem>
        </ContextMenuContent>
    </ContextMenu>
</template>
