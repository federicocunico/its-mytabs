# Track Manager: add / remove / rename tracks

Date: 2026-07-07

## Problem

The editor's Track Manager is the only editor dialog still built on Bootstrap
(`BModal`, `table-dark`, `form-control`), while the rest of the app uses the
custom reka-ui + Tailwind kit under `components/ui/*`. This makes it look out of
place. Adding a track also *feels* broken: the Add button is disabled until the
user types a name, and once a track is added the handler immediately switches
the edited track, which closes the modal — so it looks like nothing happened.
There is no way to rename a track at all.

## Goals

- Rebuild `TrackManagerDialog.vue` on the reka-ui kit so it matches the app.
- Make **adding** a track reliable and visibly working.
- Keep **removing** a track working, with a confirm that lives inside the styled
  dialog (no `window.confirm`).
- Add **renaming** a track (new capability end-to-end: mutation → controller → UI).

## Non-goals

- No MIDI-program / general instrument overhaul — tracks stay stringed, chosen
  from the existing tuning presets.
- No changes to drag-and-drop track reordering (already implemented).
- No new alert-dialog dependency; the remove confirm is a lightweight two-step
  inline toggle.

## Design

### 1. Model layer — `editor/mutations/structure.ts`

Add:

```ts
export function renameTrack(score: Score, trackIndex: number, name: string): void
```

- Trim `name`; throw `EditorValidationError` if empty.
- Throw `EditorValidationError` if `trackIndex` is out of range.
- Set `track.name = trimmed` and `track.shortName = trimmed.slice(0, 10)`
  (mirrors `addTrack`, which sets both).

Unit test in `structure.test.ts`: renames a track; rejects an empty name and an
out-of-range index.

### 2. Controller — `editor/EditorController.ts`

Add:

```ts
renameTrackInScore(trackIndex: number, name: string): CommandResult
```

Wraps `renameTrack(this.score, trackIndex, name)` in
`this.transact(..., { structural: true, skipNormalize: true })`, matching the
other track operations. `structural: true` makes the rename undoable and
triggers the host refresh so the mixer / navigator / top-bar names update.

Unit test in `EditorController.test.ts`: rename updates the track name and is
undoable; an invalid name returns `{ ok: false }`.

### 3. UI — rewrite `components/editor/TrackManagerDialog.vue`

Convert to `<script setup lang="ts">` using
`@/components/ui/{dialog,input,label,button,select}`, mirroring
`NewTabDialog.vue`. Drop `BModal` and all Bootstrap classes.

- **Model:** `const open = defineModel<boolean>("open")`.
- **Props:** `tracks: { name: string; strings: number }[]`, `currentIndex: number`.
- **Emits:** `switchTrack: [i]`, `addTrack: [{ name, tuning, program }]`,
  `removeTrack: [i]`, `renameTrack: [i, name]`, `retune: [{ tuning, capo }]`.
- **`TUNING_PRESETS`** export stays (same data) — it is imported by the tests /
  callers if any.

**Track list rows** (one per track):
- The name is inline-editable. Local state `editingIndex` / `editingName`.
  Clicking the name (or a small pencil affordance) turns it into an `Input`;
  `Enter` or blur commits via `renameTrack` (only if changed and non-empty);
  `Esc` cancels. The current/edited track row is visually marked.
- String count (`{n} strings`).
- **Edit** button → `switchTrack(i)` (disabled for the current track).
- Remove **✕** with a two-step inline confirm: first click sets a local
  `confirmRemoveIndex`; the button then reads "Remove?" and a second click emits
  `removeTrack(i)`. Clicking elsewhere / another row resets it. Disabled when
  only one track remains.

**Add track** section:
- A reka-ui `Select` of `TUNING_PRESETS` (label → id).
- A name `Input` pre-filled from the selected preset's instrument label
  (e.g. "Guitar", "Bass"); changing the preset updates the name only while the
  user hasn't manually edited it.
- **Add** button (enabled when the name is non-empty). Emits
  `addTrack({ name, tuning: [...preset.tuning], program: preset.program })`.

**Re-tune current track** section: preset `Select` + capo `Input` (0–12) +
**Apply** button → `retune({ tuning, capo })`. Same behavior as today.

### 4. Wiring — `pages/TabEditor.vue`

- Change the binding to `v-model:open="showTracks"` and add
  `@renameTrack="renameTrack"`.
- New handler:
  ```js
  renameTrack(index, name) {
      const result = this.ctrl.renameTrackInScore(index, name);
      if (!result.ok && result.message) { notify({ type: "warn", text: result.message }); return; }
      if (index === this.trackIndex) this.trackName = name;
      this.openTrackManager(); // rebuild trackList so the row reflects the new name
  }
  ```
- **Fix add:** change `addTrack` so it does **not** close the dialog. After a
  successful `addTrackToScore`, make the new track the edited one
  (`ctrl.changeTrack(last)` + update `trackIndex` / `trackName`) and rebuild
  `trackList` (via `openTrackManager`) so the new track appears in the list,
  leaving `showTracks` true. The user closes the dialog or clicks **Edit** to
  jump into the new track.
- `removeTrack` keeps its behavior but no longer needs `window.confirm` (the
  dialog handles confirmation); it rebuilds the list via `openTrackManager`.

## Testing

- `structure.test.ts`: `renameTrack` happy path + two validation failures.
- `EditorController.test.ts`: `renameTrackInScore` updates the name, is
  undoable, and rejects an invalid name.
- Manual/visual: open the Track Manager, add a track (dialog stays open, track
  appears), inline-rename it, remove it via the two-step confirm.

## Risks

- reka-ui `Select` API: confirm the wrapper's usage against an existing consumer
  (e.g. `MoveDialog.vue` / `Settings.vue`) before wiring.
- If runtime testing shows add fails for a reason beyond the UX (e.g. a render
  error after `changeTrack`), switch to systematic-debugging before assuming the
  UX fix is sufficient.
