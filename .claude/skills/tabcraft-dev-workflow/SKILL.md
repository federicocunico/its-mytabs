---
name: tabcraft-dev-workflow
description: How to run, build, test, lint and format TabCraft Studio (the its-mytabs Deno + Vue repo) the way its CI expects. Use this whenever the user wants to start the dev server, run any test suite (backend, editor, playback, e2e), fix `deno fmt`/`deno lint`/`deno check` failures, diagnose a failing GitHub Actions run on deno-check.yml, or just says things like "run the app", "start dev", "run the tests", "make dev", or "why is CI red". Prefer this over guessing npm/node commands — this repo is Deno-first with a separate frontend Deno workspace, and the commands are not what you'd assume from a typical Vue project.
---

# TabCraft Studio dev workflow

TabCraft Studio (repo: `its-mytabs`) is Deno end to end: a Hono backend under
`backend/`, and a Vue 3 + Vite frontend under `frontend/` that is *also* run
through Deno tasks, not plain `npm`/`node`. The backend and frontend have
**separate `deno.jsonc` files and separate dependency installs** — this is
the single most common source of confusion, so always check which directory
a command needs to run from.

## Starting the app

Two equivalent paths — use whichever the user already has installed:

```bash
make dev     # installs backend + frontend deps, builds frontend once, then
             # runs backend + Vite concurrently with hot reload
```

or the raw Deno tasks it wraps:

```bash
deno install
cd frontend && deno install
deno task dev   # from repo root: build-frontend, then dev-server
```

**Dev URLs:** backend `http://localhost:47777`, Vite HMR
`http://localhost:5173`. During development, browse to the **Vite URL**
(`:5173`), not the backend port — the backend serves the last production
build, Vite serves the live-reloading one.

Before starting, make sure nothing else is already bound to `47777`
(a running Docker container, a leftover dev server) — the task will fail to
bind and the error is easy to misread as a code problem.

## Running tests

There are three independent test layers; run the ones relevant to what
changed, and all of them before anything that touches both backend and
frontend:

| Layer | Command | Notes |
|---|---|---|
| Backend (Deno) | `deno task test` or `make test-backend` | Binds port `47778` for integration-style tests — stop any dev server on that port first. Source: `backend/*_test.ts`. |
| Editor engine (Vitest) | `deno task test-editor` | Runs `frontend/src/editor/**/*.test.ts` — the framework-free score-editing engine (mutations, cursor, history, keymap). |
| Playback (Vitest) | `deno task test-playback` | Runs `frontend/src/playback/**/*.test.ts` — MIDI/roundtrip/regression tests. |
| Full frontend (Vitest) | `deno task test-frontend` | All frontend `*.test.ts`, not just editor/playback. |
| Backend + full frontend | `make test` | What most "run the tests" requests should map to. |
| E2E (Playwright) | `make test-e2e` | Builds the frontend, then runs Playwright smoke tests in `e2e/`. One-time setup: `npm install` and `npx playwright install chromium` inside `e2e/`. Binds port `47799`. |

Vitest is invoked as `deno run -A npm:vitest run` under the hood — if you
need to pass extra Vitest flags, replicate that invocation rather than
calling a bare `vitest`/`npx vitest`, since there's no local `node_modules`
binary outside what Deno's npm compat layer resolves.

## Formatting and linting — matching CI exactly

`.github/workflows/deno-check.yml` runs, in order: `deno task check` →
`deno task test` → `deno task install-frontend-deps` → `deno task
test-frontend`. Reproduce that sequence locally before pushing if you want
confidence CI will pass.

- **Check only (what CI runs):** `deno task check` — this is
  `deno fmt --check && deno lint && deno check && cd frontend && deno fmt
  --check`. It fails loudly on formatting drift, lint violations, or type
  errors, and does **not** modify files.
- **Auto-fix:** `deno task fmt` — this is `deno fmt && deno lint --fix && cd
  frontend && deno fmt`. Run this before `deno task check` if you just want
  a clean tree; note it does not run frontend lint, only frontend fmt.
- Formatting rules (from `deno.jsonc`): 4-space indent, semicolons, double
  quotes, 200-char line width — same in `frontend/deno.jsonc`. If a file was
  hand-formatted differently, `deno fmt` will rewrite it; don't fight the
  formatter's output.
- Root lint config excludes `prefer-const`, `no-process-global`,
  `require-await`, `no-unused-vars` from the `recommended` rule set — so
  don't flag those as lint issues yourself when reviewing code in this repo,
  they're intentionally off.
- **Frontend has no `deno lint` step or config at all** — `frontend/deno.jsonc`
  defines no `lint` block and no `tasks`. Both `deno task check` and CI only
  ever run `deno fmt --check` against `frontend/`, never lint. If someone
  reports "frontend lint is failing" or asks where the frontend lint config
  is, the real answer is that it doesn't exist — don't go looking for one.

## Common pitfalls

- **"Cannot find module" in the frontend** — almost always means
  `frontend/deno install` (or `deno task install-frontend-deps`) hasn't been
  run after a fresh clone or a dependency bump. The root `deno install`
  only covers the backend.
- **Port already in use on 47777** — a Docker container or another `deno
  task start` is still running. Stop it before `make dev`; the two will
  otherwise silently fight over the port.
- **Vitest commands run from the repo root fail to find test files** — they
  need `cd frontend` first (or use the `deno task test-*` wrappers, which
  already `cd frontend` for you).
- **A CI failure only reproduces from a clean checkout** — `deno.jsonc`'s
  root `exclude` list (`frontend`, `extra`, `e2e`, `data`,
  `.playwright-mcp`) means root-level `deno fmt`/`deno lint`/`deno check`
  never touch those directories directly; frontend formatting/linting is
  always driven by `cd frontend && deno fmt`/`lint` explicitly. If a check
  passes locally but fails in CI, verify you actually ran the frontend step
  and not just the root one.
