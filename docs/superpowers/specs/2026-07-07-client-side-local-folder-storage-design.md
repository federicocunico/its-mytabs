# Client-side, local-folder storage + Drive-like library — Design

Date: 2026-07-07
Status: Approved (direction); pending spec review

## 1. Goal & context

Make It's MyTabs deployable as a (mostly) static site on Vercel, with tab data
stored in a **user-chosen local folder** via the browser File System Access API
instead of a server. Redesign the main/library page into a Drive/Dropbox/OneDrive-style
file browser: organize tabs in real folders, rename, move, delete, favorite.

Today the app is a Deno/Hono server with better-auth (SQLite) and filesystem
storage under `data/tabs/<id>/`. Crucially, the pieces that make this migration
feasible already exist client-side:

- Score **editing and export** run entirely in the browser (`EditorController.exportGp()` →
  `Gp7Exporter`). The server only stores the resulting bytes.
- alphaTab can render from **bytes in memory** (`api.load(bytes)`), not only from a URL —
  so the temp-token/file-URL dance is not needed client-side.
- Per-tab UI prefs (view mode, color notes, track, speed) already persist in `localStorage`.

Non-goals for this spec: multi-user, server-side sharing, cloud-provider bindings
(Dropbox/GDrive/OneDrive) — but the architecture must make cloud providers a
drop-in addition later.

## 2. Constraints & platform reality

- **The web cannot open the OS file manager** at a path, and the File System Access
  API does not expose a directory's full path (only its `name`). Therefore "open the
  folder on disk" is realized as an **in-app folder browser** (the redesigned library
  reads and shows the real folder contents live), plus a **Choose/Change folder** action.
  Native "reveal in Explorer/Finder" is only possible in a desktop wrapper (out of scope).
- **File System Access API (`showDirectoryPicker`, persistent `FileSystemDirectoryHandle`)
  is Chromium-only** (Chrome/Edge/Opera). Firefox and Safari do not support picking a
  real disk folder.
- Directory handles are **not** serializable but **are** structured-clonable and can be
  persisted in **IndexedDB**, then re-authorized with `handle.requestPermission()` on
  return visits.
- Vercel free tier: keep serverless functions at zero for this target (pure static).

## 3. Architecture — StorageProvider abstraction

The library and editor talk only to a `StorageProvider` interface; no component
references a specific backend. Path is a POSIX-style relative path within the root
(e.g. `Rock/Sweet Child.gp`).

```ts
interface StorageProvider {
  readonly capabilities: {
    canBrowseDisk: boolean;   // true for a real disk folder (FSA); false for OPFS
    persistent: boolean;      // survives reloads without re-picking
    rootLabel: string;        // folder name to show ("MyTabs", or "Browser storage")
  };

  listFolder(path: string): Promise<{ folders: FolderEntry[]; tabs: TabEntry[] }>;
  readTab(path: string): Promise<{ bytes: Uint8Array; meta: TabMeta }>;
  writeTab(path: string, bytes: Uint8Array): Promise<void>;

  createFolder(path: string): Promise<void>;
  rename(path: string, newName: string): Promise<string>;      // returns new path
  move(fromPath: string, toFolder: string): Promise<string>;   // returns new path
  remove(path: string): Promise<void>;                         // folder or tab

  readMeta(path: string): Promise<TabMeta>;
  writeMeta(path: string, meta: Partial<TabMeta>): Promise<void>;
}
```

Implementations:

- **LocalFolderProvider** — File System Access API. The default/Vercel provider.
  Root handle from `showDirectoryPicker()`, persisted in IndexedDB. `canBrowseDisk: true`.
- **OpfsProvider** — Origin Private File System, root from
  `navigator.storage.getDirectory()`. Firefox/Safari fallback. Same `FileSystemDirectoryHandle`
  API as FSA, so it shares almost all code with LocalFolderProvider; differs only in how
  the root handle is obtained and `canBrowseDisk: false` (persistent, browser-private,
  no disk transparency; "Choose folder" is hidden).
- **ServerProvider** *(retained, optional)* — wraps the existing Deno API so self-hosting
  keeps working. Not part of the Vercel build.
- **Future**: `DropboxProvider`, `GDriveProvider`, `OneDriveProvider` — added later with no
  changes to the UI or editor.

Provider selection at boot: prefer a previously-authorized LocalFolder (IndexedDB handle
+ granted permission); else on Chromium show "Choose a folder"; on non-Chromium fall back
to OPFS with a clear notice.

## 4. Data model & on-disk layout

The chosen root contains **real subdirectories** (organization) and **plain score files**
so the folder is a normal, portable tab collection openable in Guitar Pro:

```
MyTabs/                       ← chosen root (or OPFS root on Firefox/Safari)
├─ Rock/
│   └─ Sweet Child.gp
├─ Jazz/
│   └─ Autumn Leaves.gp5
├─ ハレの日に.gp
└─ .mytabs/                   ← app metadata (single hidden dir)
    ├─ index.json             ← per-tab metadata keyed by relative path
    └─ audio/                 ← imported audio (phase 3)
```

- **Folders = real directories.** Create/rename/move/delete map to directory operations.
- **A tab = a single score file** (`.gp/.gpx/.gp3/.gp4/.gp5/.musicxml/.capx`) at a path.
- **`TabMeta`** (in `index.json`, keyed by relative path): `favorite`, `viewMode`,
  `noteColorOn`, `title`/`artist` overrides (default parsed from file/name), `youtube[]`
  (videoID + sync), `audio[]` (filename + sync). Title/artist may be read from the score
  on first open and cached.
- **Reconciliation on load:** `listFolder` scans the directory and merges with `index.json`
  — newly-seen score files are adopted with default meta; index entries with no file are
  dropped/ignored. This mirrors the current server's config↔disk reconciliation and keeps
  the app robust to files moved/renamed outside the app.
- **Move/rename** update the file/dir on disk and rekey the affected `index.json` entries.

## 5. Library UI/UX (Drive-like)

Reuses the dark Studio chrome and existing components where possible.

- **Breadcrumb path bar** + optional **left folder tree**.
- **Grid (cards) / list toggle**; cards show title, artist, format/instrument hint,
  favorite star, and a context (⋯) button.
- **Toolbar:** New folder · Add tab (import a score file into the current folder) ·
  Choose/Change folder (Chromium only) · Search · Sort (name/artist/recent/favorite).
- **Selection + context menu** (right-click and ⋯): Open · Rename · Move to… · Delete ·
  Toggle favorite · Download. Multi-select for bulk move/delete.
- **Drag-and-drop** to move tabs/folders into folders.
- **Open** a tab → the editor (`/tab/...`), loading bytes via the provider.
- **Empty / no-folder state:** a prominent "Pick a folder to get started" that calls the
  picker (Chromium) or explains browser-storage mode (Firefox/Safari).
- **Permission-lost state:** if a persisted handle needs re-permission, show a
  "Reconnect folder" prompt (`requestPermission`).

Routing: the library replaces the current `Home.vue` at `/`. `login`/`register` routes and
the auth-gated flows are excluded from the static build.

## 6. Editor/player integration

- Loading: library passes the score **bytes** (from `provider.readTab`) to the editor,
  which calls `api.load(bytes)` (no server URL, no temp token). View-mode/color prefs come
  from `TabMeta` instead of the per-tab-id localStorage scheme (localStorage remains a
  fallback).
- Saving: `EditorController.exportGp()` → `provider.writeTab(path, bytes)`. The existing
  "convert non-.gp to .gp on save" flow is preserved: saving a non-`.gp` tab writes a new
  `.gp` file alongside and **leaves the original file untouched** (no data loss), then the
  library points at the new `.gp`. No timestamped backup chain (that was a server-only
  nicety); the user's own folder + optional download covers recovery.
- The editor route no longer requires auth.

## 7. Vercel deployment

- Build a **static SPA** (`vite build`) served by Vercel's static hosting; `vercel.json`
  with an SPA rewrite (all routes → `index.html`). No serverless functions.
- The Deno backend, better-auth, and server storage remain in the repo for self-hosting
  but are not part of the Vercel build. A build-time flag selects the default provider
  (LocalFolder for the static build; Server for self-host).

## 8. Browser support & fallbacks

| Browser | Provider | Disk folder | Persistent | "Choose folder" |
|---|---|---|---|---|
| Chrome/Edge/Opera | LocalFolder (FSA) | yes | yes (IndexedDB handle) | yes |
| Firefox/Safari | OPFS | no (browser-private) | yes | hidden; shows "browser storage" notice |

Feature-detect `window.showDirectoryPicker`. Provide a clear one-time notice on
non-Chromium explaining tabs are stored privately in the browser and can be exported.

## 9. Error handling

- **Permission denied / prompt dismissed:** stay on the empty/reconnect state; never crash.
- **Handle stale (folder moved/deleted):** detect on access, prompt to re-pick.
- **Write failures (disk full, locked file):** toast + keep the in-memory edit; do not mark saved.
- **Corrupt/unsupported score file:** skip in listing with a warning; do not abort the folder scan.
- **`index.json` malformed:** treat as empty and rebuild from disk (never block the library).

## 10. Testing

- **Unit (vitest):** path utilities, `index.json` reconciliation (adopt/drop/rekey), meta
  read/write, provider selection logic. Providers tested against a fake
  `FileSystemDirectoryHandle` and against **OPFS** in the happy-dom/browser test env.
- **Component:** library interactions (create/rename/move/delete, grid/list, drag-drop)
  with a mock provider.
- **E2E (Playwright, Chromium):** the real File System Access API is gated by a user
  gesture and not automatable headlessly; use OPFS in E2E to exercise the full provider
  path, plus mock the picker where needed. Cover: pick folder → import tab → open in editor
  → edit → save → reload → still present; create/rename/move/delete folders and tabs.

## 11. Scope & phasing (one spec, delivered in phases)

1. **Foundation:** `StorageProvider` interface; LocalFolder + OPFS providers; IndexedDB
   handle persistence + permission flow; client-side load (`api.load`) and save
   (`Gp7Exporter` → `writeTab`); Vercel static build + provider selection. Editor works
   end-to-end against a local folder.
2. **Library redesign:** the Drive-like browser (folders, rename/move/delete, grid/list,
   drag-drop, search, favorites) on top of the provider.
3. **Media in local mode:** YouTube sync (metadata-only) then local audio files
   (binary read → object URL), stored under `.mytabs/`.

Auth/register/login and the Deno server are retained for self-hosting but excluded from the
Vercel build.

## 12. Open questions resolved (assumptions, override anytime)

- **Backend fate:** keep both via the StorageProvider abstraction (not a hard replace).
- **On-disk layout:** plain score files in real folders + a single `.mytabs/index.json`.
- **"Open folder":** in-app browser + Choose/Change folder (native reveal not possible on web).
- **Firefox/Safari:** OPFS (persistent, browser-private) rather than import/export-only.
- **Audio:** phased after the library (YouTube first, then local audio).
