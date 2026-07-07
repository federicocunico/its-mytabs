import { describe, expect, it } from "vitest";
import { getProvider, setProvider, subscribe } from "./session.ts";
import { providerFromHandle } from "./select-provider.ts";
import { createFakeDirectory } from "./fake-fs.ts";

describe("storage session", () => {
    it("stores and returns the current provider, notifying subscribers", () => {
        let notified = 0;
        const off = subscribe(() => notified++);
        expect(getProvider()).toBeNull();
        setProvider(providerFromHandle(createFakeDirectory("X"), true));
        expect(getProvider()?.capabilities.rootLabel).toBe("X");
        expect(notified).toBe(1);
        off();
        setProvider(null);
        expect(notified).toBe(1); // unsubscribed
    });
});
