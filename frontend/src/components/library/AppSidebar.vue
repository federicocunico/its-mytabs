<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useRoute } from "vue-router";
import { Cloud, FolderOpen, HardDrive, Monitor, Moon, Music, Settings, Star, Sun } from "@lucide/vue";
import { getProvider, setProvider, subscribe } from "@/storage/session.ts";
import { pickLocalFolder, supportsFileSystemAccess } from "@/storage/select-provider.ts";
import { setTheme, type ThemePreference, themePreference } from "@/theme.ts";
import { generalError } from "@/app.ts";
import { Badge } from "@/components/ui/badge/index.ts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip/index.ts";
import BrandLockup from "@/components/BrandLockup.vue";

defineEmits<{ navigate: [] }>();

// @ts-ignore Injected by Vite define
const version: string = appVersion;

const route = useRoute();

const provider = ref(getProvider());
const off = subscribe(() => provider.value = getProvider());
onBeforeUnmount(off);

const supportsFsa = supportsFileSystemAccess();
const storageLabel = computed(() => provider.value?.capabilities.rootLabel ?? "");
const onDisk = computed(() => provider.value?.capabilities.canBrowseDisk ?? false);

async function changeFolder() {
    try {
        setProvider(await pickLocalFolder());
    } catch (e) {
        if ((e as { name?: string })?.name !== "AbortError") generalError(e);
    }
}

const navItems = [
    { name: "home", to: "/", label: "My Tabs", icon: Music },
    { name: "favorites", to: "/favorites", label: "Favorites", icon: Star },
    { name: "settings", to: "/settings", label: "Settings", icon: Settings },
];

const clouds = ["Dropbox", "OneDrive", "Google Drive"];

const themeChoices: { value: ThemePreference; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: "Light theme" },
    { value: "system", icon: Monitor, label: "Match system theme" },
    { value: "dark", icon: Moon, label: "Dark theme" },
];
</script>

<template>
    <aside class="flex flex-col border-r border-border bg-card">
        <!-- Brand -->
        <RouterLink to="/" class="flex items-center px-5 pb-4 pt-5" @click="$emit('navigate')">
            <BrandLockup :size="34" />
        </RouterLink>

        <!-- Navigation -->
        <nav class="flex flex-col gap-0.5 px-3" aria-label="Main">
            <RouterLink
                v-for="item in navItems"
                :key="item.name"
                :to="item.to"
                class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                :class="route.name === item.name
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'"
                @click="$emit('navigate')"
            >
                <component :is="item.icon" class="size-4 shrink-0" />
                {{ item.label }}
            </RouterLink>
        </nav>

        <!-- Storage source -->
        <div class="mt-6 px-3">
            <div class="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Storage</div>
            <div v-if="provider" class="flex items-center gap-3 rounded-md px-3 py-2 text-sm">
                <HardDrive v-if="onDisk" class="size-4 shrink-0 text-muted-foreground" />
                <Cloud v-else class="size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0 flex-1 truncate text-foreground" :title="storageLabel">{{ storageLabel }}</span>
            </div>
            <div v-else class="px-3 py-2 text-sm text-muted-foreground">Not connected</div>
            <button
                v-if="supportsFsa"
                type="button"
                class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                @click="changeFolder"
            >
                <FolderOpen class="size-4 shrink-0" />
                {{ provider ? "Change folder" : "Choose folder" }}
            </button>
        </div>

        <!-- Future cloud sources -->
        <div class="mt-6 px-3">
            <div class="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Connect to</div>
            <TooltipProvider :delay-duration="300">
                <Tooltip v-for="cloud in clouds" :key="cloud">
                    <TooltipTrigger as-child>
                        <div class="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground opacity-60" aria-disabled="true">
                            <Cloud class="size-4 shrink-0" />
                            <span class="flex-1">{{ cloud }}</span>
                            <Badge variant="secondary" class="text-[10px]">Soon</Badge>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">Cloud sync is coming soon</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>

        <!-- Footer: theme + meta -->
        <div class="mt-auto px-5 pb-5">
            <div class="mb-3 inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Theme">
                <button
                    v-for="choice in themeChoices"
                    :key="choice.value"
                    type="button"
                    class="rounded-[5px] p-1.5 transition-colors"
                    :class="themePreference === choice.value
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'"
                    :aria-label="choice.label"
                    :title="choice.label"
                    @click="setTheme(choice.value)"
                >
                    <component :is="choice.icon" class="size-4" />
                </button>
            </div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <span>v{{ version }}</span>
                <span aria-hidden="true">·</span>
                <a
                    href="https://github.com/louislam/its-mytabs"
                    target="_blank"
                    rel="noopener"
                    class="transition-colors hover:text-foreground"
                >GitHub</a>
            </div>
        </div>
    </aside>
</template>
