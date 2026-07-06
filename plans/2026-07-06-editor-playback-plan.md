# Fix Editor + Playback, GP-style Layout, Non-Regression Test Suite

## Context

The GP score editor (merged 2026-07-05, `frontend/src/editor/` + `frontend/src/pages/TabEditor.vue`) has functional defects — the user's #1 complaint is "I can delete a note but I can't delete a
pause" — and playback has regressed since the editor branch landed. There is no `make test`, and CI runs only backend tests, so nothing catches regressions. Goals for this pass:

1. Diagnose and fix playback on all three paths (viewer / edited+saved tabs / editor page).
2. Fix broken editor functionality (rest deletion, feedback, cursor bugs).
3. Restructure the editor page into a Guitar Pro-style layout (left tool sidebar with shortcut hints, bottom track+bar navigator panel) — **structure only, plain styling; visual polish explicitly
   deferred** (user decision).
4. Categorized non-regression tests (playback / editor / backend) wired into a new `make test`; separate `make test-e2e` for Playwright browser smoke (user decision).

**Engine invariants (sacred):** live `api.score` never wrapped in Vue reactivity; undo = whole-score JSON snapshots; all mutations in `EditorController.transact()`; bar/track splices use
`{structural: true, skipNormalize: true}` (never `score.finish()` on a spliced graph); model string 1 = lowest pitch, UI shows guitarist numbering (`7 - n` on 6-string).

**Environment:** dev verification server on `MYTABS_PORT=47778` + scratch `DATA_DIR` (47777 is the user's Docker container). Backend caches `dist/index.html` per process — restart after rebuilds.
Format only touched files. Check real diffs with `git -c core.safecrlf=false diff --stat`.

---

## Part A — Diagnosis first (cheap → expensive)

Prep for all browser steps: `deno task build-frontend`, then fresh `DATA_DIR=<scratch> MYTABS_PORT=47778 deno run --allow-all backend/main.ts`; register admin, seed a tab.

- **A1 (static):** `rg -l "47777" frontend/dist/assets` (must be absent from prod bundle); diff served `/` vs `dist/index.html` (stale-cache check); `curl -I /soundfont/sonivox.sf2` (expect 200) and
  `/assets/definitely-missing.js` (currently returns 200 HTML — the bug).
- **A2 (viewer, built app, Playwright MCP @47778):** network status of soundfont + all `/assets/*`; console markers (`Audio Worklet creation failed`, `[AlphaTab] [ERROR]`, `InvalidStateError`); wait
  `window.api.isReadyForPlayback`; play → `tickPosition` increases.
- **A3 (viewer under Vite dev @5173):** which origin `/api/*` + socket.io hit — `:47777` confirms the Docker-hit bug (`getBaseURL()` in `frontend/src/app.ts:22-29`).
- **A4 (edited-tab path):** capture `masterBars[*].tempoAutomations`, per-track `playbackInfo`, time sigs, repeats via evaluate → trivial edit + structural edit (bar insert → exercises `rebuildScore`)
  → Save → reload viewer → re-capture → diff → play.
- **A5 (editor playback):** play from cursor (console clean, tick advances); edit a note (`midiDirty`) → play → new note audible, starts at cursor (pins `loadMidiForScore`/`tickPosition` ordering,
  `TabEditor.vue:838-852`).
- **A6 (editor QA matrix, Playwright MCP):** every binding in `keymap.ts` (~42), every toolbar/palette/dialog button, plus complaint scenarios (Del on rest, R on rest, Shift+Del on padding rest, track
  switch 6→4 string then fret entry). Record pass/fail matrix; every broken row gets a failing pinning test before its fix.

## Part B — Playback fixes (conditional on diagnosis where noted)

- **B1 (unconditional): player error surfacing.** In both `Tab.vue` and `TabEditor.vue` `initContainer()`: subscribe `api.error.on` → notification toast; `api.playerReady.on` → `playerReady` flag;
  gate play on it with visible "audio player not ready" message; check `api.play()`'s boolean in the `playing` watcher (`Tab.vue:186`) and revert+notify on failure. Verify 1.8.0 event payloads in
  `frontend/node_modules/@coderline/alphatab/dist/alphaTab.d.ts`.
- **B2 (unconditional): bare `api` globals → `this.api`** at `Tab.vue:534` and `Tab.vue:644-645` (currently only work via debug `window.api`).
- **B3 (if A1 confirms — committed log says yes): static-serving hardening** in `backend/main.ts`: the SPA catch-all (`app.notFound`, ~L752) must return a real **404** for `/assets/`, `/font/`,
  `/soundfont/` and asset-extension paths (HTML only for navigations); in `isDev()` re-read `index.html` per request instead of the process-lifetime cache (~L70-75). This is the mechanism behind the
  `AbortError: Unable to load a worklet's module` in `.playwright-mcp/console-2026-07-05T17-58-16-106Z.log`.
- **B4 (if A3 confirms — near-certain): replace `getBaseURL()`** in `frontend/src/app.ts`:
  ```ts
  if (import.meta.env.DEV) {
      const port = import.meta.env.VITE_BACKEND_PORT || "47777";
      return `${location.protocol}//${location.hostname}:${port}`;
  }
  return "";
  ```
  Commit `frontend/.env.development` (`VITE_BACKEND_PORT=47777`); developer overrides in gitignored `.env.development.local` (47778 on this machine). Also fix hardcoded `wait-on tcp:127.0.0.1:47777`
  in `deno.jsonc` `dev-server` (small `extra/dev-server.ts` reading `MYTABS_PORT`, or document).
- **B5 (test-driven only): round-trip data loss.** If Part E playback tests or A4 show `Gp7Exporter`/`JsonConverter` dropping tempoAutomations/playbackInfo, re-apply the affected fields in
  `EditorController.exportGp()` (L563) or `normalize.ts rebuildScore()` (L125). Do not guess fields — tests decide.
- **B6 (if A5 confirms): editor play ordering** — when `midiDirty`, set `tickPosition`+`play()` in a one-shot `api.midiLoaded` handler instead of synchronously after `loadMidiForScore()`.

## Part C — Editor engine fixes (TDD: failing test first, run suite after each)

- **C1: `keyLabelFor(command)` helper** in `keymap.ts` (needed by sidebar tooltips/labels). Test in new `keymap.test.ts`.
- **C2: cursor clamp ordering.** In `transact()` (`EditorController.ts:103`) non-structural path, call `this.cursor.clamp()` **before** `refreshValidation()`/`requestRender()`; delete the post-hoc
  clamps in `deleteBeatAtCursor` (L261) / `deleteBarAtCursor` (L284). Test: host that flags whether `cursor.resolve()` is non-null during every notification; cursor on last beat →
  `deleteBeatAtCursor()`.
- **C3: rest/beat deletion semantics (#1 complaint).** New guards return honest `{ok:false, message}` **before** any checkpoint (no undo pollution); the existing `dispatch()` toast path
  (`TabEditor.vue:474`) surfaces them.

  | Cursor situation                                       | Del (`deleteNote`)                                                                                    | Shift+Del (`deleteBeat`)          | R (`toggleRest`)                       |
  | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------- |
  | Note on cursor string                                  | remove note (0 notes → beat becomes rest)                                                             | delete beat, shift left, pad tail | make rest                              |
  | Notes exist, none on this string                       | `{ok:false, "No note on this string"}`                                                                | delete beat                       | make rest                              |
  | Rest, not in trailing-rest run                         | **delete the beat** (shift left, pad tail)                                                            | same                              | `{ok:false, "Beat is already a rest"}` |
  | Rest in trailing pad run (deletion would be re-padded) | `{ok:false, "Trailing rests keep the bar in time — delete the bar (Ctrl+Del) or edit earlier beats"}` | same                              | same                                   |
  | Lone full-bar rest                                     | `{ok:false, "Bar is already empty"}`                                                                  | same                              | `{ok:false}`                           |

  New helpers in `normalize.ts` (+ tests): `isRedundantTrailingRest(voice, index)`, `isBarRestOnly(bar)` (explicit compute — alphaTab's `Bar.isRestOnly` is a `finish()`-cached field, can be stale).
  `deleteNoteAtCursor` on a rest delegates to `deleteBeatAtCursor`. Update `deleteNote` keymap description. ~7 controller tests incl. undo-history purity (`canUndo` unchanged on rejected commands,
  `scoreJson` before/after equal).
- **C4: move Vue-layer effect logic into controller:** `toggleTapAtCursor()`, `cycleGraceAtCursor()` (0→2→1→0), `toggleSlideOutAtCursor(1|2)` — bodies lifted from `TabEditor.vue:422-435,479-486`;
  dispatch cases become one-liners. Tests for each.
- **C5: track/voice-switch cursor pins:** two-track fixture (6-string + 4-string); `changeTrack(1)` with cursor on string 6 → clamped, `resolve()` non-null, both host callbacks fired; `setVoice(3)` on
  1-voice bar → clamped; `removeTrackFromScore(current)` → valid cursor. Fix anything exposed.
- **C6: absolute bar navigation:** `EditorCursor.toBar(index): boolean` + `EditorController.moveToBar(index)` (fires `onStateChanged`). Tests: valid jump lands beat 0; out-of-range no-op. Powers the
  bar navigator.
- **C7: `cursorBarIsRestOnly()`** on controller (uses `isBarRestOnly`); `deleteBarWithConfirm` (`TabEditor.vue:614`) uses it instead of `bar.isRestOnly`.

## Part D — GP-style layout (structure only, plain flexbox, existing button styles)

Target tree in `TabEditor.vue` (route sits under the Dashboard navbar — use sticky/fixed panels, no `100vh` math):

```
EditorToolbar.vue      top, sticky — SLIMMED: exit · title/dirty · undo/redo · voices · Play · Save · overflow
.editor-main (flex)
  ├ EditorSidebar.vue  NEW left palette ~170px, sticky, overflow-y:auto
  └ .score-area flex:1 (unchanged alphaTab container + overlay divs; margin-bottom ≈ bottom panel height)
.editor-bottom (position:fixed bottom, flex column)
  ├ EditorTrackPanel.vue  NEW track rows + "+ Track" + bar navigator
  └ EditorStatusBar.vue   existing; position:fixed → static flex child
```

- **D1: `EditorSidebar.vue`** (new, `frontend/src/components/editor/`). Props `ui`, `fx`, `disabled`; emits `command(name, arg)` — same command ids, zero new plumbing. Groups: Duration (reuse
  `DurationPicker.vue` as-is) · Beat (Rest/Tie/+Beat/−Beat — −Beat gets its first button) · Note effects · Beat effects (tables moved verbatim from `EffectsPalette.vue`) · Bar (+Bar/Append/−Bar/Bar…).
  Every button: `title` = `${description} (${keyLabelFor(command)})` + tiny `<span class="kbd">` shortcut label. **Delete `EffectsPalette.vue`** (sole consumer is TabEditor) and the toolbar `<slot/>`.
- **D2: `EditorTrackPanel.vue`** (new). Props `tracks[{index,name,strings}]`, `currentIndex`, `barIndex`, `barCount`, `invalidBars`, `disabled`; emits `switchTrack`, `openTrackManager`, `goToBar`.
  Left: one button per track (name + string count, `active` on current) + `+ Track` → opens existing `TrackManagerDialog` (add/remove/retune already work there). Right: horizontally scrollable strip
  of bar-number buttons; current `active`, invalid `text-danger`; click → `goToBar`; auto `scrollIntoView` on cursor move. Rendering stays **single-track** (`renderScore(score, [trackIndex])`) — panel
  just switches which track renders. Mute/solo deferred (only one track is audible in the editor).
- **D3: `TabEditor.vue` wiring:** new `trackPanel` data recomputed in `refreshUi()` (score isn't reactive) and on `scoreLoaded`; dispatch cases `goToBar` → `ctrl.moveToBar(arg)`, panel events reuse
  existing `switchTrack()`/`openTrackManager()`; slim the toolbar (remove DurationPicker/Rest/Tie/bar-ops/Tracks…).
- **D4: three-way leave guard** (spec §4): replace `beforeRouteLeave` `window.confirm` (`TabEditor.vue:176`) with a BModal — **Save & leave** (proceed only if save cleared dirty) / **Discard** /
  **Cancel**; register modal in `kb.isBlocked()`.
- `keymap.ts` bindings unchanged — all shortcuts keep working identically.

## Part E — Tests + wiring

**Categories:** backend = `deno task test` (existing `backend/*_test.ts`) · editor = `frontend/src/editor/**/*.test.ts` (~150 existing + Part C additions) · playback = **new**
`frontend/src/playback/**/*.test.ts`.

- **E1: playback suite** (new `frontend/src/playback/`, vitest include widened to both globs; shared `fixtures.ts` with playback-rich alphaTex: `\tempo 120`, `\instrument`, mid-song `\tempo 90` +
  `\ts 3 4`, repeats; helper setting non-default `playbackInfo`). All surfaces verified headless-safe in the d.ts (pure model code, no AudioContext):
  - `midi-generation.test.ts` — `midi.MidiFileGenerator` + `AlphaSynthMidiFileHandler`: note-on count matches score, tempo events at tick 0 and bar 2, tickLookup resolves.
  - `gp7-roundtrip.test.ts` — score → `Gp7Exporter().export()` → `ScoreLoader.loadScoreFromBytes()`: tempoAutomations, full `playbackInfo`, tunings, time sigs, repeats survive; bytes start `PK`;
    regenerated MIDI matches original profile (the real "sounds the same" pin).
  - `json-roundtrip.test.ts` — same assertions through `rebuildScore()` (editor structural-edit path).
  - `save-then-play.test.ts` — tex → mutation → Gp7 bytes → reload → MIDI includes the mutation.
  - `regressions.test.ts` — one pin per bug confirmed in Part A.
- **E2: editor tests** — everything listed in Part C plus pins for every A6 matrix failure.
- **E3: Playwright e2e** (separate target, NOT in `make test`): root `e2e/` dir with own `package.json` (`@playwright/test`) + `playwright.config.ts`; `webServer` =
  `deno run --allow-all backend/main.ts`, `MYTABS_PORT=47799` (dedicated), temp `DATA_DIR`. Serial smoke: register/login → upload committed `e2e/fixtures/smoke.gp` (generated once via a vitest helper
  — alphaTab needs a DOM, can't run in Playwright's Node process) → viewer renders SVG, console listener **fails on** `Audio Worklet creation failed`/`[AlphaTab] [ERROR]`/`InvalidStateError`, player
  ready, play advances `tickPosition` → editor loads, plays, edit→Save (200)→viewer plays again. Add `e2e` to root `deno.jsonc` `exclude`.
- **E4: task wiring:**
  - `deno.jsonc`: add `"test-editor": "cd frontend && deno run -A npm:vitest run src/editor"`, `"test-playback": "cd frontend && deno run -A npm:vitest run src/playback"` (keep `test-frontend` running
    both).
  - `Makefile`: `test` → `deno task test` + `deno task test-frontend`; aliases `test-backend`, `test-editor`, `test-playback`; `test-e2e` → `deno task build-frontend` then
    `cd e2e && npx playwright test`. Add to `.PHONY`.
  - CI `.github/workflows/deno-check.yml`: add `deno task install-frontend-deps` + `deno task test-frontend` steps (closes the frontend-tests-not-in-CI gap). E2E stays out of CI initially.

## Plan persistence & progress tracking (user request — do FIRST)

Create a `plans/` folder in the repo root (`C:\Users\Federico\Github\its-mytabs\plans\`):

- `plans/2026-07-06-editor-playback-plan.md` — this full plan, verbatim, so another Claude agent can resume from it cold.
- `plans/2026-07-06-editor-playback-progress.md` — living progress tracker: one checklist row per step below (A1…E4 + verification), each marked `todo / in-progress / done / blocked` with a short note
  (findings, verdicts, deviations). **Update it after completing each step** — it is the resume point for any future session.

## Execution order

0. Write `plans/` plan + progress files (above).
1. Part A diagnosis (A1–A6) → verdicts + QA matrix; record verdicts in the progress file.
2. E1 scaffold + `midi-generation` + round-trip tests (decides B5).
3. B1–B4 playback fixes (+B5/B6 as evidence dictates) + `regressions.test.ts` pins.
4. Part C engine fixes, TDD, one at a time (C1→C7).
5. Part D layout (D1→D4).
6. E3 e2e + E4 wiring (Makefile/deno.jsonc/CI).
7. Verification below; re-run full A6 matrix.

## Verification

- `make test` green (backend + editor + playback; stop dev server first — backend tests bind 47778). `deno task check` green. Format only touched files.
- `make test-e2e` green end-to-end on this Windows machine.
- Manual (Playwright MCP, built app @47778, fresh server): missing `/assets/x.js` now 404s; viewer plays a never-edited tab; edit+save a tab → viewer still plays it with correct tempo/instrument;
  editor: Del removes a note, Del on a mid-bar rest shifts beats left, Del on trailing rest shows the explanatory toast, R on rest toasts, track panel switches tracks with valid cursor, bar navigator
  jumps, dirty-leave shows 3-way modal, all keyboard shortcuts unchanged.
- Open a saved file in Guitar Pro (or re-import) after an edit session to confirm export sanity.

## Key decisions & risks

- **Trailing-rest Del rejected with toast** instead of GP's silent re-pad — deliberate divergence for feedback + clean undo history. R on a rest = feedback no-op (undo covers restore).
- Bar navigator renders one button per bar — windowing deferred unless QA shows lag on ~300-bar scores.
- Round-trip data loss (B5) is strictly test-driven — no speculative field re-application.
- If the A6 matrix reveals a systemic cause for "none of the functions work" (e.g. focus guard eating keys), its fix jumps the queue as an extra TDD step before layout work.
