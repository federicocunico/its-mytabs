<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { DropdownMenuContent, type DropdownMenuContentEmits, type DropdownMenuContentProps, DropdownMenuPortal, useForwardPropsEmits } from "reka-ui";
import { computed } from "vue";
import { cn } from "@/lib/utils.ts";

const props = withDefaults(defineProps<DropdownMenuContentProps & { class?: HTMLAttributes["class"] }>(), {
    sideOffset: 4,
});
const emits = defineEmits<DropdownMenuContentEmits>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
    <DropdownMenuPortal>
        <DropdownMenuContent
            v-bind="forwarded"
            :class="cn(
                'z-[1100] min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
                props.class,
            )"
        >
            <slot />
        </DropdownMenuContent>
    </DropdownMenuPortal>
</template>
