import { defineConfig } from "@playwright/test";
import * as path from "node:path";

// Dedicated e2e port — 47777 is production/Docker, 47778 is the dev/manual
// verification server, backend unit tests also bind 47778.
const PORT = 47799;
const DATA_DIR = path.join(__dirname, ".data");

export default defineConfig({
    testDir: "./tests",
    fullyParallel: false,
    workers: 1,
    timeout: 180_000,
    expect: { timeout: 30_000 },
    use: {
        baseURL: `http://localhost:${PORT}`,
        // The synth needs to start without a user gesture in the test browser.
        launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
    },
    webServer: {
        // clean-data.mjs wipes DATA_DIR before the backend starts (the
        // webServer starts before globalSetup would run, so cleanup lives here).
        command: "node e2e/clean-data.mjs && deno run --allow-all backend/main.ts",
        cwd: path.join(__dirname, ".."),
        port: PORT,
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
            MYTABS_PORT: String(PORT),
            DATA_DIR,
        },
    },
});
