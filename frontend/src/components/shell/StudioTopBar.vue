<script>
import { defineComponent } from "vue";
import { Monitor, Moon, Sun } from "@lucide/vue";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu/index.ts";
import BrandLockup from "@/components/BrandLockup.vue";
import { setTheme, themePreference } from "@/theme.ts";

/**
 * Studio top bar. Presentational: every action is emitted as a `command`
 * (handled by TabEditor.dispatch) or `back` (library navigation). Replaces the
 * old EditorToolbar and the player's <h1>/<h2> header.
 */
export default defineComponent({
    components: { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, BrandLockup, Sun, Monitor, Moon },
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
        /** Editor visualization mode: "tab" | "score" | "score-tab". */
        viewMode: { type: String, default: "tab" },
        /** Whether per-string note colouring is on. */
        noteColorOn: { type: Boolean, default: false },
    },
    emits: ["command", "back", "switchMode", "setViewMode", "toggleNoteColor"],
    data() {
        return {
            viewModes: [
                { value: "tab", label: "Tab", title: "Tablature only" },
                { value: "score", label: "Score", title: "Standard notation only" },
                { value: "score-tab", label: "Score + Tab", title: "Standard notation and tablature" },
            ],
            themeChoices: [
                { value: "light", icon: "Sun", label: "Light theme" },
                { value: "system", icon: "Monitor", label: "Match system theme" },
                { value: "dark", icon: "Moon", label: "Dark theme" },
            ],
        };
    },
    computed: {
        themePref() {
            return themePreference.value;
        },
    },
    methods: {
        command(name, arg) {
            this.$emit("command", name, arg);
        },
        pickTheme(pref) {
            setTheme(pref);
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

        <BrandLockup :size="26" />

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

        <div class="tb-theme" role="group" aria-label="Theme">
            <button
                v-for="choice in themeChoices"
                :key="choice.value"
                type="button"
                class="tb-theme-btn"
                :class="{ active: themePref === choice.value }"
                :title="choice.label"
                :aria-label="choice.label"
                @click="pickTheme(choice.value)"
            >
                <component :is="choice.icon" :size="15" />
            </button>
        </div>

        <template v-if="mode === 'editor'">
            <div class="tb-view" role="group" aria-label="View mode">
                <button
                    v-for="opt in viewModes"
                    :key="opt.value"
                    type="button"
                    class="tb-view-btn"
                    :class="{ active: viewMode === opt.value }"
                    :title="opt.title"
                    @click="$emit('setViewMode', opt.value)"
                >{{ opt.label }}</button>
            </div>

            <button
                type="button"
                class="tb-toggle"
                :class="{ active: noteColorOn }"
                title="Colour notes by string"
                @click="$emit('toggleNoteColor', !noteColorOn)"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="13.5" cy="6.5" r="2.5" />
                    <circle cx="17.5" cy="10.5" r="2.5" />
                    <circle cx="8.5" cy="7.5" r="2.5" />
                    <circle cx="6.5" cy="12.5" r="2.5" />
                    <path d="M12 2a10 10 0 1 0 0 20 3 3 0 0 0 0-6h-1.5a2.5 2.5 0 0 1 0-5H12a4 4 0 0 0 0-8z" />
                </svg>
                Colors
            </button>

            <div class="tb-group">
                <button class="tb-icon" title="Keyboard shortcuts (?)" @click="command('help')">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                        <circle cx="12" cy="12" r="10" />
                    </svg>
                </button>
            </div>

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
            <span v-if="state.saving" class="tb-spin" role="status"></span>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
            Save
            <span v-if="state.dirty" class="tb-dirty" title="Unsaved changes">●</span>
        </button>

            <DropdownMenu>
                <DropdownMenuTrigger as-child>
                    <button type="button" class="tb-more-toggle" title="More">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="1.6" />
                            <circle cx="12" cy="12" r="1.6" />
                            <circle cx="12" cy="19" r="1.6" />
                        </svg>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem @select="command('trackManager')">Tracks…</DropdownMenuItem>
                    <DropdownMenuItem @select="command('download')">Download .gp (Ctrl+Shift+S)</DropdownMenuItem>
                    <DropdownMenuItem @select="command('help')">Keyboard shortcuts (?)</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </template>

        <DropdownMenu v-if="mode === 'player' && showDetails">
            <DropdownMenuTrigger as-child>
                <button type="button" class="tb-more-toggle" title="More">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.6" />
                        <circle cx="12" cy="12" r="1.6" />
                        <circle cx="12" cy="19" r="1.6" />
                    </svg>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem @select="command('editDetails')">Tab details…</DropdownMenuItem>
                <DropdownMenuItem @select="command('editAudio')">Youtube &amp; audio files…</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
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
    color: $st-text-muted;
    cursor: pointer;

    &:hover:not(:disabled) {
        background: $st-hover;
    }
    &:disabled {
        opacity: 0.4;
        cursor: default;
    }
}

.tb-theme {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: $st-panel-2;
    border: 1px solid $st-border-2;
    border-radius: 8px;
    flex: none;
}

.tb-theme-btn {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: $st-text-muted;
    cursor: pointer;

    &.active {
        background: $st-accent-soft;
        color: $st-accent;
    }
    &:hover:not(.active) {
        color: $st-text;
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
        color: $st-text-strong;
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
        color: $st-text;
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

.tb-view {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: $st-panel-2;
    border: 1px solid $st-border-2;
    border-radius: 8px;
    flex: none;
}

.tb-view-btn {
    height: 28px;
    padding: 0 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: $st-text-muted;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;

    &.active {
        background: $st-accent-soft;
        color: $st-accent;
    }
    &:hover:not(.active) {
        color: $st-text;
    }
}

.tb-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    border: 1px solid $st-border-2;
    border-radius: 8px;
    background: $st-panel-2;
    color: $st-text-muted;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    flex: none;

    &:hover {
        background: $st-hover;
        color: $st-text;
    }
    &.active {
        background: $st-accent-soft;
        border-color: $st-accent;
        color: $st-accent;
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

.tb-more-toggle {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 1px solid $st-border-2;
    border-radius: 8px;
    background: $st-panel-2;
    color: $st-text-muted;
    padding: 0;
    cursor: pointer;

    &:hover {
        background: $st-hover;
    }
}

.tb-spin {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: tb-spin 0.6s linear infinite;
}

@keyframes tb-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
