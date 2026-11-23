# Day 3 — Lab: Monorepo CI Control Plane

**Lecture:** [`../notes/day-03-orchestration-at-scale.md`](../notes/day-03-orchestration-at-scale.md)
**Time box:** about 4.5 hours (drills 75 min, mini-challenge 3+ h)
**Setup:** a monorepo with `packages/` containing at least `core`, `stats`, `io`, `models` (Python) and `report` (R, `Imports: stats`), wired as in the lecture's graph. Stub tests are fine.

---

## Part A — Drills

### Drill 1: Residue audit (paper)

You inherit a persistent self-hosted runner shared by 12 private repos. For each item in the residue table, write down one concrete attack *and* the single control that eliminates it. Then explain in two sentences why `--ephemeral` alone doesn't fix any of them.

### Drill 2: Labels vs groups

Design a runner layout for these pools: general CI, GPU, and production deploy. For each, give the labels, the group, the allowed repos, and whether public repos are allowed. Then show how a repo that can reach the GPU group could request the deploy labels if you'd relied on labels alone.

### Drill 3: Pool sizing

Your team has 25 engineers, each making 10 pushes a day with 6 jobs per push. Jobs average 5 minutes, the active window is 8 hours, and the midday peak is 3×. Compute `λ`, `a`, `c` at ρ = 0.65, and `c_peak`. Give ARC `minRunners` and `maxRunners` values and justify them with the `C_wait` vs `C_infra` argument.

### Drill 4: Critical path

Take an existing workflow of yours, draw its DAG with measured job times, and compute `T_wall`. Restructure it to flatten the critical path, run it again, and report the new `T_wall` along with the concurrent-runner cost.

### Drill 5: Hang a merge queue (deliberately)

In a repo with a merge queue and `gate` required, remove `merge_group` from `on:`, queue a PR, and record what happens. Restore it, and add a step that prints `github.sha`, `github.ref`, and whether `github.event.pull_request` exists. Paste that output from a queue run.

---

## Part B — Mini-challenge: monorepo CI control plane

### Build

```text
.github/
  scripts/
    graph.py          # graph from pyproject.toml + DESCRIPTION
    changed.py        # Day 2 detector, with merge_group support
    affected.py       # closure, longest-prefix, global invalidators, reason
    test_affected.py  # unit tests: closure, attribution, invalidators, empty set
  workflows/
    ci.yml            # thin entry: pull_request, push main, merge_group
    package-ci.yml    # workflow_call: python | r per package
    metrics.yml       # or a job: queued vs ran seconds → job summary
docs/BUDGET.md
```

### Hard constraints

| # | Constraint |
|---|---|
| M1 | `affected.py` is unit-tested, and those tests run in CI |
| M2 | A lockfile or `.github/` change tests every package |
| M3 | Exactly one required check (`gate`), green with zero affected packages and red when `plan` fails |
| M4 | `merge_group` handled; queue runs diff `base_sha..head_sha` and never touch `pull_request` context |
| M5 | `cancel-in-progress` is true only for `pull_request` |
| M6 | `max-parallel` set on the package matrix |
| M7 | Every run publishes a queued-vs-ran timing table |

### Scenario tests (record a run URL for each)

| # | Change | Required affected set |
|---|---|---|
| S1 | Edit `packages/core/…` | All five packages |
| S2 | Edit `packages/report/…` | `report` only |
| S3 | Edit `packages/stats/…` | `stats`, `models`, `report` (+ any other dependents) |
| S4 | Edit only `README.md` | None; `gate` green |
| S5 | Bump `uv.lock` | All packages (fail open) |
| S6 | Two queued PRs that conflict semantically | The second is ejected; `main` stays green |

### BUDGET.md

1. **Baseline decomposition:** measured `T_queue`, `T_start`, `T_setup`, `T_work`, and `T_fanin` for an S1 run and an S2 run. Name the dominant term.
2. **Runner topology:** hosted or ARC, with the pool size derived from your measured λ and T_s, and how deploys are protected from starvation.
3. **Budget table:** at least five inequalities, each tied to an enforcement mechanism.
4. **One explicit trade-off:** a constraint you relaxed, and why.

### Grading

| Dimension | Weight |
|---|---|
| Correctness: M1–M7 hold, and S1–S6 produce the required sets | 35% |
| Operability: stable gate, merge queue works, timings visible | 25% |
| Cost / latency: measurements, not guesses; dominant term correctly identified | 25% |
| Security: queue entry requires review; privileged runners separated | 15% |

**Automatic fail:** a matrix cell as a required check, path filters as the correctness mechanism, or a queue run that checks out the PR head.
