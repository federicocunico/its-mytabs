import { describe, expect, it } from "vitest";
import { providerFromHandle, supportsFileSystemAccess } from "./select-provider.ts";
import { createFakeDirectory } from "./fake-fs.ts";

describe("select-provider", () => {
    it("reports File System Access support based on window.showDirectoryPicker", () => {
        const original = (globalThis as Record<string, unknown>).showDirectoryPicker;
        delete (globalThis as Record<string, unknown>).showDirectoryPicker;
        expect(supportsFileSystemAccess()).toBe(false);
        (globalThis as Record<string, unknown>).showDirectoryPicker = () => {};
        expect(supportsFileSystemAccess()).toBe(true);
        if (original === undefined) delete (globalThis as Record<string, unknown>).showDirectoryPicker;
        else (globalThis as Record<string, unknown>).showDirectoryPicker = original;
    });

    it("providerFromHandle sets capabilities from the flag and the handle name", () => {
        const p = providerFromHandle(createFakeDirectory("MyTabs"), true);
        expect(p.capabilities.canBrowseDisk).toBe(true);
        expect(p.capabilities.rootLabel).toBe("MyTabs");
        const opfs = providerFromHandle(createFakeDirectory("root"), false);
        expect(opfs.capabilities.canBrowseDisk).toBe(false);
    });
});
