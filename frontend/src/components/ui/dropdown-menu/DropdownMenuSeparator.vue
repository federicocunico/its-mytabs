<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { DropdownMenuSeparator, type DropdownMenuSeparatorProps } from "reka-ui";
import { computed } from "vue";
import { cn } from "@/lib/utils.ts";

const props = defineProps<DropdownMenuSeparatorProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});
</script>

<template>
    <DropdownMenuSeparator v-bind="delegatedProps" :class="cn('-mx-1 my-1 h-px bg-border', props.class)" />
</template>
