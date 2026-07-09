<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { ArrowLeft, Save } from "@lucide/vue";
import { getProvider } from "@/storage/session.ts";
import { basename } from "@/storage/paths.ts";
import { generalError, successMessage } from "@/app.ts";

const route = useRoute();
const router = useRouter();

const path = String(route.query.path ?? "");
const name = basename(path);

const text = ref("");
const original = ref("");
const loading = ref(true);
const saving = ref(false);
const dirty = computed(() => text.value !== original.value);

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

async function load() {
    const provider = getProvider();
    if (!provider || !path) {
        router.push("/");
        return;
    }
    try {
        const { bytes } = await provider.readTab(path);
        const content = decoder.decode(bytes);
        text.value = content;
        original.value = content;
    } catch (e) {
        generalError(e);
        router.push("/");
    } finally {
        loading.value = false;
    }
}

async function save() {
    const provider = getProvider();
    if (!provider || !dirty.value) return;
    saving.value = true;
    try {
        await provider.writeTab(path, encoder.encode(text.value));
        original.value = text.value;
        successMessage("Saved");
    } catch (e) {
        generalError(e);
    } finally {
        saving.value = false;
    }
}

function goBack() {
    if (dirty.value && !confirm("Discard unsaved changes?")) return;
    router.push("/");
}

function onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
    }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
    if (dirty.value) {
        e.preventDefault();
        e.returnValue = "";
    }
}

onBeforeRouteLeave(() => {
    if (dirty.value && !confirm("Discard unsaved changes?")) return false;
});

onMounted(() => {
    load();
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("beforeunload", onBeforeUnload);
});

onBeforeUnmount(() => {
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("beforeunload", onBeforeUnload);
});
</script>

<template>
    <div class="flex h-dvh flex-col bg-background text-foreground">
        <header class="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
            <button
                type="button"
                class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Back to library"
                @click="goBack"
            >
                <ArrowLeft class="size-5" />
            </button>
            <span class="min-w-0 flex-1 truncate text-sm font-medium" :title="name">{{ name }}</span>
            <span v-if="dirty" class="text-xs text-muted-foreground">Unsaved changes</span>
            <button
                type="button"
                class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
                :disabled="!dirty || saving"
                @click="save"
            >
                <Save class="size-4" />
                Save
            </button>
        </header>

        <div v-if="loading" class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading…
        </div>
        <textarea
            v-else
            v-model="text"
            spellcheck="false"
            class="flex-1 resize-none border-0 bg-background p-4 font-mono text-sm text-foreground outline-none"
        ></textarea>
    </div>
</template>
