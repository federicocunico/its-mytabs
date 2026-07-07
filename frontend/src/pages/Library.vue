<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getProvider, subscribe } from "@/storage/session.ts";
import type { FolderEntry, StorageProvider, TabEntry } from "@/storage/types.ts";
import { extname, isScoreFile, joinPath, normalizeRelPath, stripExt } from "@/storage/paths.ts";
import { generalError, successMessage } from "@/app.ts";
import LibraryTopBar from "@/components/library/LibraryTopBar.vue";
import FolderCard from "@/components/library/FolderCard.vue";
import TabCard from "@/components/library/TabCard.vue";
import OnboardingScreen from "@/components/library/OnboardingScreen.vue";
import EmptyFolderState from "@/components/library/EmptyFolderState.vue";
import UploadOverlay from "@/components/library/UploadOverlay.vue";
import NewFolderDialog from "@/components/library/NewFolderDialog.vue";
import NewTabDialog, { type TabTemplate } from "@/components/library/NewTabDialog.vue";
import RenameDialog from "@/components/library/RenameDialog.vue";
import MoveDialog from "@/components/library/MoveDialog.vue";
import DeleteConfirm from "@/components/library/DeleteConfirm.vue";
import TabDetailsDialog from "@/components/library/TabDetailsDialog.vue";
import { Skeleton } from "@/components/ui/skeleton/index.ts";

const route = useRoute();
const router = useRouter();

const provider = ref<StorageProvider | null>(getProvider());
const off = subscribe(() => {
    provider.value = getProvider();
    refresh();
});
onBeforeUnmount(off);

const isFavorites = computed(() => route.meta.favorites === true);
const dir = computed(() => normalizeRelPath(String(route.query.dir ?? "")));

const folders = ref<FolderEntry[]>([]);
const tabs = ref<TabEntry[]>([]);
const loading = ref(false);
const search = ref("");

const VIEW_KEY = "tabcraft-view";
const view = ref<"grid" | "list">(localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid");
watch(view, (v) => localStorage.setItem(VIEW_KEY, v));

// Dialog state. Rename/move/delete work on either a tab or a folder.
type Target = { path: string; name: string; isFolder: boolean };
const newFolderOpen = ref(false);
const newTabOpen = ref(false);
const renameOpen = ref(false);
const moveOpen = ref(false);
const deleteOpen = ref(false);
const detailsOpen = ref(false);
const target = ref<Target>({ path: "", name: "", isFolder: false });
const detailsTab = ref<TabEntry | null>(null);

const uploadInput = ref<HTMLInputElement>();

async function refresh() {
    const p = provider.value;
    if (!p) return;
    loading.value = true;
    try {
        if (isFavorites.value) {
            folders.value = [];
            tabs.value = await collectFavorites(p);
        } else {
            const res = await p.listFolder(dir.value);
            folders.value = res.folders.toSorted((a, b) => a.name.localeCompare(b.name));
            tabs.value = res.tabs.toSorted((a, b) => a.title.localeCompare(b.title));
        }
    } catch (e) {
        generalError(e);
        folders.value = [];
        tabs.value = [];
    } finally {
        loading.value = false;
    }
}

/** Breadth-first walk collecting favorited tabs; capped to keep huge trees sane. */
async function collectFavorites(p: StorageProvider): Promise<TabEntry[]> {
    const favs: TabEntry[] = [];
    const queue: string[] = [""];
    let visited = 0;
    while (queue.length && visited < 300) {
        const d = queue.shift()!;
        visited++;
        const res = await p.listFolder(d);
        favs.push(...res.tabs.filter((t) => t.favorite));
        queue.push(...res.folders.map((f) => f.path));
    }
    return favs.toSorted((a, b) => a.title.localeCompare(b.title));
}

watch([dir, isFavorites], refresh, { immediate: true });

// Client-side filter of the current listing.
const q = computed(() => search.value.trim().toLowerCase());
const shownFolders = computed(() => q.value ? folders.value.filter((f) => f.name.toLowerCase().includes(q.value)) : folders.value);
const shownTabs = computed(() =>
    q.value
        ? tabs.value.filter((t) =>
            t.title.toLowerCase().includes(q.value) || t.artist.toLowerCase().includes(q.value) ||
            t.name.toLowerCase().includes(q.value)
        )
        : tabs.value
);
const isEmpty = computed(() => !loading.value && !folders.value.length && !tabs.value.length);
const noMatches = computed(() => !loading.value && !isEmpty.value && !shownFolders.value.length && !shownTabs.value.length);

// --- Navigation ---

function navigate(toDir: string) {
    router.push({ name: "home", query: toDir ? { dir: toDir } : {} });
}

function openTab(t: TabEntry) {
    router.push({ name: "editPath", query: { path: t.path } });
}

// --- Mutations (provider call → toast on error → refresh) ---

function setTarget(entry: TabEntry | FolderEntry, isFolder: boolean): Target {
    target.value = { path: entry.path, name: entry.name, isFolder };
    return target.value;
}

async function createFolder(name: string) {
    try {
        await provider.value!.createFolder(joinPath(dir.value, name));
        await refresh();
    } catch (e) {
        generalError(e);
    }
}

async function createTab(name: string, template: TabTemplate) {
    const p = provider.value!;
    try {
        const res = await fetch(`/templates/empty-${template}.gp`);
        if (!res.ok) throw new Error(`Template download failed (${res.status})`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const path = await freePath(p, dir.value, `${name}.gp`);
        await p.writeTab(path, bytes);
        await p.writeMeta(path, { title: name });
        router.push({ name: "editPath", query: { path } });
    } catch (e) {
        generalError(e);
    }
}

async function renameTarget(newName: string) {
    try {
        const t = target.value;
        const newPath = await provider.value!.rename(t.path, newName);
        // Auto-seeded titles (= old filename stem) follow the rename; custom
        // titles set via "Edit details" are kept.
        if (!t.isFolder) {
            const meta = await provider.value!.readMeta(newPath);
            if (!meta.title || meta.title === stripExt(t.name)) {
                await provider.value!.writeMeta(newPath, { title: stripExt(newName) });
            }
        }
        await refresh();
    } catch (e) {
        generalError(e);
    }
}

async function moveTarget(toFolder: string) {
    await moveEntry(target.value.path, toFolder);
}

async function moveEntry(path: string, toFolder: string) {
    try {
        await provider.value!.move(path, toFolder);
        successMessage("Moved");
        await refresh();
    } catch (e) {
        generalError(e);
    }
}

async function deleteTarget() {
    try {
        await provider.value!.remove(target.value.path);
        successMessage("Deleted");
        await refresh();
    } catch (e) {
        generalError(e);
    }
}

async function saveDetails(details: { title: string; artist: string }) {
    if (!detailsTab.value) return;
    try {
        await provider.value!.writeMeta(detailsTab.value.path, details);
        await refresh();
    } catch (e) {
        generalError(e);
    }
}

async function toggleFavorite(t: TabEntry) {
    try {
        await provider.value!.writeMeta(t.path, { favorite: !t.favorite });
        await refresh();
    } catch (e) {
        generalError(e);
    }
}

async function downloadTab(t: TabEntry) {
    try {
        const { bytes } = await provider.value!.readTab(t.path);
        const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
        const a = document.createElement("a");
        a.href = url;
        a.download = t.name;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        generalError(e);
    }
}

// --- Import / upload ---

/** First non-colliding path for `name` in `targetDir` (adds " (2)", " (3)", …). */
async function freePath(p: StorageProvider, targetDir: string, name: string): Promise<string> {
    let path = joinPath(targetDir, name);
    if (!(await p.exists(path))) return path;
    const base = stripExt(name);
    const ext = extname(name);
    for (let n = 2;; n++) {
        path = joinPath(targetDir, `${base} (${n})${ext ? "." + ext : ""}`);
        if (!(await p.exists(path))) return path;
    }
}

async function importFiles(files: FileList | File[], targetDir = dir.value) {
    const p = provider.value;
    if (!p || isFavorites.value) return;
    let imported = 0;
    let skipped = 0;
    for (const file of Array.from(files)) {
        if (!isScoreFile(file.name)) {
            skipped++;
            continue;
        }
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            await p.writeTab(await freePath(p, targetDir, file.name), bytes);
            imported++;
        } catch (e) {
            generalError(e);
        }
    }
    if (imported) successMessage(`Imported ${imported} ${imported === 1 ? "tab" : "tabs"}`);
    if (skipped) generalError(new Error(`${skipped} ${skipped === 1 ? "file is" : "files are"} not a supported tab format`));
    await refresh();
}

function onUploadPicked(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) importFiles(input.files);
    input.value = "";
}
</script>

<template>
    <OnboardingScreen v-if="!provider" />

    <template v-else>
        <LibraryTopBar
            v-model:search="search"
            v-model:view="view"
            :dir="dir"
            :root-label="provider.capabilities.rootLabel"
            :is-favorites="isFavorites"
            @navigate="navigate"
            @new-folder="newFolderOpen = true"
            @new-tab="newTabOpen = true"
            @upload="uploadInput?.click()"
        />

        <div class="flex flex-1 flex-col px-4 py-4 md:px-6">
            <!-- Loading skeletons -->
            <div v-if="loading" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                <Skeleton v-for="i in 8" :key="i" class="h-28 rounded-lg" />
            </div>

            <!-- Empty states -->
            <div v-else-if="isFavorites && isEmpty" class="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <p class="text-sm text-muted-foreground">No favorites yet — star a tab and it shows up here.</p>
            </div>
            <EmptyFolderState
                v-else-if="isEmpty"
                :is-root="!dir"
                @new-tab="newTabOpen = true"
                @upload="uploadInput?.click()"
            />
            <div v-else-if="noMatches" class="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <p class="text-sm text-muted-foreground">Nothing matches “{{ search }}”.</p>
            </div>

            <!-- Grid view -->
            <div v-else-if="view === 'grid'" class="grid grid-cols-2 content-start gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                <FolderCard
                    v-for="f in shownFolders"
                    :key="f.path"
                    :folder="f"
                    view="grid"
                    @open="navigate(f.path)"
                    @rename="setTarget(f, true) && (renameOpen = true)"
                    @move="setTarget(f, true) && (moveOpen = true)"
                    @delete="setTarget(f, true) && (deleteOpen = true)"
                    @move-into="(path) => moveEntry(path, f.path)"
                    @import-into="(files) => importFiles(files, f.path)"
                />
                <TabCard
                    v-for="t in shownTabs"
                    :key="t.path"
                    :tab="t"
                    view="grid"
                    @open="openTab(t)"
                    @favorite="toggleFavorite(t)"
                    @details="(detailsTab = t) && (detailsOpen = true)"
                    @rename="setTarget(t, false) && (renameOpen = true)"
                    @move="setTarget(t, false) && (moveOpen = true)"
                    @download="downloadTab(t)"
                    @delete="setTarget(t, false) && (deleteOpen = true)"
                />
            </div>

            <!-- List view -->
            <div v-else class="flex flex-col gap-0.5">
                <FolderCard
                    v-for="f in shownFolders"
                    :key="f.path"
                    :folder="f"
                    view="list"
                    @open="navigate(f.path)"
                    @rename="setTarget(f, true) && (renameOpen = true)"
                    @move="setTarget(f, true) && (moveOpen = true)"
                    @delete="setTarget(f, true) && (deleteOpen = true)"
                    @move-into="(path) => moveEntry(path, f.path)"
                    @import-into="(files) => importFiles(files, f.path)"
                />
                <TabCard
                    v-for="t in shownTabs"
                    :key="t.path"
                    :tab="t"
                    view="list"
                    @open="openTab(t)"
                    @favorite="toggleFavorite(t)"
                    @details="(detailsTab = t) && (detailsOpen = true)"
                    @rename="setTarget(t, false) && (renameOpen = true)"
                    @move="setTarget(t, false) && (moveOpen = true)"
                    @download="downloadTab(t)"
                    @delete="setTarget(t, false) && (deleteOpen = true)"
                />
            </div>
        </div>

        <!-- Hidden upload input -->
        <input
            ref="uploadInput"
            type="file"
            multiple
            accept=".gp,.gpx,.gp3,.gp4,.gp5,.musicxml,.capx"
            class="hidden"
            data-testid="upload-input"
            @change="onUploadPicked"
        />

        <UploadOverlay v-if="!isFavorites" @files="importFiles" />

        <!-- Dialogs -->
        <NewFolderDialog v-model:open="newFolderOpen" @create="createFolder" />
        <NewTabDialog v-model:open="newTabOpen" @create="createTab" />
        <RenameDialog
            v-model:open="renameOpen"
            :current-name="target.name"
            :is-folder="target.isFolder"
            @rename="renameTarget"
        />
        <MoveDialog
            v-model:open="moveOpen"
            :provider="provider"
            :source-path="target.path"
            :is-folder="target.isFolder"
            @move="moveTarget"
        />
        <DeleteConfirm
            v-model:open="deleteOpen"
            :name="target.name"
            :is-folder="target.isFolder"
            @confirm="deleteTarget"
        />
        <TabDetailsDialog v-model:open="detailsOpen" :tab="detailsTab" @save="saveDetails" />
    </template>
</template>
