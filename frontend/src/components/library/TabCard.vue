<script setup lang="ts">
import { Download, FolderInput, Info, MoreVertical, Pencil, Play, Star, Trash2 } from "@lucide/vue";
import type { TabEntry } from "@/storage/types.ts";
import { INTERNAL_DRAG_TYPE } from "./drag.ts";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu/index.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu/index.ts";

const props = defineProps<{
    tab: TabEntry;
    view: "grid" | "list";
}>();

const emit = defineEmits<{
    open: [];
    favorite: [];
    rename: [];
    move: [];
    details: [];
    download: [];
    delete: [];
}>();

function onDragStart(e: DragEvent) {
    e.dataTransfer?.setData(INTERNAL_DRAG_TYPE, props.tab.path);
}
</script>

<template>
    <ContextMenu>
        <ContextMenuTrigger as-child>
            <!-- Grid card -->
            <div
                v-if="view === 'grid'"
                class="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-card p-4 outline-none transition-all hover:border-ring/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
                role="button"
                tabindex="0"
                draggable="true"
                @click="emit('open')"
                @keydown.enter="emit('open')"
                @dragstart="onDragStart"
            >
                <div class="mb-3 flex items-start justify-between gap-1">
                    <div class="min-w-0 flex-1">
                        <div class="truncate text-sm font-medium text-foreground" :title="tab.title">{{ tab.title }}</div>
                        <div class="truncate text-xs text-muted-foreground">{{ tab.artist || "Unknown artist" }}</div>
                    </div>
                    <button
                        type="button"
                        class="shrink-0 rounded-md p-1 transition-all focus-visible:opacity-100"
                        :class="tab.favorite
                            ? 'text-amber-400 opacity-100'
                            : 'text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100'"
                        :aria-label="tab.favorite ? 'Remove from favorites' : 'Add to favorites'"
                        :title="tab.favorite ? 'Remove from favorites' : 'Add to favorites'"
                        @click.stop="emit('favorite')"
                    >
                        <Star class="size-4" :fill="tab.favorite ? 'currentColor' : 'none'" />
                    </button>
                    <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                            <button
                                type="button"
                                class="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                                aria-label="Tab actions"
                                @click.stop
                            >
                                <MoreVertical class="size-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem @select="emit('open')"><Play />Open in editor</DropdownMenuItem>
                            <DropdownMenuItem @select="emit('details')"><Info />Edit details…</DropdownMenuItem>
                            <DropdownMenuItem @select="emit('rename')"><Pencil />Rename…</DropdownMenuItem>
                            <DropdownMenuItem @select="emit('move')"><FolderInput />Move to…</DropdownMenuItem>
                            <DropdownMenuItem @select="emit('download')"><Download />Download</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive @select="emit('delete')"><Trash2 />Delete…</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <!-- Six-string motif: the card's "fretboard" footer -->
                <div class="relative mt-auto flex h-8 flex-col justify-between pt-1" aria-hidden="true">
                    <div v-for="i in 6" :key="i" class="h-px w-full bg-strings" />
                    <span
                        class="absolute right-0 top-1/2 -translate-y-1/2 rounded bg-card px-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-border"
                    >.{{ tab.ext }}</span>
                </div>
            </div>

            <!-- List row -->
            <div
                v-else
                class="group flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
                role="button"
                tabindex="0"
                draggable="true"
                @click="emit('open')"
                @keydown.enter="emit('open')"
                @dragstart="onDragStart"
            >
                <span class="relative flex size-9 shrink-0 flex-col justify-between rounded-md bg-muted px-2 py-2" aria-hidden="true">
                    <span v-for="i in 4" :key="i" class="h-px w-full bg-strings" />
                </span>
                <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-foreground" :title="tab.title">{{ tab.title }}</span>
                    <span class="block truncate text-xs text-muted-foreground">{{ tab.artist || "Unknown artist" }}</span>
                </span>
                <span class="hidden shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">.{{ tab.ext }}</span>
                <button
                    type="button"
                    class="shrink-0 rounded-md p-1.5 transition-all focus-visible:opacity-100"
                    :class="tab.favorite
                        ? 'text-amber-400 opacity-100'
                        : 'text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100'"
                    :aria-label="tab.favorite ? 'Remove from favorites' : 'Add to favorites'"
                    @click.stop="emit('favorite')"
                >
                    <Star class="size-4" :fill="tab.favorite ? 'currentColor' : 'none'" />
                </button>
                <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                        <button
                            type="button"
                            class="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                            aria-label="Tab actions"
                            @click.stop
                        >
                            <MoreVertical class="size-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem @select="emit('open')"><Play />Open in editor</DropdownMenuItem>
                        <DropdownMenuItem @select="emit('details')"><Info />Edit details…</DropdownMenuItem>
                        <DropdownMenuItem @select="emit('rename')"><Pencil />Rename…</DropdownMenuItem>
                        <DropdownMenuItem @select="emit('move')"><FolderInput />Move to…</DropdownMenuItem>
                        <DropdownMenuItem @select="emit('download')"><Download />Download</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive @select="emit('delete')"><Trash2 />Delete…</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
            <ContextMenuItem @select="emit('open')"><Play />Open in editor</ContextMenuItem>
            <ContextMenuItem @select="emit('details')"><Info />Edit details…</ContextMenuItem>
            <ContextMenuItem @select="emit('rename')"><Pencil />Rename…</ContextMenuItem>
            <ContextMenuItem @select="emit('move')"><FolderInput />Move to…</ContextMenuItem>
            <ContextMenuItem @select="emit('download')"><Download />Download</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem destructive @select="emit('delete')"><Trash2 />Delete…</ContextMenuItem>
        </ContextMenuContent>
    </ContextMenu>
</template>
