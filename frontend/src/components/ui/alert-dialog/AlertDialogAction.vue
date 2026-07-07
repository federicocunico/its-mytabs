<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { AlertDialogAction, type AlertDialogActionProps, useForwardProps } from "reka-ui";
import { computed } from "vue";
import { buttonVariants } from "@/components/ui/button/index.ts";
import { cn } from "@/lib/utils.ts";

const props = defineProps<AlertDialogActionProps & { class?: HTMLAttributes["class"]; destructive?: boolean }>();

const delegatedProps = computed(() => {
    const { class: _, destructive: __, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
    <AlertDialogAction
        v-bind="forwarded"
        :class="cn(buttonVariants({ variant: props.destructive ? 'destructive' : 'default' }), props.class)"
    >
        <slot />
    </AlertDialogAction>
</template>
