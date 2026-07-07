<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { AlertDialogCancel, type AlertDialogCancelProps, useForwardProps } from "reka-ui";
import { computed } from "vue";
import { buttonVariants } from "@/components/ui/button/index.ts";
import { cn } from "@/lib/utils.ts";

const props = defineProps<AlertDialogCancelProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
    <AlertDialogCancel v-bind="forwarded" :class="cn(buttonVariants({ variant: 'outline' }), props.class)">
        <slot />
    </AlertDialogCancel>
</template>
