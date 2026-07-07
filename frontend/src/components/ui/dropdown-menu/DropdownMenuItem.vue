<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { DropdownMenuItem, type DropdownMenuItemProps, useForwardProps } from "reka-ui";
import { computed } from "vue";
import { cn } from "@/lib/utils.ts";

const props = defineProps<DropdownMenuItemProps & { class?: HTMLAttributes["class"]; destructive?: boolean }>();

const delegatedProps = computed(() => {
    const { class: _, destructive: __, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
    <DropdownMenuItem
        v-bind="forwarded"
        :class="cn(
            'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
            props.destructive && 'text-destructive focus:bg-destructive/10 focus:text-destructive',
            props.class,
        )"
    >
        <slot />
    </DropdownMenuItem>
</template>
