import childProcess from "node:child_process";
import process from "node:process";

/**
 * Dev server launcher.
 *
 * Runs the backend and the Vite frontend together (like the old inline
 * `concurrently` task), but derives the backend port from MYTABS_PORT instead
 * of hardcoding 47777 — so a dev backend can run on an alternative port when
 * 47777 is taken (e.g. by a production Docker container).
 *
 * The chosen port is also forwarded to Vite as VITE_BACKEND_PORT (unless
 * already set) so getBaseURL() in frontend/src/app.ts points API/socket
 * calls at the right backend.
 */
if (import.meta.main) {
    const port = process.env.MYTABS_PORT || "47777";

    const env = { ...process.env };
    if (!env.VITE_BACKEND_PORT) {
        env.VITE_BACKEND_PORT = port;
    }

    const result = childProcess.spawnSync("deno", [
        "run",
        "-A",
        "npm:concurrently",
        "-k",
        "-n",
        "backend,frontend",
        "-c",
        "blue,green",
        "deno task backend-dev",
        `deno run -A npm:wait-on tcp:127.0.0.1:${port} && deno task frontend-dev`,
    ], { stdio: "inherit", env });

    process.exit(result.status ?? 1);
}
