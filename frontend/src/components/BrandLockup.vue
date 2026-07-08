<script setup lang="ts">
/**
 * The one brand lockup (icon + wordmark) shared by the library sidebar, the
 * mobile top bar and the studio top bar, so the mark is identical everywhere.
 * `compact` renders the icon only (for tight spots); `size` drives the icon and
 * the proportional gap/radius.
 */
withDefaults(defineProps<{ size?: number; compact?: boolean }>(), { size: 30, compact: false });
</script>

<template>
    <span class="brand" :style="{ gap: size * 0.32 + 'px' }">
        <img src="/icon.svg" alt="" :width="size" :height="size" :style="{ borderRadius: size * 0.29 + 'px' }" />
        <span v-if="!compact" class="brand-name">
            TabCraft<span class="brand-name-2"> Studio</span>
        </span>
    </span>
</template>

<style scoped lang="scss">
.brand {
    display: inline-flex;
    align-items: center;
}
.brand-name {
    font-weight: 700;
    font-size: 14px;
    color: var(--st-text-strong);
    letter-spacing: 0.2px;
    white-space: nowrap;
}
.brand-name-2 {
    font-weight: 500;
    color: var(--st-text-muted);
}
</style>
