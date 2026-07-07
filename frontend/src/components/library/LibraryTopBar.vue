<script setup lang="ts">
import { computed } from "vue";
import { FilePlus, FolderPlus, LayoutGrid, List, Plus, Search, Star, Upload } from "@lucide/vue";
import { Button } from "@/components/ui/button/index.ts";
import { Input } from "@/components/ui/input/index.ts";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb/index.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu/index.ts";

const props = defineProps<{
    dir: string;
    rootLabel: string;
    isFavorites?: boolean;
}>();

const emit = defineEmits<{
    navigate: [dir: string];
    "new-folder": [];
    "new-tab": [];
    upload: [];
}>();

const search = defineModel<string>("search", { default: "" });
const view = defineModel<"grid" | "list">("view", { default: "grid" });

const segments = computed(() => {
    if (!props.dir) return [];
    const parts = props.dir.split("/");
    return parts.map((name, i) => ({ name, path: parts.slice(0, i + 1).join("/") }));
});
</script>

<template>
    <div class="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-6">
            <!-- Location -->
            <div class="flex min-w-0 flex-1 items-center gap-2">
                <template v-if="isFavorites">
                    <Star class="size-4 shrink-0 text-muted-foreground" />
                    <span class="text-sm font-medium text-foreground">Favorites</span>
                </template>
                <Breadcrumb v-else class="min-w-0">
                    <BreadcrumbList class="flex-nowrap overflow-hidden">
                        <BreadcrumbItem class="shrink-0">
                            <BreadcrumbPage v-if="!segments.length">{{ rootLabel }}</BreadcrumbPage>
                            <BreadcrumbLink v-else @click="emit('navigate', '')">{{ rootLabel }}</BreadcrumbLink>
                        </BreadcrumbItem>
                        <template v-for="(seg, i) in segments" :key="seg.path">
                            <BreadcrumbSeparator />
                            <BreadcrumbItem class="min-w-0">
                                <BreadcrumbPage v-if="i === segments.length - 1" class="truncate">{{ seg.name }}</BreadcrumbPage>
                                <BreadcrumbLink v-else class="truncate" @click="emit('navigate', seg.path)">{{ seg.name }}</BreadcrumbLink>
                            </BreadcrumbItem>
                        </template>
                    </BreadcrumbList>
                </Breadcrumb>
            </div>

            <!-- Search -->
            <div class="relative order-last w-full sm:order-none sm:w-56">
                <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input v-model="search" type="search" placeholder="Search tabs" class="pl-8" />
            </div>

            <!-- View toggle -->
            <div class="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="View">
                <button
                    type="button"
                    class="rounded-[5px] p-1.5 transition-colors"
                    :class="view === 'grid' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'"
                    aria-label="Grid view"
                    title="Grid view"
                    @click="view = 'grid'"
                >
                    <LayoutGrid class="size-4" />
                </button>
                <button
                    type="button"
                    class="rounded-[5px] p-1.5 transition-colors"
                    :class="view === 'list' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'"
                    aria-label="List view"
                    title="List view"
                    @click="view = 'list'"
                >
                    <List class="size-4" />
                </button>
            </div>

            <!-- New -->
            <DropdownMenu v-if="!isFavorites">
                <DropdownMenuTrigger as-child>
                    <Button size="sm">
                        <Plus class="size-4" />
                        New
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem @select="emit('new-tab')">
                        <FilePlus />
                        New tab…
                    </DropdownMenuItem>
                    <DropdownMenuItem @select="emit('upload')">
                        <Upload />
                        Upload files…
                    </DropdownMenuItem>
                    <DropdownMenuItem @select="emit('new-folder')">
                        <FolderPlus />
                        New folder…
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    </div>
</template>
