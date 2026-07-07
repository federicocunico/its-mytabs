<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { AlertDialogContent, type AlertDialogContentEmits, type AlertDialogContentProps, AlertDialogOverlay, AlertDialogPortal, useForwardPropsEmits } from "reka-ui";
import { computed } from "vue";
import { cn } from "@/lib/utils.ts";

const props = defineProps<AlertDialogContentProps & { class?: HTMLAttributes["class"] }>();
const emits = defineEmits<AlertDialogContentEmits>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
    <AlertDialogPortal>
        <AlertDialogOverlay
            class="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        />
        <AlertDialogContent
            v-bind="forwarded"
            :class="cn(
                'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-card p-6 text-card-foreground shadow-lg duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 sm:rounded-lg',
                props.class,
            )"
        >
            <slot />
        </AlertDialogContent>
    </AlertDialogPortal>
</template>
