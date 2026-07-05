<script>
import { defineComponent } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { BDropdown, BDropdownItem } from "bootstrap-vue-next";
import DurationPicker from "./DurationPicker.vue";

export default defineComponent({
    components: { FontAwesomeIcon, DurationPicker, BDropdown, BDropdownItem },
    props: {
        state: {
            type: Object,
            required: true,
        },
        title: {
            type: String,
            default: "",
        },
        trackName: {
            type: String,
            default: "",
        },
    },
    emits: ["command"],
    methods: {
        command(name, arg) {
            this.$emit("command", name, arg);
        },
    },
});
</script>

<template>
    <div class="editor-toolbar">
        <div class="row-main">
            <button class="btn btn-sm btn-secondary" title="Back to player" @click='command("exit")'>
                <font-awesome-icon :icon='["fas", "arrow-left"]' />
            </button>

            <span class="title" :title="trackName">{{ title }}<span class="dirty-dot" v-if="state.dirty" title="Unsaved changes">●</span></span>

            <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-secondary" title="Undo (Ctrl+Z)" :disabled="!state.canUndo" @click='command("undo")'>
                    <font-awesome-icon :icon='["fas", "rotate-left"]' />
                </button>
                <button class="btn btn-secondary" title="Redo (Ctrl+Y)" :disabled="!state.canRedo" @click='command("redo")'>
                    <font-awesome-icon :icon='["fas", "rotate-right"]' />
                </button>
            </div>

            <DurationPicker :duration="state.duration" :dots="state.dots" :disabled="state.playing" @command="command" />

            <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-secondary" title="Rest (R)" :class="{ active: state.isRest }" :disabled="state.playing" @click='command("toggleRest")'>𝄽</button>
                <button class="btn btn-secondary" title="Tie to previous note (L)" :class="{ active: state.tie }" :disabled="state.playing" @click='command("toggleTie")'>⌒</button>
            </div>

            <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-secondary" title="Insert bar before (Ctrl+Ins)" :disabled="state.playing" @click='command("insertBar")'>+Bar</button>
                <button class="btn btn-secondary" title="Delete bar (Ctrl+Del)" :disabled="state.playing" @click='command("deleteBar")'>−Bar</button>
                <button class="btn btn-secondary" title="Insert beat (Ins)" :disabled="state.playing" @click='command("insertBeat")'>+Beat</button>
            </div>

            <button class="btn btn-sm btn-primary" @click='command("playPause")'>
                <span v-if="!state.playing"><font-awesome-icon :icon='["fas", "play"]' /> Play</span>
                <span v-else><font-awesome-icon :icon='["fas", "pause"]' /> Pause</span>
            </button>

            <button class="btn btn-sm btn-success" :disabled="state.saving || !state.dirty" @click='command("save")'>
                <span v-if="state.saving" class="spinner-border spinner-border-sm me-1" role="status"></span>
                Save
            </button>

            <BDropdown size="sm" variant="secondary" no-caret toggle-class="btn-more" end>
                <template #button-content>
                    <font-awesome-icon :icon='["fas", "ellipsis-vertical"]' />
                </template>
                <BDropdownItem @click='command("download")'>Download .gp (Ctrl+Shift+S)</BDropdownItem>
                <BDropdownItem @click='command("help")'>Keyboard shortcuts (?)</BDropdownItem>
                <BDropdownItem @click='command("exit")'>Exit to player</BDropdownItem>
            </BDropdown>
        </div>
    </div>
</template>

<style scoped lang="scss">
.editor-toolbar {
    position: sticky;
    top: 0;
    z-index: 20;
    background-color: #101418;
    border-bottom: 1px solid #222;
    padding: 8px 15px;

    .row-main {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }

    .title {
        font-weight: bold;
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        .dirty-dot {
            color: #ffc107;
            margin-left: 6px;
        }
    }
}
</style>
