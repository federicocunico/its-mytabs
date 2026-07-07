<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { Separator, type SeparatorProps } from "reka-ui";
import { computed } from "vue";
import { cn } from "@/lib/utils.ts";

const props = withDefaults(defineProps<SeparatorProps & { class?: HTMLAttributes["class"] }>(), {
    orientation: "horizontal",
    decorative: true,
});

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});
</script>

<template>
    <Separator
        v-bind="delegatedProps"
        :class="cn(
            'shrink-0 bg-border',
            props.orientation === 'vertical' ? 'h-full w-px' : 'h-px w-full',
            props.class,
        )"
    />
</template>
