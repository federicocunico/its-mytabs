# User Guide

Complete guide to playing, syncing, and editing tabs in It's MyTabs.

## Table of contents

- [Getting started](#getting-started)
- [Tab player](#tab-player)
- [Audio sources & sync](#audio-sources--sync)
- [Player settings](#player-settings)
- [Player keyboard shortcuts](#player-keyboard-shortcuts)
- [Score editor](#score-editor)
- [Editor keyboard shortcuts](#editor-keyboard-shortcuts)
- [Tab management](#tab-management)
- [Sharing & URL parameters](#sharing--url-parameters)
- [Tips](#tips)

---

## Getting started

After logging in you land on the **Tabs** page — your personal library. Use the search box to filter by title or artist. Favorited tabs appear at the top; click the star on any tab to toggle it.

**New Tab** lets you:

- **Upload** Guitar Pro or MusicXML files (`.gp`, `.gpx`, `.gp3`, `.gp4`, `.gp5`, `.musicxml`, `.capx`)
- **Create Empty Bass Tab** or **Create Empty Guitar Tab** — opens the score editor directly

Uploaded tabs open in the player. Blank tabs open in the editor.

---

## Tab player

Opening a tab lands you in **MyTabs Studio** — a Guitar-Pro-style workspace: a top bar (song info, key/tempo/time-signature badges, **Player | Edit** switch), a left rail (sections + view options),
the score on a **white sheet** in the middle, a docked **mixer** on the right, and a **multi-track bar navigator** with the transport at the bottom. Only the score pane scrolls.

Every panel is collapsible (chevron buttons) and resizable (drag the seams); your layout is remembered across reloads.

### Left rail — sections & view

- **Sections** — the score's sections (Intro, Verse, Chorus…) with their bar ranges; click one to jump there.
- **View** — switch between **Tab** and **Score+Tab** notation.
- **Color notes** — toggle string-color coding of fret numbers on/off.

### Mixer (right rail)

One card per track:

- **Select** a card to display that track in the score
- **S** — solo (hear only that track) · **M** — mute
- **Volume** slider (percentage) per track, plus a **Master** slider at the top

### Bar navigator (bottom)

A Guitar-Pro-style arrangement overview: one row per track, one column per bar, with colored blocks where the track has notes and a section lane on top. **Click any bar cell to jump there.** The white
playhead line follows playback, muted/soloed tracks show `M`/`S` flags, and the loop range is shaded while looping.

### Playback controls (transport)

| Control           | Description                                                                 |
| ----------------- | --------------------------------------------------------------------------- |
| **Play / Pause**  | Start or stop playback (the button turns amber while playing)               |
| **⏮ / ⏭**         | Jump to the start / end of the score                                        |
| **Loop**          | Repeat the current [highlighted range](#looping-and-practice-ranges)        |
| **Metronome**     | Click track during playback (synth only)                                    |
| **Count in**      | One-bar count-in before playback (synth only)                               |
| **Speed**         | Playback-speed slider with % readout (20–1000%)                             |
| **Time**          | Current / total time readout                                                |
| **Restart range** | Appears when a range is highlighted — plays from the start of the selection |

### Looping and practice ranges

Click and drag on the tab to highlight a range of bars. When a range is selected:

- The **Restart** button appears in the toolbar
- **Loop** repeats only the highlighted section
- **↑** (Arrow Up) plays from the start of the highlighted range

If nothing is highlighted, **↑** and **S** jump to the first bar with notes (with a 2-bar lead-in).

### Audio source

Click the audio-source button at the **bottom-left of the transport** to choose:

| Source                     | Description                                                               |
| -------------------------- | ------------------------------------------------------------------------- |
| **Synth**                  | Built-in MIDI synthesizer — mute/solo individual tracks                   |
| **Embedded Backing Track** | Backing track embedded in the Guitar Pro file (if present)                |
| **YouTube**                | Synced YouTube video (add videos via **Details → Youtube & Audio files**) |
| **Audio file**             | Uploaded `.mp3`, `.ogg`, or `.flac` file                                  |
| **No Audio (Mute)**        | Silence all audio                                                         |

When YouTube or an audio file is active, a **Sync Offset** field appears below the player so you can fine-tune timing while listening (logged-in users only; changes are saved automatically).

### Edit & details

When logged in:

- **Edit** (top-bar Player | Edit switch) — open the built-in score editor for the current track (drum tracks cannot be edited yet)
- **⋮ menu** (top bar) — **Tab details…** (info, tab file) and **Youtube & audio files…** (audio sources, sync settings)

---

## Audio sources & sync

Add YouTube videos and audio files from **Details → Youtube & Audio files** (`/tab/:id/edit/audio`).

### Simple sync

Best for songs with a steady tempo and a correct BPM in the tab file.

Set **1st Bar Start Point** to the time (in seconds) where bar 1 of the tab should align with the audio. You can adjust this live on the player page via **Sync Offset**.

### Advanced sync

For songs that drift or have tempo changes. Define sync points bar by bar using alphaTex syntax:

```
\sync {Bar} {Occurrence} {Offset}
```

| Field          | Meaning                                   |
| -------------- | ----------------------------------------- |
| **Bar**        | Bar index, starting at 0                  |
| **Occurrence** | Which time this bar appears (for repeats) |
| **Offset**     | Position in the audio, in milliseconds    |

Example:

```
\sync 0 0 36
\sync 16 0 35425
```

You can generate sync points visually with the [AlphaTab Playground](https://alphatab.net/docs/playground).

### YouTube tips

- YouTube may not work on private IP addresses (e.g. `192.168.x.x`). Use `localhost` or a public hostname instead.
- Only `www.youtube.com` and `music.youtube.com` URLs are accepted.

---

## Player settings

Open **Settings** from the navigation bar. Changes are saved to your browser automatically. You can also **Load from Server** / **Save to Server** to sync preferences across devices.

### Tab player

| Setting                | Options                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| **Style**              | Tab, Score, Tab + Score, Horizontal Tab                          |
| **Display Scale**      | 80% – 300%                                                       |
| **Scroll**             | Scroll, Off, Smooth Scroll (forced to Smooth for Horizontal Tab) |
| **Show Key Signature** | Yes / No                                                         |

The notation always renders on a white sheet inside the dark Studio chrome, so there is no separate light/dark score-color setting anymore.

### Assists

| Setting          | Options                                           |
| ---------------- | ------------------------------------------------- |
| **Note Color**   | No Color, Rocksmith 2014, Louis' 5-string Bass    |
| **Cursor Style** | No Cursor, Cursor (Smooth), Cursor (Instant), Bar |

**Cursor (Instant)** is useful for checking whether sync points are correct — any lag between cursor and audio is easy to spot.

### Tab list

| Setting                  | Options  |
| ------------------------ | -------- |
| **Group tabs by Artist** | Yes / No |

---

## Player keyboard shortcuts

Shortcuts work on the tab player page. They are ignored while focus is in a text input (e.g. the sync offset field).

| Key       | Action                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Space** | Toggle play / pause                                                                                                                   |
| **←**     | Move to the previous bar                                                                                                              |
| **→**     | Move to the next bar                                                                                                                  |
| **↑**     | Restart — play from the start of the highlighted range; if nothing is highlighted, play from the first bar with notes (−2 bar offset) |
| **S**     | Play from the first bar with notes (−2 bar offset)                                                                                    |

---

## Score editor

Open the editor with **Edit Score** on the player page, or create a blank tab from **New Tab**.

The editor saves in Guitar Pro (`.gp`) format. Editing a `.gp3` / `.gp4` / `.gp5` / `.gpx` / MusicXML tab converts it to `.gp` on first save. A timestamped backup of the previous file is kept on the
server (up to 10 backups).

### Editor layout

The editor uses the same Studio shell as the player — top bar, left tool palette, white score sheet, mixer, bar navigator + transport. Differences in editor mode:

| Where            | Control                    | Description                                                            |
| ---------------- | -------------------------- | ---------------------------------------------------------------------- |
| Top bar          | **Player \| Edit** switch  | Return to the player (asks about unsaved changes)                      |
| Top bar          | **Undo / Redo**            | Step through edit history                                              |
| Top bar          | **Save**                   | Save to server (dot = unsaved changes)                                 |
| Top bar          | **⋮ menu**                 | Tracks…, Download `.gp`, keyboard shortcuts                            |
| Left palette     | **V1 / V2 / …**            | Switch voice when the bar has multiple voices                          |
| Left palette     | **Duration**               | Set note length and dots                                               |
| Left palette     | **Rest (R)** / **Tie (L)** | Toggle rest or tie to previous note                                    |
| Left palette     | **Note / Beat effects**    | Hammer-on, palm mute, bends, slides, vibrato, harmonics, tap, grace, … |
| Left palette     | **+Bar / Append / −Bar**   | Insert, append or delete bars                                          |
| Left palette     | **Bar…**                   | Edit the current bar (see below)                                       |
| Bottom navigator | Bar cells / track rows     | Jump the cursor to any bar; switch the edited track                    |
| Transport        | **Play**                   | Preview from the cursor                                                |

Every palette button shows its keyboard shortcut on a small chip — the same actions are available via [keyboard shortcuts](#editor-keyboard-shortcuts).

### Status strip

The thin strip above the transport shows the current bar/beat, string, pending fret digits, duration, and **bar fill** (how full the bar is vs. its time signature). Overfilled bars are shown in red.

### Bar settings (Bar…)

Edit properties of the bar at the cursor:

- Time signature (optionally apply to following bars)
- Tempo (BPM)
- Key signature and mode (major / minor)
- Repeat start and repeat count
- Triplet feel
- Section name (e.g. "Chorus")

### Tracks (Tracks…)

Open from the top-bar **⋮ menu → Tracks…** or the mixer's **Add track** button:

- **Switch** which track you are editing
- **Add** a new track (guitar or bass presets)
- **Remove** a track (at least one must remain)
- **Re-tune** the current track — choose a preset and capo. Changing the string count is only possible while the track has no notes.

### Unsaved changes

Leaving the editor with unsaved changes prompts for confirmation. The browser also warns on tab close.

---

## Editor keyboard shortcuts

Press **?** at any time in the editor to open the shortcut list. On macOS, use **Cmd** where **Ctrl** is listed.

### Fret entry

Type **0–9** on the main keyboard or the **numeric keypad** (with **NumLock on**) to enter a fret on the current string. Two digits typed in quick succession combine (e.g. **1** then **2** → fret 12).
Press **Esc** to cancel a pending digit.

**Guitar Pro–style workflow** for filling in a bar string by string:

1. Move to a beat with **←** / **→** (or click the tab).
2. Type a fret number on the current string.
3. Press **↑** / **↓** to move to another string **on the same beat** (chords / multi-string notes).
4. Type the next fret and repeat.
5. Press **→** to advance to the next beat.

With **NumLock off**, the numpad acts as navigation instead of digits (same as Guitar Pro): **2/4/6/8** move between strings and beats, **0** inserts a beat, **.** deletes a note, **+** / **−** change
duration.

### Playback

| Key             | Action                                 |
| --------------- | -------------------------------------- |
| **Space**       | Play / pause from the cursor           |
| **Shift+Space** | Play from the start of the current bar |
| **Esc**         | Cancel fret input / stop playback      |

### Navigation

| Key                      | Action                                                  |
| ------------------------ | ------------------------------------------------------- |
| **← / →**                | Previous / next beat (past the last beat appends a bar) |
| **↑ / ↓**                | Higher / lower string                                   |
| **Ctrl+← / Ctrl+→**      | Previous / next bar                                     |
| **Tab / Shift+Tab**      | Next / previous bar                                     |
| **Home / End**           | First / last beat of the bar                            |
| **Ctrl+Home / Ctrl+End** | Start / end of the score                                |

### Notes & rhythm

| Key                 | Action                          |
| ------------------- | ------------------------------- |
| **Del / Backspace** | Delete the note at the cursor   |
| **Shift+Del**       | Delete the whole beat           |
| **Ins**             | Insert a beat before the cursor |
| **R**               | Turn the beat into a rest       |
| **L**               | Tie to the previous note        |
| **+ / −**           | Longer / shorter note duration  |
| **.**               | Toggle dotted note              |

### Bars

| Key                | Action                              |
| ------------------ | ----------------------------------- |
| **Ctrl+Ins**       | Insert a bar before the current one |
| **Ctrl+Shift+Ins** | Append a bar at the end             |
| **Ctrl+Del**       | Delete the current bar              |

### Effects

| Key             | Action                                         |
| --------------- | ---------------------------------------------- |
| **H**           | Hammer-on / pull-off                           |
| **B**           | Bend (preset dialog)                           |
| **V**           | Vibrato (none → slight → wide)                 |
| **S / Shift+S** | Shift slide / legato slide                     |
| **P / I / D**   | Palm mute / let ring / staccato                |
| **X / O**       | Dead note / ghost note                         |
| **T / Shift+T** | Tapping / trill                                |
| **G**           | Grace note (none → before beat → on beat)      |
| **N**           | Harmonics (natural → artificial → pinch → tap) |
| **A**           | Accent (none → normal → heavy)                 |
| **Y**           | Tremolo picking (off → 8th → 16th → 32nd)      |

### Edit & file

| Key                       | Action                  |
| ------------------------- | ----------------------- |
| **Ctrl+Z**                | Undo                    |
| **Ctrl+Y / Ctrl+Shift+Z** | Redo                    |
| **Ctrl+C / X / V**        | Copy / cut / paste beat |
| **Ctrl+S**                | Save to server          |
| **Ctrl+Shift+S**          | Download as `.gp` file  |
| **?**                     | Show keyboard shortcuts |

> Browser-reserved shortcuts (Ctrl+W, Ctrl+T, etc.) are intentionally not bound.

---

## Tab management

From **Details** on the player page (`/tab/:id/edit/...`):

### Info

- Edit **Name** and **Artist**
- Set **Share to public** — public tabs can be viewed by anyone with the link (no login required)

### Youtube & Audio files

- Add/remove YouTube videos
- Upload audio files (`.mp3`, `.ogg`, `.flac`)
- Configure [sync settings](#audio-sources--sync) per source

### Tab file

- Replace the tab file with a new upload
- Open the tab folder on disk (desktop builds only)

From the **Tabs** list you can delete tabs (with confirmation) and favorite them.

---

## Sharing & URL parameters

Share a tab by copying its URL. Public tabs work without logging in.

You can deep-link specific track and audio sources with query parameters:

```
/tab/1?audio=youtube-VuKSlOT__9s&track=2
```

| Parameter | Description                                                              |
| --------- | ------------------------------------------------------------------------ |
| `track`   | Track index to display (0-based)                                         |
| `audio`   | Audio source ID — e.g. `synth`, `youtube-VIDEO_ID`, `audio-filename.mp3` |

Example live demo: https://its-mytabs.kuma.pet/tab/1?audio=youtube-VuKSlOT__9s&track=2

---

## Tips

- Use **Cursor (Instant)** in Settings to verify audio sync.
- **No Cursor** mode auto-scrolls the tab without a moving cursor — useful for learning to keep time without following a cursor.
- Count-in and metronome only work with the built-in synth.
- The bottom toolbar auto-hides when enabled in Settings — hover near the bottom edge to reveal it.
- Free tab sources: [Ultimate Guitar](https://www.ultimate-guitar.com/), [911Tabs](https://www.911tabs.com/),
  [MuseScore](https://musescore.com/sheetmusic?instrument=72%2C73&recording_type=free-download), [GProTab](https://gprotab.net/)
