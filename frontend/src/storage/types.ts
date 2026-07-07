/** The editor's three visualization modes (mirrors alphatab-shared ViewMode). */
export type ViewMode = "tab" | "score" | "score-tab";

export interface YoutubeSync {
    videoID: string;
    syncMethod: "simple" | "advanced";
    simpleSync: number;
    advancedSync: string;
}

export interface AudioSync {
    filename: string;
    syncMethod: "simple" | "advanced";
    simpleSync: number;
    advancedSync: string;
}

/** Per-tab metadata persisted in .mytabs/index.json, keyed by the tab's relative path. */
export interface TabMeta {
    title?: string;
    artist?: string;
    favorite: boolean;
    viewMode: ViewMode;
    noteColorOn: boolean;
    youtube: YoutubeSync[];
    audio: AudioSync[];
}

export interface FolderEntry {
    /** Folder name (last path segment). */
    name: string;
    /** Relative path within the root. */
    path: string;
}

export interface TabEntry {
    /** File name including extension. */
    name: string;
    /** Relative path within the root. */
    path: string;
    title: string;
    artist: string;
    favorite: boolean;
    /** Lower-case extension without the dot, e.g. "gp". */
    ext: string;
}

export interface ProviderCapabilities {
    /** True when backed by a real user-visible disk folder (FSA), false for OPFS. */
    canBrowseDisk: boolean;
    /** True when the root survives reloads without re-picking. */
    persistent: boolean;
    /** Human label for the root, e.g. the folder name or "Browser storage". */
    rootLabel: string;
}

export interface StorageProvider {
    readonly capabilities: ProviderCapabilities;
    listFolder(path: string): Promise<{ folders: FolderEntry[]; tabs: TabEntry[] }>;
    readTab(path: string): Promise<{ bytes: Uint8Array; meta: TabMeta }>;
    writeTab(path: string, bytes: Uint8Array): Promise<void>;
    createFolder(path: string): Promise<void>;
    rename(path: string, newName: string): Promise<string>;
    move(fromPath: string, toFolder: string): Promise<string>;
    remove(path: string): Promise<void>;
    readMeta(path: string): Promise<TabMeta>;
    writeMeta(path: string, meta: Partial<TabMeta>): Promise<void>;
}
