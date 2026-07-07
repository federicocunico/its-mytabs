<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { ContextMenuContent, type ContextMenuContentEmits, type ContextMenuContentProps, ContextMenuPortal, useForwardPropsEmits } from "reka-ui";
import { computed } from "vue";
import { cn } from "@/lib/utils.ts";

const props = defineProps<ContextMenuContentProps & { class?: HTMLAttributes["class"] }>();
const emits = defineEmits<ContextMenuContentEmits>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
    <ContextMenuPortal>
        <ContextMenuContent
            v-bind="forwarded"
            :class="cn(
                'z-50 min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
                props.class,
            )"
        >
            <slot />
        </ContextMenuContent>
    </ContextMenuPortal>
</template>
