<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { DropdownMenuLabel, type DropdownMenuLabelProps, useForwardProps } from "reka-ui";
import { computed } from "vue";
import { cn } from "@/lib/utils.ts";

const props = defineProps<DropdownMenuLabelProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
    <DropdownMenuLabel v-bind="forwarded" :class="cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', props.class)">
        <slot />
    </DropdownMenuLabel>
</template>
