<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { type BadgeVariants, badgeVariants } from "./index.ts";
import { cn } from "@/lib/utils.ts";

const props = defineProps<{
    variant?: BadgeVariants["variant"];
    class?: HTMLAttributes["class"];
}>();
</script>

<template>
    <div :class="cn(badgeVariants({ variant }), props.class)">
        <slot />
    </div>
</template>
