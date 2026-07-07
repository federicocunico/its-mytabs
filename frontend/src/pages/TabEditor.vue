<script>
import { defineComponent } from "vue";
import { notify } from "@kyvg/vue3-notification";
import { BModal } from "bootstrap-vue-next";
import { ActionBuffer, baseURL, checkFetch, generalError, getSetting, getTrackInstrumentName } from "../app.js";
import { applyTrackStaffVisibility, buildDisplayResources, getFileURL, getTempToken } from "../alphatab-shared.ts";
import { STRING_COLORS_LIGHT, trackColor } from "../styles/colors.ts";
import { EditorController } from "../editor/EditorController.ts";
import { caretYOnLines } from "../editor/caret-geometry.ts";
import { indexAfterMove } from "../editor/mutations/structure.ts";
import { KeyboardController } from "../editor/keyboard-controller.ts";
import { KEYMAP } from "../editor/keymap.ts";
import { downloadGp, saveScoreToServer } from "../editor/persistence.ts";
import { barIndexFromTick, buildPresenceMatrix, buildSections, formatTimeMs, loopBarSpan, scoreEndTick, tickToMs } from "../studio/score-nav.ts";
import { getKeySignature } from "../util.ts";
import { getProvider } from "../storage/session.ts";
import { basename, joinPath, parentPath, stripExt } from "../storage/paths.ts";
import StudioShell from "../components/shell/StudioShell.vue";
import StudioTopBar from "../components/shell/StudioTopBar.vue";
import EditorStatusBar from "../components/editor/EditorStatusBar.vue";
import EditorSidebar from "../components/editor/EditorSidebar.vue";
import MixerPanel from "../components/studio/MixerPanel.vue";
import TrackNavigator from "../components/studio/TrackNavigator.vue";
import TransportBar from "../components/studio/TransportBar.vue";
import BendDialog from "../components/editor/BendDialog.vue";
import BarSettingsDialog from "../components/editor/BarSettingsDialog.vue";
import TrackManagerDialog from "../components/editor/TrackManagerDialog.vue";

const speedActionBuffer = new ActionBuffer(1000);

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

// Per-tab display preferences (view mode + note colouring) persist client-side,
// keyed by tab id, so each tab remembers how it was last viewed.
const DISPLAY_PREFS_KEY = "mytabs-display-prefs";

function loadDisplayPrefs(tabID) {
    try {
        const all = JSON.parse(localStorage.getItem(DISPLAY_PREFS_KEY) ?? "{}");
        return all[tabID] ?? null;
    } catch {
        return null;
    }
}

function saveDisplayPrefs(tabID, prefs) {
    try {
        const all = JSON.parse(localStorage.getItem(DISPLAY_PREFS_KEY) ?? "{}");
        all[tabID] = prefs;
        localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(all));
    } catch {
        // ignore quota / serialization failures — prefs are best-effort
    }
}

/** Map the global user `scoreStyle` setting to one of the editor's three view modes. */
function scoreStyleToViewMode(scoreStyle) {
    if (scoreStyle === "score") {
        return "score";
    }
    if (scoreStyle === "score-tab") {
        return "score-tab";
    }
    return "tab";
}

export default defineComponent({
    components: {
        StudioShell,
        StudioTopBar,
        EditorStatusBar,
        EditorSidebar,
        MixerPanel,
        TrackNavigator,
        TransportBar,
        BendDialog,
        BarSettingsDialog,
        TrackManagerDialog,
        BModal,
    },

    /** @type {alphaTab.AlphaTabApi} */
    api: null,

    /** @type {EditorController} */
    ctrl: null,

    /** @type {KeyboardController} */
    kb: null,

    overlayEl: null,
    renderScheduled: false,

    /** @type {WeakMap<object, {showTablature: boolean, showStandardNotation: boolean}>} */
    _origStaffVis: null,

    data() {
        return {
            tabID: -1,
            storagePath: null,
            provider: null,
            tab: {},
            trackIndex: 0,
            trackName: "",
            viewMode: "tab",
            noteColorOn: false,
            ready: false,
            playing: false,
            saving: false,
            midiDirty: false,
            enableMetronome: false,
            enableCountIn: false,
            isLooping: false,
            speed: 100,
            masterVolume: 100,
            soloTrackID: -1,
            muteTrackList: {},
            trackVolumes: {},
            playbackRange: null,
            studio: {
                presence: [],
                sections: [],
                playhead: 0,
                navCurrentBar: 0,
                timeCur: "0:00",
                timeTotal: "0:00",
            },
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

        studioBadges() {
            if (!this.ctrl?.score) {
                return { keyBadge: "", tempo: null, timeSignature: "" };
            }
            const track = this.ctrl.score.tracks[this.ctrl.cursor.trackIndex];
            const bar = track?.staves[0]?.bars[0];
            const mb = this.ctrl.score.masterBars[0];
            return {
                keyBadge: bar ? getKeySignature(bar) : "",
                tempo: mb?.tempoAutomations[0] ? Math.round(mb.tempoAutomations[0].value) : null,
                timeSignature: mb ? `${mb.timeSignatureNumerator}/${mb.timeSignatureDenominator}` : "",
            };
        },

        mixerTracks() {
            if (!this.ctrl?.score) {
                return [];
            }
            return this.ctrl.score.tracks.map((t, i) => ({
                index: i,
                name: t.name || getTrackInstrumentName(t),
                instrument: getTrackInstrumentName(t),
                color: trackColor(i),
                solo: this.soloTrackID === i,
                mute: !!this.muteTrackList[i],
                volume: this.trackVolumes[i] ?? 100,
                // Use the reactive trackIndex so the highlight follows track switches
                // (ctrl.cursor is a plain object and doesn't trigger recomputation).
                selected: this.trackIndex === i,
            }));
        },

        navBarCount() {
            return this.ctrl?.score?.masterBars.length ?? 0;
        },

        navLoop() {
            if (!this.isLooping || !this.ctrl?.score) {
                return null;
            }
            if (this.playbackRange) {
                return loopBarSpan(this.ctrl.score, this.playbackRange);
            }
            const last = this.navBarCount - 1;
            return last >= 0 ? { start: 0, end: last } : null;
        },
    },

    watch: {
        enableCountIn() {
            if (!this.api) {
                return;
            }
            this.api.countInVolume = this.enableCountIn ? 1 : 0;
        },

        enableMetronome() {
            if (!this.api) {
                return;
            }
            this.api.metronomeVolume = this.enableMetronome ? 1 : 0;
        },

        isLooping() {
            if (!this.api) {
                return;
            }
            this.api.isLooping = this.isLooping;
        },

        speed(newVal) {
            if (!this.api) {
                return;
            }
            let speed = newVal;
            if (typeof speed !== "number" || isNaN(speed)) {
                speed = 100;
            } else if (speed < 20) {
                speed = 20;
            } else if (speed > 1000) {
                speed = 1000;
            }
            speedActionBuffer.run(() => {
                this.api.playbackSpeed = parseFloat((speed / 100).toFixed(2));
            });
        },
    },

    async mounted() {
        this.setting = getSetting();

        this.storagePath = this.$route.query.path ? String(this.$route.query.path) : null;
        this.provider = getProvider();
        if (this.storagePath && this.provider) {
            try {
                await this.loadFromProvider();
            } catch (e) {
                notify({ type: "error", title: "Could not open tab", text: e.message });
            }
            return;
        }

        this.tabID = this.$route.params.id;

        // Seed view mode + note colouring from this tab's saved prefs, falling
        // back to the user's global display settings.
        const prefs = loadDisplayPrefs(this.tabID);
        this.viewMode = prefs?.viewMode ?? scoreStyleToViewMode(this.setting.scoreStyle);
        this.noteColorOn = prefs?.noteColorOn ?? (this.setting.noteColor !== undefined && this.setting.noteColor !== "none");

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

        this._wireKeyboardAndUnload();
    },

    beforeUnmount() {
        window.removeEventListener("keydown", this._onKeydown);
        window.removeEventListener("beforeunload", this._onBeforeUnload);
        this.stopTransportPoll();
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
            const core = {
                fontDirectory: "/font/",
                engine: "html5",
                includeNoteBounds: true,
            };
            if (tempToken !== null) {
                // Server mode: alphaTab fetches the score from a URL. In provider
                // mode (tempToken === null) the bytes are loaded directly via
                // api.load(), so core.file is omitted.
                core.file = getFileURL(this.tabID, tempToken);
            }
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
                core,
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
                    // Per-staff visibility (set in prepareRender) is authoritative
                    // for the tab/score/score+tab views, so the profile stays Default.
                    staveProfile: alphaTab.StaveProfile.Default,
                    resources: buildDisplayResources(this.setting),
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
                    this.prepareRender();
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

                if (score.masterBars.length > 0 && score.masterBars[0].tempoAutomations.length > 0) {
                    score.masterBars[0].tempoAutomations[0].isVisible = true;
                }

                this.initTrackVolumes(score);
                this.rebuildNavigatorData();
                this.api.metronomeVolume = this.enableMetronome ? 1 : 0;
                this.api.countInVolume = this.enableCountIn ? 1 : 0;
                this.api.isLooping = this.isLooping;
                this.api.playbackSpeed = this.speed / 100;
                this.api.masterVolume = this.masterVolume / 100;

                this.prepareRender();
                this.api.renderTracks([score.tracks[this.trackIndex]]);
                this.ready = true;
                this.refreshTransportPosition();
            });

            this.api.postRenderFinished.on(() => {
                this.updateOverlay();
            });

            this.api.playbackRangeChanged.on(() => {
                this.playbackRange = this.api.playbackRange;
            });

            this.api.playerFinished.on(() => {
                if (!this.isLooping) {
                    this.playing = false;
                    this.ui.playing = false;
                }
                this.stopTransportPoll();
                this.refreshTransportPosition();
            });

            this.api.playerStateChanged.on((args) => {
                this.playing = args.state === 1;
                this.ui.playing = this.playing;
                if (this.playing) {
                    this.startTransportPoll();
                } else {
                    this.stopTransportPoll();
                    this.refreshTransportPosition();
                }
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

        /** Provider-mode load: read tab bytes + meta from the storage provider and feed them to alphaTab directly. */
        async loadFromProvider() {
            const { bytes, meta } = await this.provider.readTab(this.storagePath);
            this.tab = { title: meta.title ?? "", artist: meta.artist ?? "", filename: this.storagePath.split("/").pop() };
            this.viewMode = meta.viewMode ?? "tab";
            this.noteColorOn = !!meta.noteColorOn;
            this.initContainer(null); // FSA mode: no temp token
            // Load bytes directly instead of core.file URL:
            this.api.load(new Uint8Array(bytes));
            // wire keyboard + beforeunload exactly as the server path does
            this._wireKeyboardAndUnload();
        },

        /** Keyboard shortcut handling + unsaved-changes beforeunload guard; shared by both load paths. */
        _wireKeyboardAndUnload() {
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
                    this.goToLibrary();
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

        /** Drag-and-drop reorder (from the mixer or the bottom navigator). */
        moveTrack({ from, to }) {
            if (from === to || this.playing) {
                return;
            }
            const result = this.ctrl.moveTrackFromTo(from, to);
            if (!result.ok) {
                if (result.message) {
                    notify({ type: "warn", text: result.message });
                }
                return;
            }
            // Keep the index-keyed per-track state attached to the same tracks.
            const remapKeys = (obj) => {
                const out = {};
                for (const [k, v] of Object.entries(obj)) {
                    out[indexAfterMove(+k, from, to)] = v;
                }
                return out;
            };
            this.muteTrackList = remapKeys(this.muteTrackList);
            this.trackVolumes = remapKeys(this.trackVolumes);
            if (this.soloTrackID >= 0) {
                this.soloTrackID = indexAfterMove(this.soloTrackID, from, to);
            }
            // The controller's cursor already followed the moved track.
            this.trackIndex = this.ctrl.cursor.trackIndex;
            this.trackName = this.ctrl.score.tracks[this.trackIndex]?.name ?? "";
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
                    this.prepareRender();
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
            this.rebuildNavigatorData();
            this.refreshTransportPosition();
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

        initTrackVolumes(score) {
            // changeTrackVolume takes a multiplier relative to the file's own
            // track volume, so every slider starts at 100%.
            const volumes = {};
            score.tracks.forEach((t, i) => {
                volumes[i] = 100;
            });
            this.trackVolumes = volumes;
        },

        rebuildNavigatorData() {
            if (!this.ctrl?.score) {
                return;
            }
            const score = this.ctrl.score;
            this.studio.presence = buildPresenceMatrix(score);
            this.studio.sections = buildSections(score.masterBars);
            score.tracks.forEach((t, i) => {
                if (this.trackVolumes[i] === undefined) {
                    this.trackVolumes[i] = 100;
                }
            });
            const end = scoreEndTick(score);
            this.studio.timeTotal = formatTimeMs(tickToMs(score, end));
        },

        refreshTransportPosition() {
            if (!this.ctrl?.score) {
                return;
            }
            const score = this.ctrl.score;
            const tick = this.playing ? Number(this.api?.tickPosition ?? 0) : Number(this.ctrl.cursor.resolve()?.beat?.absolutePlaybackStart ?? this.api?.tickPosition ?? 0);
            const end = scoreEndTick(score);
            this.studio.playhead = end > 0 ? tick / end : 0;
            this.studio.navCurrentBar = this.playing ? barIndexFromTick(score, tick) : this.ctrl.cursor.pos.barIndex;
            this.studio.timeCur = formatTimeMs(tickToMs(score, tick));
        },

        startTransportPoll() {
            this.stopTransportPoll();
            const tick = () => {
                this.refreshTransportPosition();
                if (this.playing) {
                    this._transportRaf = requestAnimationFrame(tick);
                }
            };
            this._transportRaf = requestAnimationFrame(tick);
        },

        stopTransportPoll() {
            if (this._transportRaf) {
                cancelAnimationFrame(this._transportRaf);
                this._transportRaf = null;
            }
        },

        goToLibrary() {
            this.$router.push("/");
        },

        transportToStart() {
            if (this.playing && this.api) {
                this.api.tickPosition = 0;
                this.refreshTransportPosition();
                return;
            }
            this.dispatch("scoreStart");
        },

        transportToEnd() {
            if (this.playing && this.api && this.ctrl?.score) {
                const end = scoreEndTick(this.ctrl.score);
                this.api.tickPosition = end;
                this.refreshTransportPosition();
                return;
            }
            this.dispatch("scoreEnd");
        },

        toggleLoop() {
            this.isLooping = !this.isLooping;
        },

        toggleMetronome() {
            this.enableMetronome = !this.enableMetronome;
        },

        toggleCountIn() {
            this.enableCountIn = !this.enableCountIn;
        },

        setSpeed(value) {
            this.speed = value;
        },

        setMasterVolume(value) {
            this.masterVolume = value;
            if (this.api) {
                this.api.masterVolume = value / 100;
            }
        },

        toggleSolo(trackID) {
            if (!this.api) {
                return;
            }
            if (this.soloTrackID === trackID) {
                this.api.changeTrackMute(this.api.score.tracks, false);
                this.soloTrackID = -1;
                this.muteTrackList = {};
            } else {
                const muteList = [];
                const soloList = [];
                for (const track of this.api.score.tracks) {
                    if (track.index !== trackID) {
                        muteList.push(track);
                        this.muteTrackList[track.index] = true;
                    } else {
                        soloList.push(track);
                        this.muteTrackList[track.index] = false;
                    }
                }
                this.api.changeTrackMute(muteList, true);
                this.api.changeTrackMute(soloList, false);
                this.soloTrackID = trackID;
            }
        },

        toggleMute(trackID) {
            if (!this.api) {
                return;
            }
            this.soloTrackID = -1;
            this.muteTrackList[trackID] = !this.muteTrackList[trackID];
            this.api.changeTrackMute([this.api.score.tracks[trackID]], this.muteTrackList[trackID]);
        },

        setTrackVolume({ index, value }) {
            if (!this.api) {
                return;
            }
            this.trackVolumes[index] = value;
            const track = this.api.score.tracks[index];
            this.api.changeTrackVolume(track, value / 100);
        },

        seekToBar(barIndex) {
            if (!this.ctrl?.score || !this.api) {
                return;
            }
            const track = this.ctrl.score.tracks[this.ctrl.cursor.trackIndex];
            const bar = track.staves[0]?.bars[barIndex];
            const beat = bar?.voices[0]?.beats[0];
            if (!beat) {
                return;
            }
            if (this.playing) {
                this.api.tickPosition = beat.absolutePlaybackStart;
                this.refreshTransportPosition();
            } else {
                this.dispatch("goToBar", barIndex);
            }
        },

        // ---- display settings (view mode + note colouring) ----

        /** Everything that must run BEFORE a render: staff visibility, note colours, bar validation. */
        prepareRender() {
            this.applyStaffVisibility();
            this.applyNoteColors();
            this.applyBarValidationStyles();
        },

        /**
         * Set the current track's per-staff visibility for the active view mode.
         * This also repairs tracks whose staves are all hidden (some Guitar Pro
         * drum tracks), which would otherwise crash alphaTab's layout. The show
         * flags are serialized on export, so the originals are snapshotted here
         * and restored before saving (restoreStaffVisibility).
         */
        applyStaffVisibility() {
            if (!this.ctrl?.score) {
                return;
            }
            const track = this.ctrl.score.tracks[this.ctrl.cursor.trackIndex];
            if (!track) {
                return;
            }
            if (!this._origStaffVis) {
                this._origStaffVis = new WeakMap();
            }
            for (const staff of track.staves) {
                if (!this._origStaffVis.has(staff)) {
                    this._origStaffVis.set(staff, {
                        showTablature: staff.showTablature,
                        showStandardNotation: staff.showStandardNotation,
                    });
                }
            }
            applyTrackStaffVisibility(track, this.viewMode);
        },

        /** Restore original staff visibility so view-mode choices don't leak into saved files. */
        restoreStaffVisibility() {
            if (!this._origStaffVis || !this.ctrl?.score) {
                return;
            }
            for (const track of this.ctrl.score.tracks) {
                for (const staff of track.staves) {
                    const orig = this._origStaffVis.get(staff);
                    if (orig) {
                        staff.showTablature = orig.showTablature;
                        staff.showStandardNotation = orig.showStandardNotation;
                    }
                }
            }
        },

        /** Colour (or clear) the current track's notes by string, matching the player. */
        applyNoteColors() {
            if (!this.ctrl?.score) {
                return;
            }
            const track = this.ctrl.score.tracks[this.ctrl.cursor.trackIndex];
            if (!track) {
                return;
            }
            for (const staff of track.staves) {
                for (const bar of staff.bars) {
                    for (const voice of bar.voices) {
                        for (const beat of voice.beats) {
                            for (const note of beat.notes) {
                                if (this.noteColorOn) {
                                    const hex = STRING_COLORS_LIGHT[note.string];
                                    if (!hex) {
                                        continue;
                                    }
                                    const style = new alphaTab.model.NoteStyle();
                                    const color = alphaTab.model.Color.fromJson(hex);
                                    style.colors.set(alphaTab.model.NoteSubElement.GuitarTabFretNumber, color);
                                    style.colors.set(alphaTab.model.NoteSubElement.StandardNotationNoteHead, color);
                                    note.style = style;
                                } else if (note.style) {
                                    note.style = undefined;
                                }
                            }
                        }
                    }
                }
            }
        },

        /** Re-render the current track after a display-setting change. */
        rerenderDisplay() {
            if (!this.api || !this.ctrl || !this.ready) {
                return;
            }
            this.prepareRender();
            this.api.renderScore(this.ctrl.score, [this.ctrl.cursor.trackIndex]);
        },

        setViewMode(mode) {
            if (this.viewMode === mode) {
                return;
            }
            this.viewMode = mode;
            this.persistDisplayPrefs();
            this.rerenderDisplay();
        },

        toggleNoteColor(on) {
            this.noteColorOn = on;
            this.persistDisplayPrefs();
            this.rerenderDisplay();
        },

        persistDisplayPrefs() {
            saveDisplayPrefs(this.tabID, { viewMode: this.viewMode, noteColorOn: this.noteColorOn });
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
            // Small horizontal padding, larger vertical so the highlight
            // over/under-shoots the beat's bounds top and bottom.
            const padX = 3;
            const padY = 10;
            overlay.style.display = "block";
            overlay.style.left = `${rect.x - padX}px`;
            overlay.style.top = `${rect.y - padY}px`;
            overlay.style.width = `${rect.w + padX * 2}px`;
            overlay.style.height = `${rect.h + padY * 2}px`;

            // String caret. It marks where typed input lands, so it must sit on the
            // CURSOR's string line, not on some other string's note:
            //  - note on the cursor's string -> anchor to its note head (exact).
            //  - otherwise, in tab view -> place it on the string's staff line using
            //    the system's lineAlignedBounds (y = top line, y + h = bottom line).
            //    Anchoring to the nearest note or interpolating over the beat's
            //    stem-inclusive visualBounds drew the caret offset from the tab lines.
            //  - score / score+tab (no single tab-line span) -> nearest note head,
            //    then beat-bounds interpolation as the last resort.
            const caret = this.ensureCaret();
            const staff = r.bar.staff;
            const stringCount = staff.tuning.length;
            const targetString = this.ctrl.cursor.pos.string;
            const scale = this.api.settings?.display?.scale ?? 1;
            // Fixed box sized for a two-digit fret so the caret covers any value
            // (1..24 and beyond) without hugging the current note's width, and
            // stays centered on the string line / note column.
            const caretW = 18 * scale;
            const caretH = 16 * scale;
            let caretY = null;
            let caretCenterX = rect.x + rect.w / 2;

            const notes = beatBounds.notes ?? [];
            const noteOnString = r.note ? notes.find((nb) => nb.note === r.note) : null;
            const lines = this.viewMode === "tab" ? beatBounds.barBounds?.masterBarBounds?.lineAlignedBounds : null;
            if (noteOnString) {
                const nh = noteOnString.noteHeadBounds;
                caretY = nh.y + nh.h / 2;
                caretCenterX = nh.x + nh.w / 2;
            } else if (lines) {
                caretY = caretYOnLines(lines, stringCount, targetString);
                caretCenterX = beatBounds.onNotesX || rect.x + rect.w / 2;
            } else if (notes.length > 0) {
                const nearest = notes.reduce((best, nb) => Math.abs((nb.note?.string ?? 0) - targetString) < Math.abs((best.note?.string ?? 0) - targetString) ? nb : best);
                const nh = nearest.noteHeadBounds;
                caretY = nh.y + nh.h / 2;
                caretCenterX = nh.x + nh.w / 2;
            } else {
                // Rest / no rendered notes: even interpolation (model string 1 = bottom line).
                const fraction = (stringCount - targetString) / Math.max(1, stringCount - 1);
                caretY = rect.y + rect.h * fraction;
                caretCenterX = beatBounds.onNotesX || rect.x + rect.w / 2;
            }

            caret.style.display = "block";
            caret.style.left = `${caretCenterX - caretW / 2}px`;
            caret.style.top = `${caretY - caretH / 2}px`;
            caret.style.width = `${caretW}px`;
            caret.style.height = `${caretH}px`;
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

            if (this.storagePath && this.provider) {
                this.saving = true;
                this.ui.saving = true;
                try {
                    this.restoreStaffVisibility();
                    const bytes = this.ctrl.exportGp();
                    let targetPath = this.storagePath;
                    // convert-to-.gp: write a new .gp beside a non-.gp original, leave original intact.
                    // If a different .gp already exists at that name, pick a free "(n)" name instead of overwriting it.
                    if (!targetPath.toLowerCase().endsWith(".gp")) {
                        const dir = parentPath(targetPath);
                        const stem = stripExt(basename(targetPath));
                        let candidate = joinPath(dir, stem + ".gp");
                        let n = 1;
                        while (candidate !== this.storagePath && (await this.provider.exists(candidate))) {
                            candidate = joinPath(dir, stem + " (" + n + ").gp");
                            n++;
                        }
                        targetPath = candidate;
                    }
                    await this.provider.writeTab(targetPath, bytes);
                    await this.provider.writeMeta(targetPath, { viewMode: this.viewMode, noteColorOn: this.noteColorOn, title: this.tab.title, artist: this.tab.artist });
                    if (targetPath !== this.storagePath) {
                        this.storagePath = targetPath;
                    }
                    this.ctrl.markSaved();
                    notify({ type: "success", text: "Saved" });
                } catch (e) {
                    notify({ type: "error", title: "Save failed", text: e.message });
                } finally {
                    this.saving = false;
                    this.ui.saving = false;
                }
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
                // Strip view-only staff visibility so the saved file keeps its original layout.
                this.restoreStaffVisibility();
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
            // Strip view-only staff visibility so the exported file keeps its original layout.
            this.restoreStaffVisibility();
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
    <StudioShell>
        <template #top>
            <StudioTopBar
                mode="editor"
                :title="tab.title || 'Untitled'"
                :artist="tab.artist || ''"
                :key-badge="studioBadges.keyBadge"
                :tempo="studioBadges.tempo"
                :time-signature="studioBadges.timeSignature"
                :state="ui"
                :view-mode="viewMode"
                :note-color-on="noteColorOn"
                @command="dispatch"
                @back="goToLibrary"
                @set-view-mode="setViewMode"
                @toggle-note-color="toggleNoteColor"
            />
        </template>

        <template #left>
            <div v-if="ready" class="editor-left-rail">
                <div v-if="ui.voiceCount > 1" class="voice-strip">
                    <button
                        v-for="v in ui.voiceCount"
                        :key="v"
                        type="button"
                        class="voice-btn"
                        :class="{ active: ui.voiceIndex === v - 1 }"
                        :title="`Edit voice ${v}`"
                        :disabled="playing"
                        @click="dispatch('setVoice', v - 1)"
                    >V{{ v }}</button>
                </div>
                <EditorSidebar :ui="ui" :fx="fx" :disabled="playing || !ready" @command="dispatch" />
            </div>
        </template>

        <template #score>
            <div class="score-sheet">
                <div ref="atContainer" v-pre class="score-sheet-inner"></div>
            </div>
        </template>

        <template #right>
            <MixerPanel
                v-if="ready"
                :tracks="mixerTracks"
                :master="masterVolume"
                :playing="playing"
                @select-track="switchTrack"
                @toggle-solo="toggleSolo"
                @toggle-mute="toggleMute"
                @set-volume="setTrackVolume"
                @set-master="setMasterVolume"
                @add-track="openTrackManager"
                @move-track="moveTrack"
            />
        </template>

        <template #bottomGrid>
            <div v-if="ready" class="bottom-grid-wrap">
                <TrackNavigator
                    class="nav-area"
                    :tracks="mixerTracks"
                    :bar-count="navBarCount"
                    :presence="studio.presence"
                    :sections="studio.sections"
                    :current-bar="studio.navCurrentBar"
                    :playhead="studio.playhead"
                    :loop="navLoop"
                    @seek-bar="seekToBar"
                    @select-track="switchTrack"
                    @move-track="moveTrack"
                />
                <EditorStatusBar :info="status" class="editor-status-strip" />
            </div>
        </template>

        <template #bottomBar="{ bottomOpen, toggleBottom }">
            <TransportBar
                :playing="playing"
                :looping="isLooping"
                :metronome="enableMetronome"
                :count-in="enableCountIn"
                :speed="speed"
                :time-cur="studio.timeCur"
                :time-total="studio.timeTotal"
                :bottom-open="bottomOpen"
                @play-pause="dispatch('playPause')"
                @to-start="transportToStart"
                @to-end="transportToEnd"
                @toggle-loop="toggleLoop"
                @toggle-metronome="toggleMetronome"
                @toggle-count-in="toggleCountIn"
                @set-speed="setSpeed"
                @toggle-bottom="toggleBottom"
            />
        </template>
    </StudioShell>

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
</template>

<style lang="scss">
@import "../styles/vars.scss";

// Not scoped: overlay elements are created inside the alphaTab container.
.score-sheet {
    width: 100%;
    max-width: 900px;
    background: #fff;
    border-radius: 6px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
    min-height: 200px;
    // The sheet padding lives here (not on .score-sheet-inner) so the overlay
    // elements — absolutely positioned children of .score-sheet-inner — resolve
    // against a containing block whose origin coincides with alphaTab's render
    // surface. Padding on the inner would shift its content box away from its
    // padding box and draw every overlay offset from the tab lines.
    padding: 8px 4px 16px;
    position: relative;

    .score-sheet-inner {
        // Own the overlays' containing block; no padding, so its padding box
        // (the containing-block origin) matches alphaTab's (0,0).
        position: relative;
    }
}

.editor-left-rail {
    padding: 44px 12px 16px;

    .voice-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid $st-border;
    }

    .voice-btn {
        min-width: 34px;
        height: 28px;
        padding: 0 8px;
        border-radius: 6px;
        border: 1px solid $st-border-2;
        background: $st-panel-2;
        color: $st-text-muted;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;

        &.active {
            background: rgba(91, 110, 245, 0.15);
            border-color: $st-accent;
            color: $st-accent;
        }
        &:disabled {
            opacity: 0.45;
            cursor: default;
        }
    }
}

.bottom-grid-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;

    .nav-area {
        flex: 1;
        min-height: 0;
    }

    .editor-status-strip {
        flex: none;
        border-top: 1px solid $st-border;
        background: $st-rail-bg;
        padding: 5px 14px;
        font-size: 12px;
        color: $st-text-muted;
    }
}

.tab-editor,
.score-sheet {
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
