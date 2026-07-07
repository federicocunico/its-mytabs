<script setup lang="ts">
import { onMounted, ref } from "vue";
import { FolderOpen, RefreshCw } from "@lucide/vue";
import { setProvider } from "@/storage/session.ts";
import { openOpfs, pickLocalFolder, reconnectProvider, supportsFileSystemAccess } from "@/storage/select-provider.ts";
import { loadRootHandle } from "@/storage/handle-store.ts";
import { generalError } from "@/app.ts";
import { Button } from "@/components/ui/button/index.ts";

const supportsFsa = supportsFileSystemAccess();
const savedFolderName = ref("");

onMounted(async () => {
    if (!supportsFsa) {
        // Firefox/Safari: no directory picker — tabs live in private browser storage.
        try {
            setProvider(await openOpfs());
        } catch (e) {
            generalError(e);
        }
        return;
    }
    try {
        const handle = await loadRootHandle();
        if (handle) savedFolderName.value = handle.name;
    } catch {
        // No saved handle — plain onboarding.
    }
});

async function pick() {
    try {
        setProvider(await pickLocalFolder());
    } catch (e) {
        if ((e as { name?: string })?.name !== "AbortError") generalError(e);
    }
}

async function reconnect() {
    try {
        const p = await reconnectProvider();
        if (p) setProvider(p);
        else savedFolderName.value = "";
    } catch (e) {
        generalError(e);
    }
}

async function useBrowserStorage() {
    try {
        setProvider(await openOpfs());
    } catch (e) {
        generalError(e);
    }
}
</script>

<template>
    <div class="flex flex-1 items-center justify-center px-6 py-16">
        <div class="w-full max-w-md text-center">
            <!-- Six strings under a pick: the studio's empty stage -->
            <div class="relative mx-auto mb-8 flex h-16 w-48 flex-col justify-between" aria-hidden="true">
                <div v-for="i in 6" :key="i" class="h-px w-full bg-strings" />
                <span class="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 rotate-45 items-center justify-center rounded-[45%_45%_45%_0] bg-primary shadow-md" />
            </div>

            <h1 class="mb-2 font-serif text-3xl font-medium text-foreground">Your tabs, your folder</h1>
            <p class="mb-8 text-sm leading-relaxed text-muted-foreground">
                TabCraft Studio keeps your guitar tabs in a folder you choose — on your machine, under your control. Nothing is uploaded anywhere.
            </p>

            <template v-if="supportsFsa">
                <div v-if="savedFolderName" class="mb-6">
                    <Button size="lg" class="w-full" @click="reconnect">
                        <RefreshCw />
                        Reconnect to “{{ savedFolderName }}”
                    </Button>
                    <p class="mt-2 text-xs text-muted-foreground">Your browser needs permission again after a restart.</p>
                </div>
                <Button v-if="!savedFolderName" size="lg" class="w-full" @click="pick">
                    <FolderOpen />
                    Choose a folder
                </Button>
                <Button v-else variant="outline" class="mt-1 w-full" @click="pick">
                    <FolderOpen />
                    Choose a different folder
                </Button>
                <button
                    type="button"
                    class="mt-4 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    data-testid="use-browser-storage"
                    @click="useBrowserStorage"
                >
                    Use browser storage instead
                </button>
            </template>
            <p v-else class="text-sm text-muted-foreground">
                This browser can't open disk folders, so your tabs are stored privately inside the browser.
            </p>
        </div>
    </div>
</template>
