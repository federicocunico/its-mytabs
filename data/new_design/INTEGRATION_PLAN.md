# MyTabs Studio — UI Redesign Integration Plan

Target repo: `federicocunico/its-mytabs` (Vue 3 + Vite + Deno, alphaTab rendering, Bootstrap-Vue-Next).
Design reference: `MyTabs Studio.dc.html` in this project. Goal: replace the scrolling-page player (`Tab.vue`) and editor (`TabEditor.vue`) with **one shared Guitar-Pro-style app shell** — fixed top bar, left rail, white scrolling score, right mixer, docked bottom transport — driven by the existing alphaTab API and editor controllers. **No changes to playback/editing logic are required**; this is a presentation-layer refactor that re-slots existing state and methods into new components.

The score itself keeps rendering via alphaTab. The mockup draws a fake sheet with HTML — in the real app that whole center pane is the alphaTab container. Everything around it is the redesign.

---

## 1. New shell layout (the core change)

Both pages currently use a normal document flow with a `position: fixed` floating toolbar. Replace with a fixed CSS-grid shell that never scrolls; only the score pane scrolls.

Create `frontend/src/components/shell/StudioShell.vue`:

```
grid-template-rows:    54px 1fr 134px;   /* top / body / transport */
grid-template-columns: 236px 1fr 300px;  /* leftRail / score / mixer */
grid-template-areas:   "top  top   top"
                       "left score right"
                       "bot  bot   bot";
position: fixed; inset: 0;   /* full viewport, no page scroll */
```

Slots: `#top`, `#left`, `#score`, `#right`, `#bottom`. Both `Tab.vue` and `TabEditor.vue` compose the same shell and fill the slots; a `mode` prop (`"player" | "editor"`) swaps the left-rail content and toggles the editor status strip. This unifies the two screens the user asked for.

- Remove `.main { width:95%; margin:… }` page layout from `Tab.vue` and the `.tab-editor` flex/`margin-bottom:110px` hacks from `TabEditor.vue`.
- The alphaTab container (`ref="bassTabContainer"` / `ref="atContainer"`) becomes the `#score` slot content.
- Kill `toolbarAutoHide` / `auto-hide` behavior — the docked transport is always visible in the shell.

### Design tokens (add to `styles/vars.scss`)
```scss
$app-bg:      #0d1015;  $panel-bg:  #14181e;  $rail-bg:   #12161b;
$panel-2:     #1b2027;  $border:    #242b33;  $border-2:  #2b333d;
$score-bg:    #191d23;  // dark padding AROUND the white sheet
$text:        #c7ced7;  $text-muted:#7c8794;  $text-faint:#5f6b78;
$accent:      #5b6ef5;  // indigo (replaces old #3131c6 $primary — modernized)
$play-green:  #1f9d55;  $playhead:  #f4a52b;  $mute-red:  #d23b34;  $solo-amber:#f4a52b;
$radius:      8px;      // (raise Bootstrap $border-radius 3px -> 8px)
```
Fonts: **IBM Plex Sans** (UI), **IBM Plex Mono** (numerics/timecodes/frets), **Spectral** (the engraved sheet title/tempo). Add the Google Fonts `<link>` to `index.html`.

---

## 2. The white score sheet (hard requirement)

The user requires the notation to **always sit on white**, independent of dark chrome.

- In the `#score` slot: dark pane (`$score-bg`) with padding; inside it a centered **white card** (`background:#fff; border-radius:6px; box-shadow:0 8px 40px rgba(0,0,0,.4); max-width:900px`). The alphaTab container renders into this white card.
- In `Tab.vue::buildDisplayResources` / `alphatab-shared.ts`, force the notation display resources to a light palette (black staff/notes) regardless of the `scoreColor` / dark-mode setting. Retire the `scoreColor: "light"` full-page tint path — the sheet is white by definition now.
- Keep `overrideHiddenStaves()` and the `staveProfile` logic exactly as-is. The **View** control (Tab / Score+Tab) in the player left rail maps to the existing `setting.scoreStyle` → `getStaveProfile()`.

---

## 3. Top bar  (replaces `EditorToolbar.vue` + `Tab.vue` header/`<h1>`)

Left→right: back button (`$router` to library) · app mark · **song title + artist** (from `tab.title` / `tab.artist`, was the centered `<h1>/<h2>`) · **key / tempo / time-sig badges** (`keySignature` from `getKeySignature()`, tempo from `masterBars[0].tempoAutomations`, TS from the master bar) · flexible gap · **Player | Edit segmented switch** · undo/redo (editor only — wire to existing `dispatch('undo'|'redo')`, `state.canUndo/canRedo`) · **Save** (green; `save()` + `state.dirty`/`saving`, keep the dirty-dot indicator) · overflow menu (Tracks…, Download .gp, Shortcuts — the existing `BDropdown` items).

The Player/Edit switch replaces the current `editScore()` / `exit` navigation: it routes between `/tab/:id` and `/tab/:id/editor` (preserving `?track=`), so the two live as one shell.

---

## 4. Left rail

**Editor mode** — port `EditorSidebar.vue` almost verbatim; it already emits the right command ids. Restyle into color-accented groups (each group header gets a colored dot):
- Duration (`DurationPicker` → chips `1 2 4 8 16 32` + dot) → `setDuration`/`toggleDot`.
- Note Effects (accent indigo) — `H PM LR X ( ) Stac. Bend Sl. Sl.leg Vib Harm > Trill` → existing `toggleHammer`… commands; active state from the `fx` object already computed in `refreshUi()`.
- Beat Effects (accent amber) — `Tap Trem Grace`.
- Beat (accent teal) — `Rest Tie +Beat −Beat`.
- Bar (accent purple) — `+Bar Append −Bar Bar…`.
Keep the keyboard-shortcut hint chips.

**Player mode** — new `SectionsNav.vue`: list `masterBars[*].section` groups with a color dot, name, and bar range; click → `api.tickPosition = firstBeat.absoluteDisplayStart` of that section (reuse the pattern in `playFromFirstBarContainingNotes`). Below it, the **View** toggle (`scoreStyle`) and a **Color notes** switch (toggles the `noteColor` setting → re-run `applyColors`).

---

## 5. Right rail — Mixer  (persistent version of `Tab.vue`'s track-list dropdown)

Promote the existing `showTrackList` dropdown into an always-docked panel. Reuse the existing methods directly — no new playback code:
- `tracks[]` (built in `scoreLoaded`, `getInstrumentName(program)`) → one card per track.
- **Color chip** per track from a shared track-color palette; **instrument sub-label** from `getInstrumentName`.
- **S / M** buttons → `toggleSolo(id)` / `toggleMute(id)` (state from `soloTrackID` / `muteTrackList`). Selecting a card = `changeTrack(id)` (respect the drum re-render path already in `changeTrack`). Highlight the selected track with a colored inset border.
- **Volume slider** → `toggleVolume(id, value)` (`api.changeTrackVolume`), `accent-color` = the track color.
- **Master** slider at top → `api.masterVolume`.
- Optional live VU bars: drive height from `api.player` activity or just animate while `playing` (as in the mockup).

The current audio-source dropdown (Synth / Backing Track / YouTube / audio files / No Audio) moves to the **bottom-left of the transport** (see §6); keep all `audioSynth/audioBackingTrack/audioYoutube/audioFile` handlers and the YouTube/`<audio>` element mounting — just reposition. The YouTube player iframe can dock above the transport as it does now (`player-container`), or in a collapsible corner.

---

## 6. Bottom bar — multi-track BAR navigator  (the headline element)

**Not a waveform.** Per the reference (Guitar Pro global/track view), the docked bottom bar is a **bar-based multi-track grid**: one row per track, columns = bars, colored blocks marking which bars each track plays in. Navigation is by bar, not by audio position. Structure: a track panel on the far left (frozen), a bar grid to its right, a transport control row below.

**The grid** (`TrackNavigator.vue`):
- **Bar ruler** across the top: bar numbers (every 2 bars), rendered as equal-width flex cells so they line up with the grid columns. Build columns from `masterBars.length`; each column can be `boundsLookup.findMasterBarByIndex(i)`-width if you want true proportional bar widths, or equal width (simpler, matches mockup).
- **Section lane** (thin, under the ruler): each bar tinted by its section color; section name at its start bar. Sections come from `masterBars[*].section`.
- **Track rows**: left label cell (`position:sticky; left:0`) = track index + color chip + name (dimmed + strikethrough when muted, with small `M`/`S` flags mirroring mixer state); clicking the label selects the track (`changeTrack`). To its right, one cell per bar — filled with the **track color** where that track has notes in that bar, empty otherwise. Dim the block when the track is muted/not-audible. **Clicking any bar cell seeks there**: `api.tickPosition = masterBar-first-beat.absoluteDisplayStart` (bar navigation — the user's explicit ask).
- Build the per-track-per-bar "has notes" matrix once from the score (`staves[0].bars[bi].voices[*].beats[*].notes.length`). In the mockup it's a generated presence matrix.
- **Playhead**: a single vertical white line spanning all rows at `currentBar / barCount` (compute the current master-bar from `api.tickCache` / `tickPosition`), `transition:left .1s linear`. Frozen left panel stays above it (`z-index`).
- Track colors reuse the mixer palette (§7). This is a navigation + arrangement-overview surface; the detailed mixing controls stay in the **right rail mixer** (§5) — the two share track state so mute/solo/selection stay in sync. No volume/solo/mute controls are duplicated into the bar rows (only read-only `M`/`S` flags).
- Loop: when `isLooping`, shade the looped bar span (from `api.playbackRange` mapped to bar indices).

**Editor status strip** (editor mode only, thin line between the two rows): port `EditorStatusBar.vue` — `Bar x/N · Beat n · String s (name) · Dur · Fill x/y` with the color-coded fill warning. Data already in `status` from `refreshUi()`.

**Row 2 — controls**:
- Left: **audio-source** button/dropdown (from §5).
- Center transport cluster: to-start, **Play/Pause** (big, green→amber when playing; `playPause()` / `playing`), to-end, **Loop** (`loop()`/`isLooping`), **Metronome** (`metronome()`/`enableMetronome`), **Count-in** (`countIn()`/`enableCountIn`). Disable metronome/count-in when `currentAudio !== "synth"` as today.
- Right: **Speed** control — replace the number input with a slider + % readout bound to `speed` (keep the 20–1000 clamp + `speedActionBuffer`).

Keep the `keyEvents` handler (Space / arrows / S / ↑) unchanged.

---

## 7. Color coding — make it a shared system

The string→color map already lives in `Tab.vue::applyColors()`:
`1 #bf3732 · 2 #fff800 · 3 #0080ff · 4 #e07b39 · 5 #2A8E08 · 6 #A349A4`.

- Extract it to `frontend/src/styles/colors.ts` as `STRING_COLORS` and import it in `applyColors()` (unchanged behavior) **and** in the UI (mixer chips can use a separate track palette; the score keeps string colors).
- For white-background legibility, use the slightly darkened variants for on-sheet fret numbers: `2 → #c98a00`, `3 → #1173d4` (keeps `#fff800` only for the dark-legacy path). The current `scoreColor==="light"` branch already darkens yellow — reuse that intent since the sheet is now always white.
- Keep `applyColors` respecting `setting.noteColor` (`none` / `louis-bass-v` / default) and the tuplet green beams.
- Track colors (mixer): `Lead #5b6ef5 · Rhythm #14b8a6 · Bass #f4a52b · Drums #a855c9` — a distinct palette from string colors so the two codings don't collide.

---

## 8. Suggested file changes

| Action | File |
|---|---|
| New shell (grid + slots) | `components/shell/StudioShell.vue` |
| New player left rail | `components/player/SectionsNav.vue` |
| New docked mixer | `components/player/MixerPanel.vue` (from `Tab.vue` track-list) |
| New bar navigator (track grid) | `components/player/TrackNavigator.vue` + transport controls |
| Refactor to use shell + slots | `pages/Tab.vue`, `pages/TabEditor.vue` |
| Restyle into color groups | `components/editor/EditorSidebar.vue` |
| Fold into top bar | `components/editor/EditorToolbar.vue` |
| Reuse as status strip | `components/editor/EditorStatusBar.vue` |
| Tokens + fonts | `styles/vars.scss`, `styles/main.scss`, `index.html` |
| Shared colors | `styles/colors.ts` (extract from `applyColors`) |
| White-sheet resources | `alphatab-shared.ts` (`buildDisplayResources`) |

## 8b. Panels — collapsible, resizable + track color

- **Every panel (left rail, right mixer, bottom navigator) collapses and resizes.** The shell (`StudioShell.vue`) owns the sizes: `leftW`, `rightW`, `bottomH` + `leftOpen`/`rightOpen`/`bottomOpen`, applied to the grid via `grid-template-columns/rows`. Persist them in `localStorage` (e.g. `mytabs-panel-*`) so the layout survives reloads.
- **Collapse**: a chevron button on each panel toggles open/closed. Closed = a ~46px rail (rails) or transport-only strip (bottom) with an expand chevron. The bottom stays functional when collapsed — the transport row is never hidden.
- **Resize**: a thin drag handle on each panel's inner seam (`cursor: col-resize` / `row-resize`); on `mousedown` attach `mousemove`/`mouseup` on `document`, clamp to sane min/max (left 190–440, right 230–480, bottom ≥120). Set `user-select:none` during drag.
- **Editable track color**: clicking a track's color chip/icon in the mixer opens a curated swatch palette (~10 presets). Selecting writes `track.color` in shared state → the navigator blocks, the mixer chip/slider `accent-color`, and (via a track-color map fed to `applyColors`) the on-sheet coloring all update together. Persist per-track colors in the tab config.

## 8c. Bar navigator density
- Cells are **fixed-width squares** (~26px), not flex-stretched bars — matches Guitar Pro's global view. The grid **scrolls horizontally** (`overflow:auto`) with the **track-label column frozen** (`position:sticky; left:0`) and the **bar ruler + section lane frozen on top** (`position:sticky; top:0`). Bar numbers every 4 bars.

## 9. Guardrails
- **Do not touch** `EditorController.ts`, `editor/mutations/*`, `keymap.ts`, `keyboard-controller.ts`, playback/sync logic (`initYoutube`, `initAudio`, `simpleSync`, `applyFlatSyncPoints`), or the alphaTab init options — only where noted (white resources). Reuse `dispatch()` and all existing command ids.
- Keep the alphaTab overlay elements (`editor-beat-cursor`, `editor-string-caret`, `editor-invalid-bar`) and their `boundsLookup` positioning — they render **inside the white sheet**, so verify z-index/stacking against the new white card.
- Preserve `localStorage` per-tab config keys (`tab-${id}-*`) and the leave-guard modal.
- Mobile: collapse the two rails into slide-over drawers; the transport stays docked.
```
