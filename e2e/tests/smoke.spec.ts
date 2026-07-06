import { expect, type Page, test } from "@playwright/test";
import * as path from "node:path";

/**
 * End-to-end playback smoke: register -> upload -> viewer plays -> editor
 * plays -> edit -> save -> viewer still plays. Any console/page error matching
 * the fatal patterns (dead audio worklet, alphaTab internal errors) fails the
 * run even if the UI looks alive.
 */

const EMAIL = "e2e@example.com";
const PASSWORD = "e2e-password-123";

const FATAL_PATTERNS = [
    /Audio Worklet creation failed/i,
    /\[AlphaTab\][^a-z]*\[?ERROR\]?/i,
    /InvalidStateError/,
    /Maximum call stack size exceeded/,
];

const consoleErrors: string[] = [];

function watchPage(page: Page) {
    page.on("console", (msg) => {
        if (msg.type() === "error" || msg.type() === "warning") {
            consoleErrors.push(msg.text());
        }
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
}

function fatalErrors(): string[] {
    return consoleErrors.filter((line) => FATAL_PATTERNS.some((p) => p.test(line)));
}

/** Wait until the given window-global alphaTab api is ready, then play and assert the tick advances. */
async function expectPlaybackAdvances(page: Page, apiGlobal: "api" | "editorApi") {
    await page.waitForFunction(
        (name) => {
            const api = (window as never as Record<string, { isReadyForPlayback?: boolean }>)[name];
            return !!api?.isReadyForPlayback;
        },
        apiGlobal,
        { timeout: 60_000 },
    );
    const advanced = await page.evaluate(async (name) => {
        const api = (window as never as Record<string, { play(): boolean; pause(): void; tickPosition: number }>)[name];
        const before = api.tickPosition;
        api.play();
        const start = Date.now();
        while (Date.now() - start < 15_000) {
            if (api.tickPosition > before + 100) {
                break;
            }
            await new Promise((r) => setTimeout(r, 250));
        }
        const after = api.tickPosition;
        api.pause();
        return after > before + 100;
    }, apiGlobal);
    expect(advanced, `${apiGlobal} playback tick should advance`).toBe(true);
}

test("full playback smoke: upload -> view -> edit -> save -> view", async ({ page }) => {
    watchPage(page);

    await test.step("register the admin account", async () => {
        await page.goto("/");
        await page.waitForURL(/register/);
        await page.getByRole("textbox", { name: "Email" }).fill(EMAIL);
        await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
        await page.getByRole("textbox", { name: "Repeat Password" }).fill(PASSWORD);
        await page.getByRole("button", { name: "Create" }).click();
        await page.waitForURL(/\/$/);
    });

    let tabPath = "";
    await test.step("upload the smoke fixture", async () => {
        await page.goto("/new-tab");
        await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "..", "fixtures", "smoke.gp"));
        await page.getByRole("button", { name: "Upload" }).click();
        await page.waitForURL(/\/tab\/\d+$/);
        tabPath = new URL(page.url()).pathname;
    });

    await test.step("viewer renders and plays", async () => {
        await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
        await expectPlaybackAdvances(page, "api");
    });

    await test.step("editor loads and plays from a clean load", async () => {
        await page.goto(`${tabPath}/editor`);
        await page.waitForFunction(() => !!(window as never as { editorApi?: { score?: unknown } }).editorApi?.score);
        await expectPlaybackAdvances(page, "editorApi");
    });

    await test.step("edit a note, play again (rebuilt MIDI), save", async () => {
        await page.keyboard.press("5");
        // dirty indicator appears once the fret buffer commits
        await expect(page.locator(".tb-dirty")).toBeVisible({ timeout: 10_000 });
        await expectPlaybackAdvances(page, "editorApi");

        const saveResponse = page.waitForResponse((res) => res.request().method() === "POST" && /\/api\/tab\/\d+\//.test(res.url()), { timeout: 30_000 });
        await page.keyboard.press("Control+s");
        expect((await saveResponse).status(), "save request should succeed").toBe(200);
        await expect(page.locator(".tb-dirty")).toBeHidden({ timeout: 10_000 });
    });

    await test.step("viewer still plays the edited tab", async () => {
        await page.goto(tabPath);
        await expectPlaybackAdvances(page, "api");
    });

    expect(fatalErrors(), "no fatal playback errors in the console").toEqual([]);
});
