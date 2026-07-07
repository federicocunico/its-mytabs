<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { SelectIcon, SelectTrigger, type SelectTriggerProps, useForwardProps } from "reka-ui";
import { ChevronDown } from "@lucide/vue";
import { computed } from "vue";
import { cn } from "@/lib/utils.ts";

const props = defineProps<SelectTriggerProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
    <SelectTrigger
        v-bind="forwarded"
        :class="cn(
            'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate',
            props.class,
        )"
    >
        <slot />
        <SelectIcon as-child>
            <ChevronDown class="size-4 shrink-0 text-muted-foreground" />
        </SelectIcon>
    </SelectTrigger>
</template>
