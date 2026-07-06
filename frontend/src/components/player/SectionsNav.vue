<script>
import { defineComponent } from "vue";

/**
 * Player-mode left rail: section list, view toggle (tab vs score+tab), and
 * color-notes switch. Purely presentational — the Tab page maps events to
 * alphaTab navigation and existing scoreStyle / noteColor settings.
 */
export default defineComponent({
    props: {
        sections: { type: Array, default: () => [] },
        /** "tab" | "score-tab" */
        scoreStyle: { type: String, default: "tab" },
        noteColorOn: { type: Boolean, default: true },
        disabled: { type: Boolean, default: false },
    },
    emits: ["seekSection", "setScoreStyle", "toggleNoteColor"],
    methods: {
        rangeLabel(s) {
            const end = s.start + s.len - 1;
            return s.start === end ? `Bar ${s.start + 1}` : `Bars ${s.start + 1}–${end + 1}`;
        },
    },
});
</script>

<template>
    <div class="sections-nav">
        <div class="sn-head">Sections</div>

        <div v-if="sections.length" class="sn-list">
            <button
                v-for="(s, i) in sections"
                :key="i"
                type="button"
                class="sn-item"
                :disabled="disabled"
                @click="$emit('seekSection', s.start)"
            >
                <span class="sn-dot" :style="{ background: s.color }"></span>
                <span class="sn-meta">
                    <span class="sn-name">{{ s.name }}</span>
                    <span class="sn-range">{{ rangeLabel(s) }}</span>
                </span>
            </button>
        </div>
        <p v-else class="sn-empty">No sections in this score</p>

        <div class="sn-divider"></div>

        <div class="sn-block">
            <div class="sn-label">View</div>
            <div class="sn-seg">
                <button
                    type="button"
                    class="sn-seg-btn"
                    :class="{ active: scoreStyle === 'tab' || scoreStyle === 'horizontal-tab' }"
                    :disabled="disabled"
                    @click="$emit('setScoreStyle', 'tab')"
                >Tab</button>
                <button
                    type="button"
                    class="sn-seg-btn"
                    :class="{ active: scoreStyle === 'score-tab' }"
                    :disabled="disabled"
                    @click="$emit('setScoreStyle', 'score-tab')"
                >Score+Tab</button>
            </div>
        </div>

        <div class="sn-block sn-row">
            <span class="sn-label">Color notes</span>
            <label class="sn-switch">
                <input
                    type="checkbox"
                    :checked="noteColorOn"
                    :disabled="disabled"
                    @change="$emit('toggleNoteColor', $event.target.checked)"
                />
                <span class="sn-switch-ui"></span>
            </label>
        </div>
    </div>
</template>

<style scoped lang="scss">
@import "../../styles/vars.scss";

.sections-nav {
    padding: 44px 14px 20px;
    font-family: $st-font-ui;
}

.sn-head {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: $st-text-faint;
    margin-bottom: 10px;
}

.sn-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 42vh;
    overflow-y: auto;
}

.sn-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 10px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: $st-text;
    text-align: left;
    cursor: pointer;

    &:hover:not(:disabled) {
        background: $st-panel-2;
        border-color: $st-border;
    }
    &:disabled {
        opacity: 0.45;
        cursor: default;
    }
}

.sn-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
}

.sn-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.2;
}

.sn-name {
    font-size: 13px;
    font-weight: 600;
    color: #e6ebf1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sn-range {
    font-family: $st-font-mono;
    font-size: 10.5px;
    color: $st-text-muted;
}

.sn-empty {
    font-size: 12px;
    color: $st-text-muted;
    margin: 0 0 8px;
}

.sn-divider {
    height: 1px;
    background: $st-border;
    margin: 16px 0;
}

.sn-block {
    margin-bottom: 14px;
}

.sn-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: $st-text-faint;
    margin-bottom: 8px;
}

.sn-seg {
    display: flex;
    gap: 4px;
    padding: 3px;
    background: $st-panel-2;
    border: 1px solid $st-border;
    border-radius: 8px;
}

.sn-seg-btn {
    flex: 1;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: $st-text-muted;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;

    &.active {
        background: rgba(91, 110, 245, 0.15);
        color: $st-accent;
    }
    &:disabled {
        opacity: 0.45;
        cursor: default;
    }
}

.sn-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0;

    .sn-label {
        margin-bottom: 0;
    }
}

.sn-switch {
    position: relative;
    display: inline-block;
    width: 38px;
    height: 22px;
    cursor: pointer;

    input {
        opacity: 0;
        width: 0;
        height: 0;
    }
}

.sn-switch-ui {
    position: absolute;
    inset: 0;
    background: #2a323c;
    border-radius: 11px;
    transition: background 0.15s;

    &::before {
        content: "";
        position: absolute;
        width: 16px;
        height: 16px;
        left: 3px;
        top: 3px;
        background: #8b95a1;
        border-radius: 50%;
        transition: transform 0.15s, background 0.15s;
    }
}

.sn-switch input:checked + .sn-switch-ui {
    background: rgba(91, 110, 245, 0.35);

    &::before {
        transform: translateX(16px);
        background: $st-accent;
    }
}

.sn-switch input:disabled + .sn-switch-ui {
    opacity: 0.45;
    cursor: default;
}
</style>
