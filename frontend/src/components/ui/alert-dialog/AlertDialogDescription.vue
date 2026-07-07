<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { AlertDialogDescription, type AlertDialogDescriptionProps, useForwardProps } from "reka-ui";
import { computed } from "vue";
import { cn } from "@/lib/utils.ts";

const props = defineProps<AlertDialogDescriptionProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
    <AlertDialogDescription v-bind="forwarded" :class="cn('text-sm text-muted-foreground', props.class)">
        <slot />
    </AlertDialogDescription>
</template>
