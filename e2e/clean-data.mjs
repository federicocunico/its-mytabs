// Wipes DATA_DIR before the backend starts (chained in playwright.config.ts's
// webServer command — the webServer starts before globalSetup would run, so
// the fresh-state cleanup must happen here).
import * as fs from "node:fs";

const dataDir = process.env.DATA_DIR;
if (!dataDir) {
    throw new Error("DATA_DIR must be set for the e2e server");
}
fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });
