import { supportedFormatList } from "../../../backend/common.ts";

const SCORE_EXTS = new Set(supportedFormatList.map((e) => e.toLowerCase()));

export function normalizeRelPath(path: string): string {
    return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function joinPath(dir: string, name: string): string {
    const d = normalizeRelPath(dir);
    return d ? `${d}/${name}` : name;
}

export function parentPath(path: string): string {
    const p = normalizeRelPath(path);
    const i = p.lastIndexOf("/");
    return i < 0 ? "" : p.slice(0, i);
}

export function basename(path: string): string {
    const p = normalizeRelPath(path);
    const i = p.lastIndexOf("/");
    return i < 0 ? p : p.slice(i + 1);
}

export function extname(name: string): string {
    const i = name.lastIndexOf(".");
    return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function stripExt(name: string): string {
    const i = name.lastIndexOf(".");
    return i < 0 ? name : name.slice(0, i);
}

export function isScoreFile(name: string): boolean {
    return SCORE_EXTS.has(extname(name));
}

export function isTextFile(name: string): boolean {
    return extname(name) === "txt";
}
