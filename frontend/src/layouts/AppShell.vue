<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { Menu } from "@lucide/vue";
import AppSidebar from "@/components/library/AppSidebar.vue";
import BrandLockup from "@/components/BrandLockup.vue";

const route = useRoute();
const sidebarOpen = ref(false);
</script>

<template>
    <div class="flex min-h-dvh bg-background font-sans text-foreground antialiased">
        <!-- Mobile backdrop -->
        <div
            v-if="sidebarOpen"
            class="fixed inset-0 z-30 bg-black/50 md:hidden"
            @click="sidebarOpen = false"
        />

        <AppSidebar
            :class="[
                'fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-200 md:sticky md:top-0 md:h-dvh md:translate-x-0',
                sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            ]"
            @navigate="sidebarOpen = false"
        />

        <div class="flex min-w-0 flex-1 flex-col">
            <!-- Mobile top bar -->
            <header class="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 md:hidden">
                <button
                    type="button"
                    class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Open menu"
                    @click="sidebarOpen = true"
                >
                    <Menu class="size-5" />
                </button>
                <BrandLockup :size="26" />
            </header>

            <main class="flex min-w-0 flex-1 flex-col">
                <router-view :key="route.path" />
            </main>
        </div>
    </div>
</template>
