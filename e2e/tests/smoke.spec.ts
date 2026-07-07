import { expect, type Page, test } from "@playwright/test";
import * as path from "node:path";

/**
 * End-to-end smoke for the TabCraft Studio library + editor on client-side
 * storage: onboarding -> browser storage (OPFS) -> upload -> organize
 * (folder/rename/favorite/move) -> editor plays -> edit -> save -> state
 * persists across reload. Any console/page error matching the fatal patterns
 * (dead audio worklet, alphaTab internal errors) fails the run even if the UI
 * looks alive.
 */

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
    return consoleErrors.filter((line) =>
        FATAL_PATTERNS.some((p) => p.test(line))
    );
}

/** Wait until the given window-global alphaTab api is ready, then play and assert the tick advances. */
async function expectPlaybackAdvances(
    page: Page,
    apiGlobal: "api" | "editorApi",
) {
    await page.waitForFunction(
        (name) => {
            const api = (window as never as Record<
                string,
                { isReadyForPlayback?: boolean }
            >)[name];
            return !!api?.isReadyForPlayback;
        },
        apiGlobal,
        { timeout: 60_000 },
    );
    const advanced = await page.evaluate(async (name) => {
        const api = (window as never as Record<
            string,
            { play(): boolean; pause(): void; tickPosition: number }
        >)[name];
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

test("library smoke: onboard -> upload -> edit -> save -> organize -> persist", async ({ page }) => {
    watchPage(page);

    await test.step("onboarding offers browser storage and the library loads", async () => {
        await page.goto("/");
        await page.getByTestId("use-browser-storage").click();
        await expect(page.getByRole("button", { name: "New" })).toBeVisible();
    });

    await test.step("legacy URLs redirect home", async () => {
        await page.goto("/login");
        await page.waitForURL(/\/$/);
        await page.goto("/tab/1");
        await page.waitForURL(/\/$/);
    });

    await test.step("theme toggle persists across reload", async () => {
        await page.getByRole("button", { name: "Light theme" }).click();
        await expect(page.locator("html")).not.toHaveClass(/dark/);
        await page.reload();
        await expect(page.locator("html")).not.toHaveClass(/dark/);
        await page.getByRole("button", { name: "Dark theme" }).click();
        await expect(page.locator("html")).toHaveClass(/dark/);
    });

    await test.step("upload the smoke fixture", async () => {
        await page.getByTestId("upload-input").setInputFiles(
            path.join(__dirname, "..", "fixtures", "smoke.gp"),
        );
        await expect(page.getByText(/smoke/i).first()).toBeVisible();
    });

    await test.step("editor opens, renders and plays from a clean load", async () => {
        await page.getByText(/smoke/i).first().click();
        await page.waitForURL(/\/edit\?path=/);
        await page.waitForFunction(() =>
            !!(window as never as { editorApi?: { score?: unknown } }).editorApi
                ?.score
        );
        await expect(page.locator("canvas").first()).toBeVisible({
            timeout: 30_000,
        });
        await expectPlaybackAdvances(page, "editorApi");
    });

    await test.step("edit a note, play again (rebuilt MIDI), save to storage", async () => {
        await page.keyboard.press("5");
        await expect(page.locator(".tb-dirty")).toBeVisible({
            timeout: 10_000,
        });
        await expectPlaybackAdvances(page, "editorApi");
        await page.keyboard.press("Control+s");
        await expect(page.locator(".tb-dirty")).toBeHidden({ timeout: 15_000 });
    });

    await test.step("create a folder", async () => {
        await page.goto("/");
        await page.getByRole("button", { name: "New" }).click();
        await page.getByRole("menuitem", { name: "New folder…" }).click();
        await page.locator("#new-folder-name").fill("Rock");
        await page.getByRole("button", { name: "Create folder" }).click();
        await expect(page.getByRole("button", { name: "Rock" })).toBeVisible();
    });

    await test.step("rename the tab", async () => {
        await page.getByRole("button", { name: "Tab actions", exact: true }).click();
        await page.getByRole("menuitem", { name: "Rename…" }).click();
        await page.locator("#rename-input").fill("Smoke Renamed");
        await page.getByRole("button", { name: "Rename", exact: true }).click();
        await expect(page.getByText(/smoke renamed/i).first()).toBeVisible();
    });

    await test.step("favorite the tab; favorites view lists it", async () => {
        await page.getByRole("button", { name: "Add to favorites", exact: true }).click();
        await expect(
            page.getByRole("button", { name: "Remove from favorites", exact: true }),
        ).toBeVisible();
        await page.goto("/favorites");
        await expect(page.getByText(/smoke renamed/i).first()).toBeVisible();
        await page.goto("/");
    });

    await test.step("move the tab into the folder", async () => {
        await page.getByRole("button", { name: "Tab actions", exact: true }).click();
        await page.getByRole("menuitem", { name: "Move to…" }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("button", { name: "Rock" }).click();
        await dialog.getByRole("button", { name: "Move here" }).click();
        await expect(page.getByRole("button", { name: "Tab actions", exact: true }))
            .toBeHidden();
        // The tab is inside the folder now.
        await page.getByRole("button", { name: "Rock" }).click();
        await page.waitForURL(/dir=Rock/);
        await expect(page.getByText(/smoke renamed/i).first()).toBeVisible();
    });

    await test.step("everything persists across a full reload", async () => {
        await page.goto("/");
        await expect(page.getByRole("button", { name: "Rock" })).toBeVisible();
        await page.goto("/favorites");
        await expect(page.getByText(/smoke renamed/i).first()).toBeVisible();
    });

    expect(fatalErrors(), "no fatal playback errors in the console").toEqual(
        [],
    );
});
