# It's MyTabs — convenience targets wrapping deno tasks.
# Requires Deno 2.4.4+ and make (Git Bash / WSL / Linux / macOS).
#
# Dev runs backend (http://localhost:47777) and Vite (http://localhost:5173)
# concurrently. Stop Docker/production containers on 47777 first if the port
# is already in use.

.PHONY: dev build install test test-backend test-editor test-playback test-e2e

# Install backend + frontend dependencies
install:
	deno install
	cd frontend && deno install

# Production frontend build (also installs deps)
build: install
	deno task build-frontend

# Development — build dist once, then backend + Vite hot reload in parallel
dev: install
	deno task build-frontend
	deno task dev-server

# All unit/integration tests: backend (Deno, binds 47778 — stop any dev
# server there first) + editor + playback (Vitest)
test:
	deno task test
	deno task test-frontend

test-backend:
	deno task test

test-editor:
	deno task test-editor

test-playback:
	deno task test-playback

# Browser smoke (Playwright, port 47799). Needs `npm install` +
# `npx playwright install chromium` in e2e/ once.
test-e2e:
	deno task build-frontend
	cd e2e && npx playwright test
