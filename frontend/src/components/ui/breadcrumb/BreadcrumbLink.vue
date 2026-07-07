<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { Primitive, type PrimitiveProps } from "reka-ui";
import { cn } from "@/lib/utils.ts";

const props = withDefaults(defineProps<PrimitiveProps & { class?: HTMLAttributes["class"] }>(), {
    as: "a",
});
</script>

<template>
    <Primitive
        :as="as"
        :as-child="asChild"
        :class="cn('cursor-pointer rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', props.class)"
    >
        <slot />
    </Primitive>
</template>
