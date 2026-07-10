# Project rules

## Monitor CI after a triggering push

Whenever a `git push` to `master` happens, don't consider the task done once the push succeeds — this repo has two `on: push` workflows in `.github/workflows/` (`deno-check.yml`, `vercel-deploy.yml`):

1. Poll the run status (`gh run list` / `gh run watch`, or the GitHub REST API `.../actions/runs` if `gh` isn't available — it isn't installed in this environment, use `curl` against the public API)
   until both reach a terminal state — don't just fire-and-forget.
2. If a run fails, fetch the failing job's logs (or, if log download 403s without auth, reproduce the failing step locally), diagnose the root cause, fix it, and repeat from step 1 (commit, push,
   monitor again) until both workflows are green.
3. Report the final state to the user either way — don't stay silent after a green run, and don't leave a red run unaddressed without saying so.

Prefer verifying a fix locally first rather than push-and-pray. This machine's working tree has Windows line-ending drift (`core.autocrlf`) against files not covered by `.gitattributes`, which makes
`deno fmt --check` report false positives locally that won't reproduce in CI (Ubuntu runner) — and can equally mask a real formatting bug as "just line endings." To get a trustworthy local read,
verify in a clean clone with autocrlf off:

```bash
git -c core.autocrlf=false clone -q --no-hardlinks . /path/to/scratch/repo
cd /path/to/scratch/repo
git -c core.autocrlf=false checkout -q -- .
deno task check && deno task test && deno task install-frontend-deps && deno task test-frontend
```

That sequence mirrors `deno-check.yml` exactly.
