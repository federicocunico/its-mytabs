<script setup lang="ts">
import { computed } from "vue";
import { Check } from "@lucide/vue";
import { TRACK_COLORS } from "@/styles/colors.ts";

/**
 * Track-colour picker body: a grid of preset swatches plus the browser-native
 * colour picker for a fully custom hex/RGB choice. Emits the chosen colour as a
 * "#rrggbb" hex string. Embedded directly in the Edit Track dialog and inside
 * ColorPickerPopover for the mixer's colour-bar shortcut.
 */
const props = defineProps<{ modelValue?: string | null }>();
const emit = defineEmits<{ select: [hex: string] }>();

/** Normalise a CSS colour ("#rrggbb" or "rgb(r, g, b)") to lowercase "#rrggbb". */
function toHex(css: string | null | undefined): string {
    if (!css) {
        return "#000000";
    }
    const s = css.trim();
    if (s.startsWith("#")) {
        return s.toLowerCase();
    }
    const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) {
        const h = (n: string) => Number(n).toString(16).padStart(2, "0");
        return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
    }
    return "#000000";
}

const currentHex = computed(() => toHex(props.modelValue));

function isActive(swatch: string): boolean {
    return swatch.toLowerCase() === currentHex.value;
}
</script>

<template>
    <div class="grid gap-3">
        <div class="grid grid-cols-6 gap-2">
            <button
                v-for="c in TRACK_COLORS"
                :key="c"
                type="button"
                class="flex size-7 items-center justify-center rounded-md border border-black/10 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :style="{ background: c }"
                :title="c"
                @click="emit('select', c)"
            >
                <Check v-if="isActive(c)" class="size-4 text-white drop-shadow" />
            </button>
        </div>
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
            <input
                type="color"
                class="size-7 cursor-pointer rounded-md border border-border bg-transparent p-0"
                :value="currentHex"
                @input="emit('select', ($event.target as HTMLInputElement).value)"
            />
            <span>Custom…</span>
        </label>
    </div>
</template>
