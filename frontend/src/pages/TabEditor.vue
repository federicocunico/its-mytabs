<script>
import { defineComponent } from "vue";
import { notify } from "@kyvg/vue3-notification";
import { BModal } from "bootstrap-vue-next";
import { baseURL, checkFetch, generalError, getSetting } from "../app.js";
import { getFileURL, getTempToken } from "../alphatab-shared.ts";
import { EditorController } from "../editor/EditorController.ts";
import { KeyboardController } from "../editor/keyboard-controller.ts";
import { KEYMAP } from "../editor/keymap.ts";
import { downloadGp, saveScoreToServer } from "../editor/persistence.ts";
import EditorToolbar from "../components/editor/EditorToolbar.vue";
import EditorStatusBar from "../components/editor/EditorStatusBar.vue";
import EditorSidebar from "../components/editor/EditorSidebar.vue";
import EditorTrackPanel from "../components/editor/EditorTrackPanel.vue";
import BendDialog from "../components/editor/BendDialog.vue";
import BarSettingsDialog from "../components/editor/BarSettingsDialog.vue";
import TrackManagerDialog from "../components/editor/TrackManagerDialog.vue";

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
    components: { EditorToolbar, EditorStatusBar, EditorSidebar, EditorTrackPanel, BendDialog, BarSettingsDialog, TrackManagerDialog, BModal },

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
            showBend: false,
            showBarSettings: false,
            showTracks: false,
            showLeaveModal: false,
            leavingTo: null,
            barSettingsInitial: {},
            trackList: [],
            // Bottom panel state; recomputed in refreshUi() (score isn't reactive)
            trackPanel: {
                tracks: [],
                currentIndex: 0,
                invalidBars: [],
            },
            fx: {
                hammer: false,
                palmMute: false,
                letRing: false,
                dead: false,
                ghost: false,
                staccato: false,
                vibrato: false,
                harmonic: false,
                accent: false,
                tremolo: false,
                grace: false,
                bend: false,
                slideShift: false,
                slideLegato: false,
                tap: false,
                trill: false,
            },
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
                voiceCount: 1,
                voiceIndex: 0,
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
        this.kb.isBlocked = () => this.showHelp || this.showBend || this.showBarSettings || this.showTracks || this.showLeaveModal;
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
        if (this.ctrl?.dirty && !this._forceLeave) {
            this.leavingTo = to.fullPath;
            this.showLeaveModal = true;
            next(false);
            return;
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

            // Surface player/render errors (failed worklet/soundfont load) as toasts.
            this.api.error.on((error) => {
                console.error("[alphaTab]", error);
                generalError(error instanceof Error ? error : new Error(String(error)));
            });

            const host = {
                requestRender: () => this.scheduleRender(),
                onScoreReplaced: (score) => {
                    // the controller's cursor owns the authoritative track index
                    this.applyBarValidationStyles();
                    this.api.renderScore(score, [this.ctrl.cursor.trackIndex]);
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
                this.applyBarValidationStyles();
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
                case "goToBar":
                    this.ctrl.moveToBar(arg);
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
                case "toggleHammer":
                    result = this.ctrl.toggleNoteEffectAtCursor("hammerPull");
                    break;
                case "togglePalmMute":
                    result = this.ctrl.toggleNoteEffectAtCursor("palmMute");
                    break;
                case "toggleLetRing":
                    result = this.ctrl.toggleNoteEffectAtCursor("letRing");
                    break;
                case "toggleDead":
                    result = this.ctrl.toggleNoteEffectAtCursor("dead");
                    break;
                case "toggleGhost":
                    result = this.ctrl.toggleNoteEffectAtCursor("ghost");
                    break;
                case "toggleStaccato":
                    result = this.ctrl.toggleNoteEffectAtCursor("staccato");
                    break;
                case "cycleVibrato":
                    result = this.ctrl.cycleNoteEffectAtCursor("vibrato");
                    break;
                case "cycleHarmonic":
                    result = this.ctrl.cycleNoteEffectAtCursor("harmonic");
                    break;
                case "cycleAccent":
                    result = this.ctrl.cycleNoteEffectAtCursor("accent");
                    break;
                case "cycleTremolo":
                    result = this.ctrl.cycleTremoloAtCursor();
                    break;
                case "toggleSlideShift":
                    result = this.ctrl.toggleSlideOutAtCursor(1); // SlideOutType.Shift
                    break;
                case "toggleSlideLegato":
                    result = this.ctrl.toggleSlideOutAtCursor(2); // SlideOutType.Legato
                    break;
                case "toggleTap":
                    result = this.ctrl.toggleTapAtCursor();
                    break;
                case "cycleGrace":
                    result = this.ctrl.cycleGraceAtCursor();
                    break;
                case "bendDialog": {
                    const r = this.ctrl.cursor.resolve();
                    if (!r?.note) {
                        notify({ type: "warn", text: "Place the cursor on a note first" });
                        break;
                    }
                    this.showBend = true;
                    break;
                }
                case "trillDialog":
                    result = this.trillPrompt();
                    break;
                case "barSettings":
                    this.openBarSettings();
                    break;
                case "trackManager":
                    this.openTrackManager();
                    break;
                case "setVoice":
                    this.ctrl.setVoice(arg);
                    break;
                case "copyBeat":
                    result = this.ctrl.copyBeatAtCursor();
                    break;
                case "cutBeat":
                    result = this.ctrl.cutBeatAtCursor();
                    break;
                case "pasteBeat":
                    result = this.ctrl.pasteBeatAtCursor();
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

        trillPrompt() {
            const r = this.ctrl.cursor.resolve();
            if (!r?.note) {
                return { ok: false, message: "No note at cursor" };
            }
            if (r.note.trillValue > 0) {
                return this.ctrl.applyNoteEffectAtCursor({ kind: "clearTrill" });
            }
            const input = window.prompt("Trill with fret:", String(r.note.fret + 2));
            if (input === null) {
                return null;
            }
            const fret = parseInt(input);
            if (isNaN(fret)) {
                return { ok: false, message: "Invalid fret" };
            }
            return this.ctrl.applyNoteEffectAtCursor({ kind: "trill", fret, speed: 16 });
        },

        applyBendPreset(preset) {
            const result = this.ctrl.applyNoteEffectAtCursor({ kind: "bend", type: preset.type, points: preset.points });
            if (!result.ok && result.message) {
                notify({ type: "warn", text: result.message });
            }
        },

        openBarSettings() {
            const r = this.ctrl.cursor.resolve();
            if (!r) {
                return;
            }
            const masterBar = r.bar.masterBar;
            this.barSettingsInitial = {
                tsNumerator: masterBar.timeSignatureNumerator,
                tsDenominator: masterBar.timeSignatureDenominator,
                tsFollowing: false,
                tempo: masterBar.tempoAutomations[0] ? Math.round(masterBar.tempoAutomations[0].value) : null,
                key: r.bar.keySignature,
                keyType: r.bar.keySignatureType,
                repeatStart: masterBar.isRepeatStart,
                repeatCount: masterBar.repeatCount,
                tripletFeel: masterBar.tripletFeel,
                section: masterBar.section ? masterBar.section.text : "",
            };
            this.showBarSettings = true;
        },

        applyBarSettings(form) {
            const initial = form.initial;
            const results = [];

            if (form.tsNumerator !== initial.tsNumerator || form.tsDenominator !== initial.tsDenominator || form.tsFollowing) {
                results.push(this.ctrl.setTimeSignatureAtCursor(form.tsNumerator, form.tsDenominator, form.tsFollowing));
            }
            if (form.tempo != null && form.tempo !== "" && form.tempo !== initial.tempo) {
                results.push(this.ctrl.setTempoAtCursor(form.tempo));
            }
            if (form.key !== initial.key || form.keyType !== initial.keyType) {
                results.push(this.ctrl.setKeySignatureAtCursor(form.key, form.keyType, false));
            }
            if (form.repeatStart !== initial.repeatStart || form.repeatCount !== initial.repeatCount) {
                results.push(this.ctrl.setRepeatAtCursor({ start: form.repeatStart, count: form.repeatCount }));
            }
            if (form.tripletFeel !== initial.tripletFeel) {
                results.push(this.ctrl.setTripletFeelAtCursor(form.tripletFeel));
            }
            if ((form.section ?? "") !== initial.section) {
                results.push(this.ctrl.setSectionAtCursor(form.section || null));
            }

            for (const result of results) {
                if (result && !result.ok && result.message) {
                    notify({ type: "warn", text: result.message });
                }
            }
        },

        openTrackManager() {
            this.trackList = this.ctrl.score.tracks.map((t) => ({
                name: t.name,
                strings: t.staves[0]?.tuning.length ?? 0,
            }));
            this.showTracks = true;
        },

        switchTrack(index) {
            this.ctrl.changeTrack(index);
            this.trackIndex = index;
            this.trackName = this.ctrl.score.tracks[index].name;
            this.showTracks = false;
        },

        addTrack(template) {
            const result = this.ctrl.addTrackToScore(template);
            if (!result.ok && result.message) {
                notify({ type: "warn", text: result.message });
                return;
            }
            this.switchTrack(this.ctrl.score.tracks.length - 1);
        },

        removeTrack(index) {
            if (!window.confirm(`Remove track "${this.ctrl.score.tracks[index].name}" and all of its notes?`)) {
                return;
            }
            const result = this.ctrl.removeTrackFromScore(index);
            if (!result.ok && result.message) {
                notify({ type: "warn", text: result.message });
                return;
            }
            this.trackIndex = this.ctrl.cursor.trackIndex;
            this.trackName = this.ctrl.score.tracks[this.trackIndex].name;
            this.openTrackManager();
        },

        retune(payload) {
            const result = this.ctrl.setTuningForCurrentTrack(payload.tuning, payload.capo);
            if (!result.ok && result.message) {
                notify({ type: "warn", text: result.message });
            } else {
                this.showTracks = false;
            }
        },

        deleteBarWithConfirm() {
            if (!this.ctrl.cursorBarIsRestOnly()) {
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
                    this.applyBarValidationStyles();
                    this.api.renderScore(this.ctrl.score, [this.ctrl.cursor.trackIndex]);
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
                this.ui.voiceCount = r.bar.voices.length;
                this.ui.voiceIndex = cursor.pos.voiceIndex;
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

            // Effect states for the palette
            const note = r?.note ?? null;
            const beat = r?.beat ?? null;
            this.fx.hammer = !!note?.isHammerPullOrigin;
            this.fx.palmMute = !!note?.isPalmMute;
            this.fx.letRing = !!note?.isLetRing;
            this.fx.dead = !!note?.isDead;
            this.fx.ghost = !!note?.isGhost;
            this.fx.staccato = !!note?.isStaccato;
            this.fx.vibrato = (note?.vibrato ?? 0) !== 0;
            this.fx.harmonic = (note?.harmonicType ?? 0) !== 0;
            this.fx.accent = (note?.accentuated ?? 0) !== 0;
            this.fx.bend = (note?.bendType ?? 0) !== 0;
            this.fx.slideShift = note?.slideOutType === 1;
            this.fx.slideLegato = note?.slideOutType === 2;
            this.fx.trill = (note?.trillValue ?? -1) > 0;
            this.fx.tap = !!beat?.tap;
            this.fx.tremolo = beat?.tremoloSpeed != null;
            this.fx.grace = (beat?.graceType ?? 0) !== 0;

            const fill = this.ctrl.barFill();
            if (fill) {
                this.status.fillUsed = fill.used;
                this.status.fillCapacity = fill.capacity;
            }

            this.refreshTrackPanel();
            this.updateOverlay();
        },

        /** Recompute the bottom panel's plain data (the live score is not reactive). */
        refreshTrackPanel() {
            this.trackPanel.tracks = this.ctrl.score.tracks.map((t, i) => ({
                index: i,
                // Files often carry empty track names — fall back to something identifying
                name: t.name || t.shortName || `Track ${i + 1}`,
                strings: t.staves[0]?.tuning.length ?? 0,
            }));
            this.trackPanel.currentIndex = this.ctrl.cursor.trackIndex;
            this.trackPanel.invalidBars = this.ctrl.invalidBars.map((b) => b.barIndex);
        },

        /** Paint invalid bars' numbers red via alphaTab's style API (must run BEFORE a render). */
        applyBarValidationStyles() {
            const staff = this.ctrl.score.tracks[this.ctrl.cursor.trackIndex]?.staves[this.ctrl.cursor.staffIndex];
            if (!staff) {
                return;
            }
            const invalid = new Set(this.ctrl.invalidBars.map((b) => b.barIndex));
            const red = alphaTab.model.Color.fromJson("#dc3545");

            for (const bar of staff.bars) {
                if (invalid.has(bar.index)) {
                    const style = new alphaTab.model.BarStyle();
                    style.colors.set(alphaTab.model.BarSubElement.StandardNotationBarNumber, red);
                    style.colors.set(alphaTab.model.BarSubElement.GuitarTabsBarNumber, red);
                    bar.style = style;
                } else if (bar.style) {
                    bar.style = undefined;
                }
            }
        },

        /** Translucent red tint over each invalid bar (positioned AFTER a render). */
        updateInvalidBarOverlays() {
            const lookup = this.api?.boundsLookup;
            const invalid = this.ctrl?.invalidBars ?? [];
            const els = this.invalidBarEls ?? (this.invalidBarEls = []);

            while (els.length < invalid.length) {
                const el = document.createElement("div");
                el.className = "editor-invalid-bar";
                this.$refs.atContainer.appendChild(el);
                els.push(el);
            }

            els.forEach((el, i) => {
                if (!el.isConnected) {
                    this.$refs.atContainer.appendChild(el);
                }
                const entry = invalid[i];
                const bounds = entry !== undefined && lookup ? lookup.findMasterBarByIndex(entry.barIndex) : null;
                if (!bounds) {
                    el.style.display = "none";
                    return;
                }
                const rect = bounds.visualBounds;
                el.style.display = "block";
                el.style.left = `${rect.x}px`;
                el.style.top = `${rect.y}px`;
                el.style.width = `${rect.w}px`;
                el.style.height = `${rect.h}px`;
            });
        },

        updateOverlay() {
            if (!this.api || !this.ctrl || !this.ready) {
                return;
            }
            const lookup = this.api.renderer?.boundsLookup ?? this.api.boundsLookup;
            this.updateInvalidBarOverlays();
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

        /**
         * alphaTab 1.8.0's AlphaSynthWebWorkerApi has a self-recursive
         * `loadedMidiInfo` getter; `api.midiLoaded.on()` replays the "current"
         * value through it on subscribe and overflows the stack. Probe once and
         * repair the prototype getter when the bug is present.
         */
        workAroundLoadedMidiInfoBug() {
            if (this._midiInfoBugChecked) {
                return;
            }
            const player = this.api.player;
            const instance = player?.instance;
            if (!instance) {
                return; // player not initialized yet — probe again on the next play
            }
            this._midiInfoBugChecked = true;
            try {
                void player.loadedMidiInfo;
            } catch {
                Object.defineProperty(Object.getPrototypeOf(instance), "loadedMidiInfo", {
                    configurable: true,
                    get() {
                        return this._loadedMidiInfo;
                    },
                });
            }
        },

        playPause() {
            if (this.playing) {
                this.api.pause();
                return;
            }
            const startPlayback = () => {
                const r = this.ctrl.cursor.resolve();
                if (r) {
                    this.api.tickPosition = r.beat.absolutePlaybackStart;
                }
                this.api.play();
            };
            if (this.midiDirty) {
                // loadMidiForScore() rebuilds the MIDI asynchronously in the
                // worker; setting tickPosition before it finishes gets clobbered
                // and playback resumes from the stale previous position.
                this.workAroundLoadedMidiInfoBug();
                // midiLoaded replays the PREVIOUS load synchronously on
                // subscribe — arm the handler only for the upcoming one.
                let armed = false;
                const unsubscribe = this.api.midiLoaded.on(() => {
                    if (!armed) {
                        return;
                    }
                    armed = false;
                    unsubscribe();
                    startPlayback();
                });
                armed = true;
                this.api.loadMidiForScore();
                this.midiDirty = false;
                return;
            }
            startPlayback();
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

        // ---- leave guard (three-way modal) ----

        async leaveWithSave() {
            await this.save();
            if (this.ctrl.dirty) {
                // Save failed (already notified) — stay on the page.
                return;
            }
            this.showLeaveModal = false;
            this._forceLeave = true;
            this.$router.push(this.leavingTo);
        },

        leaveWithDiscard() {
            this.showLeaveModal = false;
            this._forceLeave = true;
            this.$router.push(this.leavingTo);
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

        <div class="editor-main">
            <EditorSidebar v-if="ready" :ui="ui" :fx="fx" :disabled="playing || !ready" @command="dispatch" />
            <div class="score-area">
                <div ref="atContainer" v-pre></div>
            </div>
        </div>

        <div class="editor-bottom" v-if="ready">
            <EditorTrackPanel
                :tracks="trackPanel.tracks"
                :currentIndex="trackPanel.currentIndex"
                :barIndex="status.barIndex"
                :barCount="status.barCount"
                :invalidBars="trackPanel.invalidBars"
                :disabled="playing"
                @switchTrack="switchTrack"
                @openTrackManager="openTrackManager"
                @goToBar="dispatch('goToBar', $event)"
            />
            <EditorStatusBar :info="status" />
        </div>

        <BModal v-model="showLeaveModal" title="Unsaved changes">
            <p>You have unsaved changes. What do you want to do?</p>
            <template #footer>
                <button class="btn btn-success" :disabled="saving" @click="leaveWithSave">
                    <span v-if="saving" class="spinner-border spinner-border-sm me-1" role="status"></span>
                    Save &amp; leave
                </button>
                <button class="btn btn-danger" :disabled="saving" @click="leaveWithDiscard">Discard changes</button>
                <button class="btn btn-secondary" :disabled="saving" @click="showLeaveModal = false">Cancel</button>
            </template>
        </BModal>

        <BendDialog v-model="showBend" @apply="applyBendPreset" />
        <BarSettingsDialog v-model="showBarSettings" :initial="barSettingsInitial" @apply="applyBarSettings" />
        <TrackManagerDialog
            v-model="showTracks"
            :tracks="trackList"
            :currentIndex="trackIndex"
            @switchTrack="switchTrack"
            @addTrack="addTrack"
            @removeTrack="removeTrack"
            @retune="retune"
        />

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
                <p
                    class="text-muted">Type digits (0–9) or numpad digits (NumLock on) to enter frets — two digits within a moment combine (1, 2 → 12). Use ↑/↓ to move between strings on the same beat.</p>
            </div>
        </BModal>
    </div>
</template>

<style lang="scss">
// Not scoped: the overlay elements are created programmatically inside the alphaTab container.
.tab-editor {
    .editor-main {
        display: flex;
        align-items: flex-start;
    }

    .score-area {
        flex: 1;
        min-width: 0;
        // keep the last bars reachable above the fixed bottom panel
        margin: 0 15px 110px 15px;
        position: relative;
    }

    .editor-bottom {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 20;
        display: flex;
        flex-direction: column;
        background-color: #101418;
        border-top: 1px solid #222;
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

    .editor-invalid-bar {
        position: absolute;
        display: none;
        background: rgba(220, 53, 69, 0.12);
        border-bottom: 2px solid rgba(220, 53, 69, 0.7);
        pointer-events: none;
        z-index: 9;
    }

    .key-label {
        width: 160px;
    }
}
</style>
