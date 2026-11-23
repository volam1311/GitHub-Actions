# Day 1 — Lab: Execution Model and the Trust Boundary

**Lecture:** [`../notes/day-01-execution-model-and-trust-boundary.md`](../notes/day-01-execution-model-and-trust-boundary.md)
**Time box:** about 4 hours (drills 90 min, mini-challenge 2.5 h)
**Ground rule:** every workflow starts with `permissions: {}` and reopens scopes per job. Work in a throwaway repo you control, on a branch named `day1`.

---

## Part A — Drills

### Drill 1: Name the definition ref

A repo has `ci.yml` on `main`, plus a modified copy on `feat/ci` that adds a `deploy` job. For each event, give (1) which ref's YAML runs, (2) whether secrets are available, and (3) whether a write token is possible:

| # | Event |
|---|---|
| A | `pull_request` from first-party `feat/ci` → `main` |
| B | `pull_request` from a **fork's** `feat/ci` |
| C | `pull_request_target` from that fork |
| D | `push` to `feat/ci` |
| E | `merge_group` while `feat/ci` is queued |
| F | `schedule` |

A row isn't finished if it says "it depends".

### Drill 2: Skip contagion

Build `gate → {unit-py, unit-r} → integration → publish`, plus a `notify` job that needs all of them.

- `gate` is skipped on draft PRs.
- `publish` never runs on PRs and never runs if `integration` was skipped.
- `notify` runs whenever the run wasn't cancelled, and exits non-zero on `main` if `publish` didn't succeed.

Prove it with run URLs for four cases: a draft PR, a ready PR, a green push to `main`, and a push to `main` with `integration` forced to `exit 1`.

### Drill 3: Concurrency that can't eat a deploy

Write `ci.yml` (cancels stale PR runs) and `deploy.yml` (push to `main`, `cancel-in-progress: false`).

- Make five rapid empty-commit pushes to a PR. Exactly one CI run should survive.
- Push to `main` twice. The first deploy must finish and the second must wait.
- Temporarily give both files `group: shared-lock` and observe that they serialize. Then write one sentence on what that tells you about the scope of a concurrency group.

### Drill 4: Expression vs shell

Start from `run: echo Title is ${{ github.event.pull_request.title }}`. Make a PR title that runs `touch /tmp/pwned` and paste the rendered step from the log. Then fix the step using `env:` and Python. Finally, explain in one paragraph why `"$TITLE"` in bash is better, but still unsafe if the next line is `eval`.

### Drill 5: Permissions and OIDC

Create three jobs: `checkout_only` (`contents: read`), `annotate` (writes a job summary or check run), and `oidc_ready` (`id-token: write`). In `oidc_ready`, assert that `ACTIONS_ID_TOKEN_REQUEST_URL` is non-empty, without printing it. Then remove `id-token: write` and show the assertion failing. Paste both run URLs.

### Drill 6: Strings across job boundaries

A `detect` job writes `{"pkg":["alpha","beta"]}` and `should_run=false` to `GITHUB_OUTPUT`. A `test` job expands the matrix with `fromJSON`. First compare `should_run == true` (no quotes) on purpose and record the result. Then fix it.

---

## Part B — Mini-challenge: a safe-by-construction CI library

**Scenario:** You run CI for an org with about 40 Python and R repos. Today, seven of them use `permissions: write-all`, three use `pull_request_target` with a head checkout, and release credentials are duplicated as repo secrets. Build the minimum org standard.

### Build

```text
gha-library/
  setup-python-project/action.yml     # composite: uv + lockfile-keyed cache
  .github/workflows/
    python-ci.yml                     # workflow_call: lint, test matrix, gate, report.json artifact
    pr-report.yml                     # workflow_call: the only trusted crossing
  docs/THREAT-MODEL.md
consumer-repo/
  .github/workflows/ci.yml            # ≤ 20 lines, adopts python-ci.yml pinned by SHA
  .github/workflows/pr-comment.yml    # on: workflow_run → calls pr-report.yml
```

### Hard constraints

| # | Constraint |
|---|---|
| C1 | `permissions: {}` at workflow scope everywhere |
| C2 | Every `uses:` pinned to a full SHA with a `# vX.Y.Z` comment |
| C3 | No `github.event.*` interpolated in any `run:` |
| C4 | No `secrets: inherit`; no `pull_request_target` head checkout |
| C5 | Cache key = lockfile + OS + toolchain version |
| C6 | Concurrency cancels stale PR runs, never `main` or `merge_group` |
| C7 | One stable `gate` check that reports even with `python-versions: '[]'` |

### Adversarial tests (record a run URL for each)

| # | Attack | Required outcome |
|---|---|---|
| A1 | Fork PR whose `conftest.py` prints env var names | Runs with a read-only token, and no secret resolves |
| A2 | PR title `$(touch /tmp/pwned)` | No file is created |
| A3 | `report.json` names a *different* PR number | `pr-report.yml` rejects it loudly |
| A4 | `report.json` inflated to 50 MB | Rejected on size, before parsing |
| A5 | A matrix cell fails | The other cells finish and `gate` is red |

### THREAT-MODEL.md

Include: assets; an entry-point table (trigger, who can fire it, whose code runs, which credentials are reachable); a two-zone Mermaid diagram with every crossing justified; mitigations mapped to C1–C7; and residual risk.

### Questions to answer in writing

1. Why is `gate` a separate job rather than `fail-fast: true`? Answer in terms of both signal quality and the stability of the required check.
2. A consumer wants to pass a PyPI token into your library. Why do you refuse, and what do you offer instead?
3. Write your exact `cancel-in-progress` boolean, and give its value for `pull_request`, push to `main`, `merge_group`, and `workflow_dispatch`.

### Grading

| Dimension | Weight |
|---|---|
| Security: no untrusted path reaches a credential, and the threat model matches the code | 35% |
| Correctness: C1–C7 hold, and A1–A5 behave as required | 30% |
| Operability: stable gate name, one-file adoption | 20% |
| Transfer: another engineer can adopt it from the README alone | 15% |

**Automatic fail:** `github.event.*` inside `run:`, `@main` in a job that holds a secret, or a `pull_request_target` head checkout.
