---
name: tabcraft-release-deploy
description: How TabCraft Studio (its-mytabs) is versioned, packaged and deployed — bumping the version in deno.jsonc, building the Docker image/nightly image or a standalone binary, and understanding the Vercel prebuilt-output deploy pipeline that runs on every push to master. Use this whenever the user wants to "cut a release", "bump the version", "deploy", "build the Docker image", "publish a nightly", or is debugging why a Vercel deploy or GitHub Actions deploy job didn't run or failed. There is no CHANGELOG or git-tag based release process here — don't invent one; follow what's actually wired up.
---

# TabCraft Studio release & deploy

This project has a deliberately minimal release process: **no CHANGELOG, no git tags**. The only place a version lives is the `"version"` field in the root `deno.jsonc`. Deployment to production is
continuous — every push to `master` triggers a Vercel deploy automatically. Treat "release" here as "bump the version number, make sure checks pass, push" rather than a formal tagged-release ceremony,
unless the user explicitly asks you to introduce one.

## Bumping the version

Edit the `"version"` field in the root `deno.jsonc` (currently versioned independently of npm/package.json — there is no `package.json` version to keep in sync at the repo root). Past bumps are plain
commits like `"Update to 1.6.2"`; there's no automation for this, so just edit and commit.

Before pushing a version bump, run the same checks CI will run (see `tabcraft-dev-workflow`): `deno task check && deno task test`. A version bump that fails CI still triggers the Vercel deploy
workflow (it's on every push, not gated on the check workflow succeeding), so don't skip this step even though nothing technically blocks the push.

## Vercel deploy (automatic, on every push to master)

`.github/workflows/vercel-deploy.yml` runs on every push to `master`:

1. Installs Deno and frontend deps.
2. Builds the frontend with `deno task build-frontend` (**not** `vercel
   build`).
3. Manually assembles a Vercel **Build Output API v3** directory: copies `dist/` into `.vercel/output/static/`, writes a `config.json` with a filesystem-then-SPA-fallback route to `index.html`.
4. Installs the Vercel CLI and runs `vercel deploy --prebuilt --prod`.

**Why the manual assembly instead of `vercel build`:** Vercel's own build environment runs `npm run build`, which chokes on the `jsr:` imports used in `vite.config.ts` and AlphaTab's setup. Building
with Deno on the CI runner and uploading only the prebuilt static output sidesteps that entirely. If you're ever tempted to simplify this back to `vercel build` or `vercel --prod` without
`--prebuilt`, don't — that's the exact thing this pipeline was built to avoid, and it will fail on the `jsr:` imports.

**Required secrets:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. The workflow checks for these first — if any are missing, it logs a warning and **skips the deploy without failing the
job**. So "the deploy didn't happen" is not necessarily a broken pipeline; check whether those repo secrets are actually configured before debugging the workflow logic itself.
`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` come from `.vercel/project.json` after running `vercel link` once locally against the target Vercel project.

The workflow also sets `concurrency: { group: vercel-production,
cancel-in-progress: false }` — if two commits land on `master` in quick succession, the second deploy queues behind the first rather
than cancelling it, so a rapid string of pushes won't drop a deploy, just delay it.

## Docker

`Dockerfile` + `compose.yaml` always build the image **from source** — there is no prebuilt image published for the compose/docker-run path described in the README:

```bash
docker compose up --build       # foreground
docker compose up --build -d    # background
```

Tabs persist in `./data`, mounted into the container. Default port `47777`.

For a manual image build/push outside of compose:

```bash
deno task build-docker           # builds via extra/build-docker.ts
deno task build-docker-nightly   # builds AND pushes federicocunico/its-mytabs:nightly
```

`build-docker-nightly` is **not wired into any CI workflow** — it's a manual command that requires you to already be logged into Docker Hub (the tag `federicocunico/its-mytabs:nightly` has no registry
prefix, so it pushes to Docker Hub) before running it. Don't assume nightly images are published automatically; if the user wants that, it would be new work, not something to just trigger.

## Standalone binary

```bash
deno task build-binary   # deno task build-frontend, then extra/build-binary.ts
```

Produces a self-contained executable (x64/ARM64 supported per the README). Useful for users who don't want Docker or a Deno install.

## Runtime configuration

Whichever deploy path is used, these env vars (via `.env` or the host environment) control runtime behavior — mention them if a deploy "works but behaves wrong":

- `MYTABS_HOST` — bind address (default: all interfaces).
- `MYTABS_PORT` — default `47777`.
- `MYTABS_LAUNCH_BROWSER` — desktop/binary only, auto-opens a browser on start (default `true`).

## Release checklist (when asked to "cut a release" or "deploy")

1. Bump `"version"` in root `deno.jsonc` if this is a versioned release.
2. Run `deno task check && deno task test` locally (mirror CI).
3. Push to `master` — this alone triggers the production Vercel deploy. There is no separate "promote to prod" step.
4. Only if explicitly asked: build/push a Docker nightly image or a standalone binary — these are manual, disconnected from the push-to-master flow.
