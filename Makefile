# It's MyTabs — convenience targets wrapping deno tasks.
# Requires Deno 2.4.4+ and make (Git Bash / WSL / Linux / macOS).
#
# Dev runs backend (http://localhost:47777) and Vite (http://localhost:5173)
# concurrently. Stop Docker/production containers on 47777 first if the port
# is already in use.

.PHONY: dev build install

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
