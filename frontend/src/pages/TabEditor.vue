<script>
import { defineComponent } from "vue";
import { notify } from "@kyvg/vue3-notification";
import { BModal } from "bootstrap-vue-next";
import { baseURL, checkFetch, getSetting } from "../app.js";
import { getFileURL, getTempToken } from "../alphatab-shared.ts";
import { EditorController } from "../editor/EditorController.ts";
import { KeyboardController } from "../editor/keyboard-controller.ts";
import { KEYMAP } from "../editor/keymap.ts";
import { downloadGp, saveScoreToServer } from "../editor/persistence.ts";
import EditorToolbar from "../components/editor/EditorToolbar.vue";
import EditorStatusBar from "../components/editor/EditorStatusBar.vue";

const alphaTab = await import("@coderline/alphatab");

const DURATION_LABELS = {
    1: "Whole",
    2: "Half",
    4: "Quarter",
    8: "Eighth",
    16: "16th",
    32: "32nd",
    64: "64th",
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export default defineComponent({
    components: { EditorToolbar, EditorStatusBar, BModal },

    /** @type {alphaTab.AlphaTabApi} */
    api: null,

    /** @type {EditorController} */
    ctrl: null,

    /** @type {KeyboardController} */
    kb: null,

    overlayEl: null,
    renderScheduled: false,

    data() {
        return {
            tabID: -1,
            tab: {},
            trackIndex: 0,
            trackName: "",
            ready: false,
            playing: false,
            saving: false,
            midiDirty: false,
            showHelp: false,
            setting: {},
            keymap: KEYMAP,
            ui: {
                dirty: false,
                canUndo: false,
                canRedo: false,
                duration: 4,
                dots: 0,
                isRest: false,
                tie: false,
                playing: false,
                saving: false,
            },
            status: {
                barIndex: 0,
                barCount: 1,
                beatIndex: 0,
                stringLabel: "",
                pendingFret: "",
                durationLabel: "Quarter",
                dots: 0,
                isRest: false,
                fillUsed: 0,
                fillCapacity: 0,
            },
        };
    },

    computed: {
        keymapGroups() {
            const groups = {};
            for (const binding of this.keymap) {
                if (!groups[binding.group]) {
                    groups[binding.group] = [];
                }
                groups[binding.group].push(binding);
            }
            return groups;
        },
    },

    async mounted() {
        this.setting = getSetting();
        this.tabID = this.$route.params.id;

        const trackParam = new URLSearchParams(window.location.search).get("track");
        if (trackParam && !isNaN(parseInt(trackParam))) {
            this.trackIndex = parseInt(trackParam);
        }

        try {
            const res = await fetch(baseURL + `/api/tab/${this.tabID}`, { credentials: "include" });
            await checkFetch(res);
            const data = await res.json();
            this.tab = data.tab ?? {};

            const tempToken = await getTempToken(this.tabID);
            this.initContainer(tempToken);
        } catch (e) {
            if (e.message === "Not logged in") {
                this.$router.push("/login");
                return;
            }
            notify({ type: "error", title: "Error", text: e.message });
            return;
        }

        this.kb = new KeyboardController((command, arg) => this.dispatch(command, arg));
        this.kb.isBlocked = () => this.showHelp;
        this._onKeydown = (e) => {
            this.kb.handleKeydown(e);
            // Reflect the fret buffer in the status bar
            this.status.pendingFret = this.kb.pendingFret;
        };
        window.addEventListener("keydown", this._onKeydown);

        this._onBeforeUnload = (e) => {
            if (this.ctrl?.dirty) {
                e.preventDefault();
            }
        };
        window.addEventListener("beforeunload", this._onBeforeUnload);
    },

    beforeUnmount() {
        window.removeEventListener("keydown", this._onKeydown);
        window.removeEventListener("beforeunload", this._onBeforeUnload);
        if (this.api) {
            this.api.destroy();
            this.api = null;
        }
    },

    beforeRouteLeave(to, from, next) {
        if (this.ctrl?.dirty) {
            if (!window.confirm("You have unsaved changes. Leave without saving?")) {
                next(false);
                return;
            }
        }
        next();
    },

    methods: {
        initContainer(tempToken) {
            this.api = new alphaTab.AlphaTabApi(this.$refs.atContainer, {
                notation: {
                    rhythmMode: alphaTab.TabRhythmMode.ShowWithBars,
                    elements: {
                        scoreTitle: false,
                        scoreSubTitle: false,
                        scoreArtist: false,
                        scoreAlbum: false,
                        scoreWords: false,
                        scoreMusic: false,
                        scoreWordsAndMusic: false,
                        scoreCopyright: false,
                    },
                },
                core: {
                    file: getFileURL(this.tabID, tempToken),
                    fontDirectory: "/font/",
                    engine: "html5",
                    includeNoteBounds: true,
                },
                player: {
                    enablePlayer: true,
                    enableCursor: true,
                    enableUserInteraction: true,
                    soundFont: "/soundfont/sonivox.sf2",
                    scrollMode: alphaTab.ScrollMode.Off,
                    scrollOffsetY: -80,
                    playerMode: alphaTab.PlayerMode.EnabledSynthesizer,
                },
                display: {
                    // The editor always shows the tablature; honor a standard-notation preference on top.
                    staveProfile: this.setting.scoreStyle === "score" || this.setting.scoreStyle === "score-tab" ? alphaTab.StaveProfile.ScoreTab : alphaTab.StaveProfile.Tab,
                    scale: this.setting.scale ?? 1,
                },
            });

            window.editorApi = this.api;

            const host = {
                requestRender: () => this.scheduleRender(),
                onScoreReplaced: (score) => {
                    this.api.renderScore(score, [this.trackIndex]);
                },
                onStateChanged: () => this.refreshUi(),
            };
            this.ctrl = new EditorController(host);

            this.api.scoreLoaded.on((score) => {
                if (this.ctrl.score === score) {
                    return; // our own renderScore round-trip
                }
                if (this.trackIndex < 0 || this.trackIndex >= score.tracks.length) {
                    this.trackIndex = 0;
                }
                this.ctrl.attach(score, this.api.settings, this.trackIndex);
                this.trackName = score.tracks[this.trackIndex].name;
                this.api.renderTracks([score.tracks[this.trackIndex]]);
                this.ready = true;
            });

            this.api.postRenderFinished.on(() => {
                this.updateOverlay();
            });

            this.api.playerStateChanged.on((args) => {
                this.playing = args.state === 1;
                this.ui.playing = this.playing;
            });

            this.api.beatMouseDown.on((beat) => {
                if (this.playing || !this.ctrl) {
                    return;
                }
                this.ctrl.cursor.setFromBeat(beat);
                this.refreshUi();
            });

            this.api.noteMouseDown.on((note) => {
                if (this.playing || !this.ctrl) {
                    return;
                }
                this.ctrl.cursor.setFromBeat(note.beat);
                this.ctrl.cursor.pos.string = note.string;
                this.refreshUi();
            });
        },

        // ---- command dispatch (keyboard + toolbar share this) ----

        dispatch(command, arg) {
            if (!this.ctrl || !this.ready) {
                return;
            }

            // While playing, only transport commands are allowed
            if (this.playing && command !== "playPause" && command !== "escape") {
                return;
            }

            let result = null;
            switch (command) {
                case "setFret":
                    result = this.ctrl.setFretAtCursor(arg);
                    break;
                case "moveLeft":
                    this.ctrl.moveLeft();
                    break;
                case "moveRight":
                    this.ctrl.moveRight();
                    break;
                case "stringUp":
                    this.ctrl.moveStringUp();
                    break;
                case "stringDown":
                    this.ctrl.moveStringDown();
                    break;
                case "prevBar":
                    this.ctrl.moveBar(-1);
                    break;
                case "nextBar":
                    this.ctrl.moveBar(1);
                    break;
                case "barStart":
                    this.ctrl.cursor.toBarEdge("start");
                    this.refreshUi();
                    break;
                case "barEnd":
                    this.ctrl.cursor.toBarEdge("end");
                    this.refreshUi();
                    break;
                case "scoreStart":
                    this.ctrl.cursor.toScoreEdge("start");
                    this.refreshUi();
                    break;
                case "scoreEnd":
                    this.ctrl.cursor.toScoreEdge("end");
                    this.refreshUi();
                    break;
                case "deleteNote":
                    result = this.ctrl.deleteNoteAtCursor();
                    break;
                case "deleteBeat":
                    result = this.ctrl.deleteBeatAtCursor();
                    break;
                case "insertBeat":
                    result = this.ctrl.insertBeatAtCursor();
                    break;
                case "toggleRest":
                    result = this.ctrl.toggleRestAtCursor();
                    break;
                case "toggleTie":
                    result = this.ctrl.toggleTieAtCursor();
                    break;
                case "toggleDot":
                    result = this.ctrl.toggleDotAtCursor();
                    break;
                case "setDuration":
                    result = this.ctrl.setDurationAtCursor(arg);
                    break;
                case "durationLonger":
                    result = this.ctrl.stepDurationAtCursor(1);
                    break;
                case "durationShorter":
                    result = this.ctrl.stepDurationAtCursor(-1);
                    break;
                case "insertBar":
                    result = this.ctrl.insertBarAtCursor();
                    break;
                case "appendBar":
                    result = this.ctrl.appendBarAtEnd();
                    break;
                case "deleteBar":
                    result = this.deleteBarWithConfirm();
                    break;
                case "undo":
                    result = this.ctrl.undo();
                    break;
                case "redo":
                    result = this.ctrl.redo();
                    break;
                case "save":
                    this.save();
                    break;
                case "download":
                    this.download();
                    break;
                case "playPause":
                    this.playPause();
                    break;
                case "playFromBarStart":
                    this.playFromBarStart();
                    break;
                case "escape":
                    this.onEscape();
                    break;
                case "help":
                    this.showHelp = true;
                    break;
                case "exit":
                    this.$router.push(`/tab/${this.tabID}`);
                    break;
            }

            if (result && !result.ok && result.message) {
                notify({ type: "warn", text: result.message });
            }
        },

        deleteBarWithConfirm() {
            const r = this.ctrl.cursor.resolve();
            if (r && !r.bar.isRestOnly) {
                if (!window.confirm("Delete this bar and its notes?")) {
                    return null;
                }
            }
            return this.ctrl.deleteBarAtCursor();
        },

        // ---- rendering / overlay ----

        scheduleRender() {
            if (this.renderScheduled) {
                return;
            }
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.renderScheduled = false;
                if (this.api && this.ctrl) {
                    this.api.renderScore(this.ctrl.score, [this.trackIndex]);
                }
            });
        },

        refreshUi() {
            if (!this.ctrl) {
                return;
            }
            const cursor = this.ctrl.cursor;
            const r = cursor.resolve();

            this.ui.dirty = this.ctrl.dirty;
            this.ui.canUndo = this.ctrl.canUndo;
            this.ui.canRedo = this.ctrl.canRedo;
            this.ui.saving = this.saving;
            this.midiDirty = this.midiDirty || this.ctrl.dirty;

            this.status.barIndex = cursor.pos.barIndex;
            this.status.barCount = this.ctrl.score.masterBars.length;
            this.status.beatIndex = cursor.pos.beatIndex;

            if (r) {
                this.ui.duration = r.beat.duration;
                this.ui.dots = r.beat.dots;
                this.ui.isRest = r.beat.isRest;
                this.ui.tie = r.note ? r.note.isTieDestination : false;
                this.status.durationLabel = DURATION_LABELS[r.beat.duration] ?? String(r.beat.duration);
                this.status.dots = r.beat.dots;
                this.status.isRest = r.beat.isRest;

                const staff = r.bar.staff;
                const midi = staff.stringTuning.tunings[staff.tuning.length - cursor.pos.string];
                const name = NOTE_NAMES[midi % 12];
                // Show guitarist-style numbering: 1 = highest string
                const visualNumber = staff.tuning.length - cursor.pos.string + 1;
                this.status.stringLabel = `${visualNumber} (${name})`;
            }

            const fill = this.ctrl.barFill();
            if (fill) {
                this.status.fillUsed = fill.used;
                this.status.fillCapacity = fill.capacity;
            }

            // Notify only when the warning set actually changes (refreshUi runs on every cursor move)
            const warningsKey = JSON.stringify(this.ctrl.barWarnings);
            if (warningsKey !== this._lastWarningsKey) {
                this._lastWarningsKey = warningsKey;
                for (const warning of this.ctrl.barWarnings) {
                    notify({ type: "warn", text: `Bar ${warning.barIndex + 1} now has more beats than the time signature allows.` });
                }
            }

            this.updateOverlay();
        },

        updateOverlay() {
            if (!this.api || !this.ctrl || !this.ready) {
                return;
            }
            const lookup = this.api.renderer?.boundsLookup ?? this.api.boundsLookup;
            const r = this.ctrl.cursor.resolve();
            if (!lookup || !r) {
                return;
            }

            const beatBounds = lookup.findBeat(r.beat);
            if (!beatBounds) {
                this.hideOverlay();
                return;
            }

            const rect = beatBounds.visualBounds;
            const overlay = this.ensureOverlay();
            overlay.style.display = "block";
            overlay.style.left = `${rect.x - 3}px`;
            overlay.style.top = `${rect.y - 3}px`;
            overlay.style.width = `${rect.w + 6}px`;
            overlay.style.height = `${rect.h + 6}px`;

            // String caret: exact note bounds if a note exists on the cursor string,
            // otherwise interpolate evenly across the beat's height.
            const caret = this.ensureCaret();
            const staff = r.bar.staff;
            const stringCount = staff.tuning.length;
            let caretY = null;
            let caretX = rect.x;
            let caretW = rect.w;

            const noteBounds = r.note && beatBounds.notes ? beatBounds.notes.find((nb) => nb.note === r.note) : null;
            if (noteBounds) {
                caretY = noteBounds.noteHeadBounds.y + noteBounds.noteHeadBounds.h / 2;
                caretX = noteBounds.noteHeadBounds.x - 2;
                caretW = noteBounds.noteHeadBounds.w + 4;
            } else {
                // Even interpolation: string N of stringCount, model 1 = bottom line
                const fraction = (stringCount - this.ctrl.cursor.pos.string) / Math.max(1, stringCount - 1);
                caretY = rect.y + rect.h * fraction;
                caretW = Math.min(rect.w, 18);
            }

            caret.style.display = "block";
            caret.style.left = `${caretX}px`;
            caret.style.top = `${caretY - 7}px`;
            caret.style.width = `${caretW}px`;
            caret.style.height = "14px";
        },

        hideOverlay() {
            if (this.overlayEl) {
                this.overlayEl.style.display = "none";
            }
            if (this.caretEl) {
                this.caretEl.style.display = "none";
            }
        },

        ensureOverlay() {
            if (!this.overlayEl || !this.overlayEl.isConnected) {
                this.overlayEl = document.createElement("div");
                this.overlayEl.className = "editor-beat-cursor";
                this.$refs.atContainer.appendChild(this.overlayEl);
            }
            return this.overlayEl;
        },

        ensureCaret() {
            if (!this.caretEl || !this.caretEl.isConnected) {
                this.caretEl = document.createElement("div");
                this.caretEl.className = "editor-string-caret";
                this.$refs.atContainer.appendChild(this.caretEl);
            }
            return this.caretEl;
        },

        // ---- playback ----

        playPause() {
            if (this.playing) {
                this.api.pause();
                return;
            }
            if (this.midiDirty) {
                this.api.loadMidiForScore();
                this.midiDirty = false;
            }
            const r = this.ctrl.cursor.resolve();
            if (r) {
                this.api.tickPosition = r.beat.absolutePlaybackStart;
            }
            this.api.play();
        },

        playFromBarStart() {
            if (this.playing) {
                return;
            }
            this.ctrl.cursor.toBarEdge("start");
            this.refreshUi();
            this.playPause();
        },

        onEscape() {
            if (this.playing) {
                this.api.pause();
                return;
            }
            if (this.showHelp) {
                this.showHelp = false;
                return;
            }
            this.kb.clearFretBuffer();
            this.status.pendingFret = "";
        },

        // ---- persistence ----

        async save() {
            if (!this.ctrl.dirty || this.saving) {
                return;
            }

            const originalExt = (this.tab.filename ?? "").split(".").pop();
            if (originalExt && originalExt !== "gp" && !this._convertConfirmed) {
                if (!window.confirm("Saving converts this file to Guitar Pro (.gp) format. A backup of the original is kept on the server. Continue?")) {
                    return;
                }
                this._convertConfirmed = true;
            }

            this.saving = true;
            this.ui.saving = true;
            try {
                const bytes = this.ctrl.exportGp();
                await saveScoreToServer(baseURL, this.tabID, bytes);
                this.ctrl.markSaved();
                notify({ type: "success", text: "Saved" });
            } catch (e) {
                notify({ type: "error", title: "Save failed", text: e.message });
            } finally {
                this.saving = false;
                this.ui.saving = false;
            }
        },

        download() {
            const bytes = this.ctrl.exportGp();
            const name = [this.tab.artist, this.tab.title].filter(Boolean).join(" - ") || "tab";
            downloadGp(bytes, name);
        },
    },
});
</script>

<template>
    <div class="tab-editor">
        <EditorToolbar
            :state="ui"
            :title="tab.title || 'Untitled'"
            :trackName="trackName"
            @command="dispatch"
        />

        <div class="score-area">
            <div ref="atContainer" v-pre></div>
        </div>

        <EditorStatusBar :info="status" v-if="ready" />

        <BModal v-model="showHelp" title="Keyboard shortcuts" size="lg" ok-only>
            <div class="shortcuts">
                <div v-for="(bindings, group) in keymapGroups" :key="group" class="mb-3">
                    <h6>{{ group }}</h6>
                    <table class="table table-sm table-dark">
                        <tbody>
                            <tr v-for="b in bindings" :key="b.keyLabel + b.command">
                                <td class="key-label"><kbd>{{ b.keyLabel }}</kbd></td>
                                <td>{{ b.description }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p class="text-muted">Type digits to enter frets — two digits within a moment combine (1, 2 → 12).</p>
            </div>
        </BModal>
    </div>
</template>

<style lang="scss">
// Not scoped: the overlay elements are created programmatically inside the alphaTab container.
.tab-editor {
    .score-area {
        width: 95%;
        margin: 0 auto 60px auto;
        position: relative;
    }

    .editor-beat-cursor {
        position: absolute;
        display: none;
        border: 1px solid rgba(49, 49, 198, 0.9);
        background: rgba(49, 49, 198, 0.12);
        border-radius: 3px;
        pointer-events: none;
        z-index: 10;
    }

    .editor-string-caret {
        position: absolute;
        display: none;
        border: 1.5px solid #ffc107;
        background: rgba(255, 193, 7, 0.15);
        border-radius: 3px;
        pointer-events: none;
        z-index: 11;
    }

    .key-label {
        width: 160px;
    }
}
</style>
