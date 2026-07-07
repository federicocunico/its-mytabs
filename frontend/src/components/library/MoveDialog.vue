<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChevronRight, CornerLeftUp, Folder } from "@lucide/vue";
import type { FolderEntry, StorageProvider } from "@/storage/types.ts";
import { parentPath } from "@/storage/paths.ts";
import { generalError } from "@/app.ts";
import { Button } from "@/components/ui/button/index.ts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog/index.ts";

const props = defineProps<{
    provider: StorageProvider | null;
    /** Path of the entry being moved. */
    sourcePath: string;
    isFolder: boolean;
}>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
    move: [targetDir: string];
}>();

const browseDir = ref("");
const subfolders = ref<FolderEntry[]>([]);
const loading = ref(false);

const sourceParent = computed(() => parentPath(props.sourcePath));

watch(open, (v) => {
    if (v) {
        browseDir.value = sourceParent.value;
        load();
    }
});

async function load() {
    if (!props.provider) return;
    loading.value = true;
    try {
        const { folders } = await props.provider.listFolder(browseDir.value);
        subfolders.value = folders;
    } catch (e) {
        generalError(e);
        subfolders.value = [];
    } finally {
        loading.value = false;
    }
}

function enter(f: FolderEntry) {
    browseDir.value = f.path;
    load();
}

function up() {
    browseDir.value = parentPath(browseDir.value);
    load();
}

/** A folder can't be moved into itself or its own subtree. */
function isForbidden(path: string): boolean {
    return props.isFolder && (path === props.sourcePath || path.startsWith(props.sourcePath + "/"));
}

const canMoveHere = computed(() => browseDir.value !== sourceParent.value && !isForbidden(browseDir.value));

function submit() {
    open.value = false;
    emit("move", browseDir.value);
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Move to…</DialogTitle>
                <DialogDescription>Pick a destination folder.</DialogDescription>
            </DialogHeader>

            <div class="flex items-center gap-2 text-sm">
                <button
                    v-if="browseDir"
                    type="button"
                    class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Up one folder"
                    @click="up"
                >
                    <CornerLeftUp class="size-4" />
                </button>
                <span class="min-w-0 truncate font-mono text-xs text-muted-foreground">/{{ browseDir }}</span>
            </div>

            <div class="max-h-64 overflow-y-auto rounded-md border border-border">
                <p v-if="loading" class="px-3 py-4 text-sm text-muted-foreground">Loading…</p>
                <p v-else-if="!subfolders.length" class="px-3 py-4 text-sm text-muted-foreground">No subfolders here.</p>
                <button
                    v-for="f in subfolders"
                    v-else
                    :key="f.path"
                    type="button"
                    class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="isForbidden(f.path)"
                    @click="enter(f)"
                >
                    <Folder class="size-4 shrink-0 text-muted-foreground" />
                    <span class="min-w-0 flex-1 truncate">{{ f.name }}</span>
                    <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
                </button>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canMoveHere" @click="submit">Move here</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
