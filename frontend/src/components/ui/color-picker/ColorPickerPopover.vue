<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import ColorSwatches from "./ColorSwatches.vue";

/**
 * A popover wrapper around ColorSwatches — used by the mixer's colour bar as a
 * quick per-track colour shortcut. The default slot is the trigger. Colour
 * changes apply live; the popover dismisses on outside-click or Escape (reka
 * default), which keeps swatch-clicking and the native picker's live drag both
 * working without special-casing the event source.
 */
defineProps<{ modelValue?: string | null }>();
const emit = defineEmits<{ select: [hex: string] }>();
</script>

<template>
    <PopoverRoot>
        <PopoverTrigger as-child>
            <slot />
        </PopoverTrigger>
        <PopoverPortal>
            <PopoverContent
                :side-offset="6"
                align="start"
                class="z-[1200] rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            >
                <ColorSwatches :model-value="modelValue" @select="(hex) => emit('select', hex)" />
            </PopoverContent>
        </PopoverPortal>
    </PopoverRoot>
</template>
