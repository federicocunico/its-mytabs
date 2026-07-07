import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // alphaTab's entry point requires `window` at import time, so the
        // engine tests run under a DOM shim even though they never render.
        environment: "happy-dom",
        include: ["src/*.test.ts", "src/storage/**/*.test.ts", "src/editor/**/*.test.ts", "src/playback/**/*.test.ts"],
    },
});
