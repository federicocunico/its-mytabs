# Guitar Pro Editor for its-mytabs — Design & Implementation Plan

## Context

its-mytabs is currently a **viewer/player** for Guitar Pro files (Deno + Hono backend, Vue 3 Options-API frontend, alphaTab 1.8.0 doing all parsing/rendering/playback). The goal is to extend it into
an **editor**: create and edit GP files with musically-correct, keyboard-driven WYSIWYG editing on the rendered score — Guitar Pro-style note entry, durations, rests, ties, and (in later phases) the
full effect palette (bends, vibrato, slides, hammer-on/pull-off, palm mute, tremolo, harmonics, …) and score structure (time signatures, tempo, repeats, tracks).

**Decisions confirmed with the user:** WYSIWYG on-score editing (not alphaTex text editing); phased delivery; save to server + local .gp download; single-track editing initially.

**Key enablers verified against alphaTab 1.8.0's `.d.ts` and docs:**

- Mutable model: `Beat.addNote/removeNote`, `Voice.addBeat/insertBeat` (no `removeBeat` — splice `voice.beats`), `Score/Bar/Voice/Beat.finish()`, `model.JsonConverter.scoreToJsObject/jsObjectToScore`
  (full-fidelity clone — the undo mechanism).
- `alphaTab.exporter.Gp7Exporter().export(score, settings)` → `.gp` bytes, client-side. Import of gp3/4/5/gpx/musicxml already works; saving converts everything to `.gp` (GP7) — the only export
  format.
- `api.renderScore(score, [trackIdx], { reuseViewport: true })` — a purpose-built live-editing re-render hint; `api.loadMidiForScore()` regenerates playback after edits;
  `beatMouseDown`/`noteMouseDown` events + `boundsLookup` (with `core.includeNoteBounds: true`) for click-to-place and the cursor overlay.
- Backend already has everything needed for save/create: `POST /api/tab/:id/replace` → `replaceTab` (backend/tab.ts:259, keeps a timestamped backup), and `POST /api/new-tab/template/:type`
  (backend/main.ts:201) creating blank tabs from `extra/empty-guitar.gp` / `extra/empty-bass.gp`.

## Architecture

### 1. Framework-free editing engine — `frontend/src/editor/` (new)

The authoritative Score is the live `api.score` instance (never wrapped in Vue reactivity — the graph is huge/cyclic and proxies would corrupt alphaTab internals). A plain TS class owns the session;
the Vue component holds reactive UI state fed by a `notifyUi` callback. No Pinia.

```
frontend/src/editor/
  EditorController.ts     # session facade: attach(api, trackIndex), transact(), undo/redo, exportGp()
  EditorCursor.ts         # logical cursor {trackIndex, staffIndex, barIndex, voiceIndex, beatIndex, string}
                          # indices are authoritative (object refs die on undo/Tier-2 rebuild); clamp() after structural edits
  history.ts              # SnapshotHistory: JSON.stringify(JsonConverter.scoreToJsObject(score)) per step,
                          # cap ~50 entries; undo = jsObjectToScore + renderScore swap
  normalize.ts            # Tier 1: pad under-full bars with rests + scoped voice/bar.finish() + beat.chain();
                          # Tier 2 (structural edits & undo): full JsonConverter round-trip + renderScore
  validation.ts           # fret 0–30, string 1..tuning.length, one note per string per beat, tie legality
                          # (same string, fret copied from origin), effect conflicts, ts/tempo ranges;
                          # over-full bars WARN (never truncate — GP-style red bar marker)
  render-scheduler.ts     # rAF-coalesced render with { reuseViewport: true }; save/restore scroll +
                          # re-resolve cursor via boundsLookup on postRenderFinished
  persistence.ts          # exportGp(), saveToServer(tabID), downloadGp()
  keymap.ts               # declarative key→command table (single source of truth, also renders help modal)
  keyboard-controller.ts  # global keydown dispatch, input/dialog focus guards, multi-digit fret buffer
  mutations/              # pure fns over model: note.ts, beat.ts, bar.ts, effects.ts, structure.ts
  commands/index.ts       # command constructors binding cursor → mutations
```

**Undo/redo: snapshot-based, not inverse commands.** `finish()` recomputes tie origins, hammer/slide targets, beat chains, tuplet groups — inverse commands can't reliably undo those side effects;
restoring alphaTab's own serialization format is trivially correct. One `transact()` = checkpoint → mutations → normalization → one scheduled render; snapshots double as crash-recovery if a mutation
throws.

**Bar-fill policy (musical correctness):** under-full voices are auto-padded with rests (greedy largest-fit vs `masterBar.calculateDuration()`); over-full voices are kept and flagged with a warning —
duration changes never delete user data. `insertBar/deleteBar` always operate on **all tracks** (masterBars and every staff's bars stay in sync) even though only one track is edited.

**Playback while editing:** `midiDirty` flag set on every change; `api.loadMidiForScore()` runs lazily on Play. Space plays from the edit cursor; note-entry keys suspended while playing.

### 2. Editor page — separate route, not a Tab.vue mode

- New route `/tab/:id/editor` → `frontend/src/pages/TabEditor.vue` (lazy-loaded). Tab.vue is ~1860 lines and 60% player-only machinery (YouTube/audio handlers, Socket.IO remote, sync offsets) the
  editor must not carry; the editor also needs different alphaTab settings (synth-only player, page layout, `includeNoteBounds: true`, tab stave forced visible).
- Extract only small pure helpers into `frontend/src/alphatab-shared.ts` and refactor Tab.vue to import them: `getTempToken` (Tab.vue:538), `getFileURL` (:534), `buildDisplayResources` (:567),
  `getStaveProfile` (:1219), optionally `applyStringColors` (:766).
- New components under `frontend/src/components/editor/`: `EditorToolbar.vue`, `EditorStatusBar.vue`, `DurationPicker.vue`; Phase 2: `EffectsPalette.vue`, `BendDialog.vue`, `GraceDialog.vue`; Phase 3:
  `BarSettingsDialog.vue`, `TrackManagerDialog.vue`. Bootstrap 5 / bootstrap-vue-next / FontAwesome, consistent with the app.
- Layout: sticky top toolbar (undo/redo · duration picker + dot/tie/rest · bar ops · play controls · Save + overflow menu), alphaTab surface with an absolutely-positioned cursor-overlay div
  (positioned from `boundsLookup`, re-anchored on every `postRenderFinished` and resize), fixed bottom status bar (Bar 12/48 · Beat 3 · String 4 (D) · pending fret buffer `1▁` · duration · bar-fill
  indicator ✓/under/over).
- Entry points: "Edit Score" button in Tab.vue toolbar (next to existing Edit→metadata button, ~Tab.vue:1514); `TabNew.vue.createEmpty()` (:97) navigates to the editor after creating from template.
  Block the editor route in demo mode (router.ts:79-95 currently allows all `/tab/*`).
- Drum tracks: disable editor entry for Phase 1 (Tab.vue already detects drums ~:1260).

### 3. Keyboard map (GP8-inspired, web-safe; full table in keymap.ts + help modal + README)

- **Navigation:** `←/→` beat (→ past last beat auto-appends a bar, GP behavior); `↑/↓` string; `Ctrl+←/→` and `Tab`/`Shift+Tab` bar; `Home/End` bar edges; `Ctrl+Home/End` score edges; click-to-place
  via `beatMouseDown`.
- **Note entry:** digits `0–9` with GP-style multi-digit buffer — first digit writes immediately, second digit within 750 ms appends (`1`,`2` → 12) if ≤ max fret; buffer shown in status bar, cleared
  by timeout/move/Esc.
- **Rhythm:** `+`/`-` longer/shorter duration; `.` dot; `L` tie; `R` rest; `Del/Backspace` delete note; `Shift+Del` delete beat; `Insert` insert beat; `Ctrl+Insert` insert bar; `Ctrl+Del` delete bar
  (confirm if non-empty).
- **Edit/file:** `Ctrl+Z`/`Ctrl+Y` undo/redo; `Ctrl+S` save; `Ctrl+Shift+S` download; `Ctrl+C/X/V` beat copy/paste (Phase 2); `Space` play/pause from cursor; `?` shortcuts help.
- **Effects (Phase 2):** `H` hammer/pull, `B` bend dialog, `V` vibrato, `S` slide (Shift+S legato slide), `P` palm mute, `I` let ring, `X` dead note, `O` ghost, `T` tap, `G` grace, `N` harmonics
  cycle, `A` accent cycle, `D` staccato, `Y` tremolo picking cycle, `Shift+T` trill.
- Never bind browser-reserved combos (Ctrl+W/T/N/D/P/O). Match on `e.code` for letters/digits/arrows, `e.key` for punctuation.
- **Focus guard (fixes the Tab.vue:66 anti-pattern):** global keydown handler that bails when `e.target` is INPUT/TEXTAREA/SELECT/contentEditable or a modal is open (dialog-open counter); unknown keys
  fall through.

### 4. Persistence

- **Save:** new endpoint `POST /api/tab/:id/save-score` (backend/main.ts, next to `/replace` at :322) + `saveScore()` in backend/tab.ts modeled on `replaceTab` (:259): auth via `checkLogin`, multipart
  file (ext must be `gp`), timestamped backup of the current file **plus pruning to the newest 10 backups** (an editing session would otherwise litter dozens), write `tab.gp`, update `tab.filename`
  but preserve `originalFilename`. Client: `Gp7Exporter` bytes → FormData → clear dirty flag, no reload.
- **Format conversion:** first save of a non-.gp source shows a one-time notice "Saving converts to Guitar Pro (.gp); the original is backed up on the server."
- **New blank tab:** reuse existing `POST /api/new-tab/template/:type`; only change is navigating to the editor afterward.
- **Download:** exporter bytes → Blob → anchor click.
- **Dirty guards:** `beforeRouteLeave` (Save & leave / Discard / Cancel) + `beforeunload` while dirty.
- **Draft autosave (stretch):** exported bytes to IndexedDB (tiny raw wrapper, no dependency) every 60 s while dirty + on tab-hide; offer restore on mount; delete on save. No server autosave
  (surprising mutations, fights backup pruning).
- **i18n:** all new strings under an `editor.*` namespace in `frontend/src/lang/en.json`.

### 5. Testing

- Add **Vitest** (frontend devDependency, `environment: 'node'`) — alphaTab's model/importer/exporter layer runs in Node (verified: `engines.node>=6`, upstream tests run under Node). Engine code
  imports from `@coderline/alphatab` (not the Vite entry) so it's testable headlessly. New deno task `test-frontend`.
- Fixtures: `ScoreLoader.loadAlphaTex(...)` for compact readable scores + `extra/empty-guitar.gp` bytes.
- Test tiers: (1) mutation unit tests — model fields, beat-chain integrity, bar-fill invariant; (2) **`finish()` idempotency spike-as-test** (the top technical risk — if re-running `voice.finish()`
  isn't idempotent, Tier-1 normalization degrades to Tier-2 rebuild, architecture unchanged); (3) history round-trips (mutate→undo→deep-compare via `JsonConverter.scoreToJson`); (4) export round-trips
  (mutate → `Gp7Exporter` → `loadScoreFromBytes` → assert values survive).
- UI verification is manual + optional Playwright later.

## Delivery phases

**Phase 0 — foundations (~2 d):** spec doc committed to `docs/superpowers/specs/`; `alphatab-shared.ts` extraction + Tab.vue refactor; Vitest setup + `finish()` idempotency + render-latency spikes on
a real 300-bar file.

**Phase 1 — core editing (~2 wk):** engine (controller, cursor, history, normalize, validation, note/beat/bar mutations) with unit tests; TabEditor.vue + route + overlay cursor; keymap + keyboard
controller + fret buffer; toolbar/status bar/duration picker; playback-from-cursor; save endpoint + client save/download + dirty guards + entry buttons + i18n + README; stretch: IndexedDB drafts.
_Exit criterion: create a blank tab, enter a riff with keyboard only, hear it, save it, reopen it in Guitar Pro._

**Phase 2 — effects (~1 wk):** `mutations/effects.ts` (note-level: bend/vibrato/slides/hammer-pull/harmonics/let-ring/palm-mute/dead/ghost/staccato/accent/trill/fingering; beat-level:
grace/tremolo/brush/pick-stroke/whammy/pop-slap-tap/text/dynamics); EffectsPalette row + effect keys; BendDialog with **presets** (¼/½/full/1½, bend-release, prebend…) — graphical point editor
deferred; single-beat copy/paste; export round-trip tests per effect.

**Phase 3 — structure & tracks (~1.5 wk):** BarSettingsDialog (time sig with pad/warn re-layout, key sig, tempo automations, repeats + `rebuildRepeatGroups()`, sections, triplet feel); range
selection + multi-beat copy/paste; track add/remove/re-tune (TrackManagerDialog) + multi-voice cursor support; optional graphical bend editor.

## Critical files

| File                                                                    | Change                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `frontend/src/editor/**`                                                | new — entire engine + keyboard layer                               |
| `frontend/src/pages/TabEditor.vue`, `frontend/src/components/editor/**` | new — editor UI                                                    |
| `frontend/src/alphatab-shared.ts`                                       | new — helpers extracted from Tab.vue                               |
| `frontend/src/pages/Tab.vue`                                            | use shared helpers; "Edit Score" button                            |
| `frontend/src/router.ts`                                                | `/tab/:id/editor` route + demo-mode block                          |
| `frontend/src/pages/TabNew.vue`                                         | navigate to editor after blank-template create                     |
| `backend/main.ts`, `backend/tab.ts`                                     | `POST /api/tab/:id/save-score` + `saveScore()` with backup pruning |
| `frontend/src/lang/en.json`, `README.md`                                | editor strings + shortcut table                                    |
| `frontend/package.json`, `frontend/vitest.config.ts`, `deno.jsonc`      | Vitest + `test-frontend` task                                      |

## Risks

1. **`finish()` re-run idempotency** — gated by the Phase-0 spike; fallback (full rebuild per edit) already exists as the undo path.
2. **Full re-render latency** on 300-bar scores per keystroke — mitigated by rAF coalescing + `reuseViewport`; fallback: idle-debounced render with optimistic overlay. Measure in Phase 0.
3. **Gp7Exporter fidelity** from gp3/gp5/musicxml sources — quantified by round-trip tests; server backups limit blast radius.
4. Snapshot memory on huge scores — history cap 50, measured before optimizing.
5. Concurrent edit sessions last-write-win — acceptable for a self-hosted personal app; note in README.

## Verification

- `deno task test-frontend` — engine unit + round-trip tests green.
- `deno task test` — existing backend tests + new save-score endpoint test (modeled on main_test.ts replace test).
- End-to-end manual (or Playwright via `run` skill): start dev server → create blank guitar tab → keyboard-enter a known riff (multi-digit frets, duration changes, dots, tie, rest, bar insert) → Space
  to hear it → Ctrl+Z/Ctrl+Y → Ctrl+S → reload player page and confirm rendering → download .gp and open in Guitar Pro / re-import to confirm round-trip.
