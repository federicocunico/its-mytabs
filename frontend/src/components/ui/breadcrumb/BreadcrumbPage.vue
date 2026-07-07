<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils.ts";

const props = defineProps<{
    class?: HTMLAttributes["class"];
}>();
</script>

<template>
    <span role="link" aria-disabled="true" aria-current="page" :class="cn('font-medium text-foreground', props.class)">
        <slot />
    </span>
</template>
