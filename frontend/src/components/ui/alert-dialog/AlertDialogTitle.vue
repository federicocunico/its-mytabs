<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { AlertDialogTitle, type AlertDialogTitleProps, useForwardProps } from "reka-ui";
import { computed } from "vue";
import { cn } from "@/lib/utils.ts";

const props = defineProps<AlertDialogTitleProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
    <AlertDialogTitle v-bind="forwarded" :class="cn('text-lg font-semibold', props.class)">
        <slot />
    </AlertDialogTitle>
</template>
