---
name: tabcraft-tab-formats
description: How TabCraft Studio's tab-format support, AlphaTab rendering, and the from-scratch score-editing engine (frontend/src/editor) and playback/sync engine (frontend/src/playback) fit together. Use this whenever the user wants to add or debug support for .gp/.gpx/.gp3/.gp4/.gp5/.musicxml/.capx files, fix a rendering or parsing bug reported against a real tab file, extend editor mutations (adding/editing bars, beats, notes, effects, track structure), work on MIDI/audio/YouTube sync in playback, or asks anything involving AlphaTab directly. Also use this before making non-trivial changes to the editor engine, since there are existing design specs that should be read first rather than re-deriving the design from scratch.
---

# TabCraft Studio tab formats & editor engine

TabCraft Studio doesn't parse `.gp`/`.gpx`/`.gp3`-`.gp5`/`.musicxml`/`.capx` itself — that's delegated to [AlphaTab](https://github.com/CoderLine/alphaTab), bridged in
`frontend/src/alphatab-shared.ts`. Instruments are identified from their General MIDI program number; drum tracks are detected via the drum channel, not a format-specific flag. Keep this division in
mind: a "this tab looks wrong" bug is usually one of (a) an AlphaTab rendering/parsing quirk, (b) our editor's mutation logic producing a malformed model, or (c) our playback sync logic — figure out
which layer before touching code.

## Read the design specs before non-trivial editor changes

`frontend/src/editor/` is a **framework-free, from-scratch** score-editing engine — it was deliberately built independent of Vue so the model/mutation logic can be unit-tested in isolation. Two design
docs cover why it's structured the way it is:

- `docs/superpowers/specs/2026-07-05-gp-editor-design.md` — the editor engine design (core model, mutations, effects, structure, keyboard/UI phasing).
- `docs/superpowers/specs/2026-07-07-track-manager-design.md` — adding, renaming, and removing tracks.

If a change is more than a small bugfix, skim the relevant spec first. If the change is significant enough to need its own design doc, follow the same convention — a dated file under
`docs/superpowers/specs/`.

## Where things live

| Concern                                                                                                        | Location                                                                                                   |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Cross-cutting AlphaTab setup/bridging                                                                          | `frontend/src/alphatab-shared.ts`                                                                          |
| Editor model, cursor, undo/redo, keymap                                                                        | `frontend/src/editor/{EditorController,EditorCursor,history,keyboard-controller,keymap,caret-geometry}.ts` |
| Structural edits (add/remove bar, beat, note, effect, track structure)                                         | `frontend/src/editor/mutations/{bar,beat,note,effects,structure}.ts`                                       |
| Validation / normalization of the in-memory model                                                              | `frontend/src/editor/{validation,normalize}.ts`                                                            |
| Save-back-to-`.gp` persistence                                                                                 | `frontend/src/editor/persistence.ts`                                                                       |
| Editor page shell — wires the editor engine to the UI, save/export flow, format-conversion confirmation dialog | `frontend/src/pages/TabEditor.vue`                                                                         |
| Track add/rename/remove/tuning dialog                                                                          | `frontend/src/components/editor/TrackManagerDialog.vue`                                                    |
| Other editor dialogs (bar settings, bend, duration picker)                                                     | `frontend/src/components/editor/{BarSettingsDialog,BendDialog,DurationPicker}.vue`                         |
| Backend tab storage/serving, save endpoint (`saveScore`)                                                       | `backend/tab.ts`                                                                                           |

**`frontend/src/playback/` is a test-and-fixtures directory, not an implementation directory** — `fixtures.ts` holds shared test fixtures, and `gp7-roundtrip.test.ts` / `json-roundtrip.test.ts` /
`midi-generation.test.ts` / `regressions.test.ts` are AlphaTab import/export roundtrip tests. The actual audio/YouTube-sync and MIDI-playback UI logic lives inline in
`frontend/src/pages/TabEditor.vue` and `frontend/src/components/shell/StudioTopBar.vue`, not in a separate playback module. If you're looking for "where sync actually happens," start in
`TabEditor.vue`, not `frontend/src/playback/`.

Most, but not all, editor modules are colocated with a `*.test.ts` file — `persistence.ts` and `test-utils.ts` are exceptions (glue/test-helper code). When you change a module that does have a test
file, update it rather than creating a separate ad-hoc test location.

**A bug reported as "I edited X in the studio and the saved file is wrong" almost always starts in a `.vue` file** (`TabEditor.vue` or a dialog under `components/editor/`), not in the headless engine
— the engine mutation functions (`mutations/*.ts`) are generally well-tested in isolation, but the Vue layer that calls them (deciding what to pass, what to default, what to show) is where state gets
lost or reset unexpectedly. For example, `TrackManagerDialog.vue` resets its tuning-preset field to a default every time it opens rather than reading the track's current tuning — check dialog
`watch`/`onMounted` handlers for this pattern before assuming the mutation or the AlphaTab roundtrip is at fault.

Structural edits (including retuning) also trigger a live, in-editor `Score → JSON → Score` round-trip via AlphaTab's `JsonConverter` (`frontend/src/editor/normalize.ts`, `rebuildScore`) immediately
when applied — a second round-trip mechanism distinct from the save-time `.gp` export, and a second place a value could get mangled.

## Adding a new mutation type

Follow the existing pattern in `frontend/src/editor/mutations/` — e.g. `beat.ts` for beat-level edits or `structure.ts` for track/section-level edits. Each mutation module pairs with `history.ts` for
undo/redo, so a new mutation needs to push a reversible entry, not just apply a forward change. Look at how `bar.ts` or `note.ts` records its undo step before writing a new one from scratch.

## Debugging a format/rendering bug against real files

`data/to_test/` contains ~200 real-world `.gp5`/`.gpx` files collected from actual users — this is the regression corpus for format-parsing and rendering issues, not synthetic fixtures. When a parsing
or rendering bug is reported:

1. Try to find or create a minimal `.gp*` file in `data/to_test/` (or a new small one) that reproduces it, rather than reasoning about the bug only from the AlphaTab API.
2. After a fix, don't just confirm the one reported file now works — a fix that's too narrow will regress other files in the corpus. Spot-check a few more files of the same format if the change
   touches shared parsing logic.
3. Run `deno task test-playback` and `deno task test-editor` (see `tabcraft-dev-workflow`) — `playback/regressions.test.ts` and `playback/gp7-roundtrip.test.ts` specifically exist to catch save/reload
   roundtrip regressions across formats.

## Save-back behavior

Editing always saves back as `.gp` (per the README), regardless of the original upload format — a `.musicxml` or `.capx` file that's edited in the studio becomes a `.gp` file on save. If a bug report
is "I edited a `.musicxml` file and now it's a different format," that's expected behavior, not a bug — the underlying model round-trips through AlphaTab's `.gp` export path
(`frontend/src/editor/persistence.ts`), it doesn't preserve the original container format.
