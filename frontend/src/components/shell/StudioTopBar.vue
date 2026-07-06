<script>
import { defineComponent } from "vue";
import { BDropdown, BDropdownItem } from "bootstrap-vue-next";

/**
 * Studio top bar. Presentational: every action is emitted as a `command`
 * (handled by TabEditor.dispatch) or `back` (library navigation). Replaces the
 * old EditorToolbar and the player's <h1>/<h2> header.
 */
export default defineComponent({
    components: { BDropdown, BDropdownItem },
    props: {
        title: { type: String, default: "Untitled" },
        artist: { type: String, default: "" },
        keyBadge: { type: String, default: "" },
        tempo: { type: [Number, String], default: null },
        timeSignature: { type: String, default: "" },
        /** { dirty, canUndo, canRedo, saving } */
        state: { type: Object, required: true },
        mode: { type: String, default: "editor" },
        editDisabled: { type: Boolean, default: false },
        editDisabledTitle: { type: String, default: "" },
        /** Show the player-mode overflow menu (Details… etc.) — logged-in users only. */
        showDetails: { type: Boolean, default: false },
    },
    emits: ["command", "back", "switchMode"],
    methods: {
        command(name, arg) {
            this.$emit("command", name, arg);
        },
    },
});
</script>

<template>
    <div class="st-topbar">
        <button class="tb-icon" title="Back to library" @click="$emit('back')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 18l-6-6 6-6" />
            </svg>
        </button>

        <div class="tb-mark">
            <span class="tb-logo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" fill="#fff" />
                    <circle cx="18" cy="16" r="3" fill="#fff" />
                </svg>
            </span>
            <span class="tb-name">MyTabs<span class="tb-name-2">&#8202;Studio</span></span>
        </div>

        <div class="tb-sep"></div>

        <div class="tb-song">
            <span class="tb-title" :title="title">{{ title }}</span>
            <span class="tb-artist" :title="artist">{{ artist }}</span>
        </div>

        <div class="tb-badges">
            <span v-if="keyBadge" class="tb-badge">{{ keyBadge }}</span>
            <span v-if="tempo" class="tb-badge">&#9833; {{ tempo }}</span>
            <span v-if="timeSignature" class="tb-badge">{{ timeSignature }}</span>
        </div>

        <div class="tb-spacer"></div>

        <div class="tb-mode">
            <button
                type="button"
                class="tb-mode-btn"
                :class="{ active: mode === 'player' }"
                @click="$emit('switchMode', 'player')"
            >Player</button>
            <button
                type="button"
                class="tb-mode-btn"
                :class="{ active: mode === 'editor' }"
                :disabled="editDisabled"
                :title="editDisabled ? editDisabledTitle : 'Open score editor'"
                @click="$emit('switchMode', 'editor')"
            >Edit</button>
        </div>

        <template v-if="mode === 'editor'">
            <div class="tb-group">
                <button class="tb-icon" title="Undo (Ctrl+Z)" :disabled="!state.canUndo" @click="command('undo')">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 14L4 9l5-5" />
                        <path d="M4 9h11a6 6 0 0 1 0 12h-3" />
                    </svg>
                </button>
                <button class="tb-icon" title="Redo (Ctrl+Y)" :disabled="!state.canRedo" @click="command('redo')">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M15 14l5-5-5-5" />
                        <path d="M20 9H9a6 6 0 0 0 0 12h3" />
                    </svg>
                </button>
            </div>

            <button class="tb-save" :disabled="state.saving || !state.dirty" title="Save" @click="command('save')">
            <span v-if="state.saving" class="spinner-border spinner-border-sm" role="status"></span>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
            Save
            <span v-if="state.dirty" class="tb-dirty" title="Unsaved changes">●</span>
        </button>

            <BDropdown size="sm" variant="secondary" no-caret toggle-class="tb-more-toggle" end>
                <template #button-content>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.6" />
                        <circle cx="12" cy="12" r="1.6" />
                        <circle cx="12" cy="19" r="1.6" />
                    </svg>
                </template>
                <BDropdownItem @click="command('trackManager')">Tracks…</BDropdownItem>
                <BDropdownItem @click="command('download')">Download .gp (Ctrl+Shift+S)</BDropdownItem>
                <BDropdownItem @click="command('help')">Keyboard shortcuts (?)</BDropdownItem>
            </BDropdown>
        </template>

        <BDropdown v-if="mode === 'player' && showDetails" size="sm" variant="secondary" no-caret toggle-class="tb-more-toggle" end>
            <template #button-content>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="12" cy="19" r="1.6" />
                </svg>
            </template>
            <BDropdownItem @click="command('editDetails')">Tab details…</BDropdownItem>
            <BDropdownItem @click="command('editAudio')">Youtube &amp; audio files…</BDropdownItem>
        </BDropdown>
    </div>
</template>

<style lang="scss" scoped>
@import "../../styles/vars.scss";

.st-topbar {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-width: 0;
}

.tb-icon {
    width: 34px;
    height: 34px;
    flex: none;
    display: grid;
    place-items: center;
    border: 1px solid $st-border-2;
    border-radius: 8px;
    background: $st-panel-2;
    color: #aab4bf;
    cursor: pointer;

    &:hover:not(:disabled) {
        background: #232b34;
    }
    &:disabled {
        opacity: 0.4;
        cursor: default;
    }
}

.tb-mark {
    display: flex;
    align-items: center;
    gap: 9px;
    flex: none;

    .tb-logo {
        width: 26px;
        height: 26px;
        border-radius: 7px;
        background: linear-gradient(150deg, #5b6ef5, #8b5bf5);
        display: grid;
        place-items: center;
        box-shadow: 0 2px 8px rgba(91, 110, 245, 0.4);
    }
    .tb-name {
        font-weight: 700;
        letter-spacing: 0.2px;
        font-size: 14px;
        color: #eef2f6;
    }
    .tb-name-2 {
        color: $st-text-muted;
        font-weight: 500;
    }
}

.tb-sep {
    width: 1px;
    height: 24px;
    background: $st-border;
    flex: none;
}

.tb-song {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.15;

    .tb-title {
        font-weight: 600;
        font-size: 14px;
        color: #eef2f6;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .tb-artist {
        font-size: 12px;
        color: $st-text-muted;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
}

.tb-badges {
    display: flex;
    gap: 6px;
    flex: none;

    .tb-badge {
        font-family: $st-font-mono;
        font-size: 11px;
        font-weight: 600;
        color: #9fb0c0;
        background: $st-panel-2;
        border: 1px solid $st-border-2;
        border-radius: 6px;
        padding: 3px 8px;
        white-space: nowrap;
    }
}

.tb-spacer {
    flex: 1;
}

.tb-mode {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: $st-panel-2;
    border: 1px solid $st-border-2;
    border-radius: 8px;
    flex: none;
}

.tb-mode-btn {
    height: 28px;
    padding: 0 12px;
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
        opacity: 0.4;
        cursor: default;
    }
}

.tb-group {
    display: flex;
    gap: 5px;
    flex: none;
}

.tb-save {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border: none;
    border-radius: 8px;
    background: $st-play-green;
    color: #fff;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    flex: none;

    &:hover:not(:disabled) {
        background: #23ad5e;
    }
    &:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .tb-dirty {
        color: #d6f5e2;
        font-size: 10px;
    }
}

:deep(.tb-more-toggle) {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 1px solid $st-border-2;
    border-radius: 8px;
    background: $st-panel-2;
    color: #aab4bf;
    padding: 0;
}
</style>
