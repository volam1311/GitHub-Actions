# Day 2 — Lab: Production CI and a Release Train

**Lecture:** [`../notes/day-02-production-ci-and-release.md`](../notes/day-02-production-ci-and-release.md)
**Time box:** about 4.5 hours (drills 90 min, mini-challenge 3 h)
**Setup:** one repo containing a tiny Python package (`src/`, `pyproject.toml`, `uv.lock`) and a tiny R package (`DESCRIPTION`, `R/`, `tests/testthat/`). Reuse your Day 1 library where you can.

---

## Part A — Drills

### Drill 1: Frozen installs

Edit `pyproject.toml` to add a dependency **without** relocking, and push. Show that `uv sync --frozen` + `uv lock --check` fails the build. Then remove those flags and show that the build goes green while testing a dependency set no lockfile describes. Paste both run URLs.

### Drill 2: Predict the matrix

Before running anything, write down the cell count and the exact cells for the matrix in lecture §5. Then run it and compare. Next, rewrite it as `include`-only rows with identical cells.

### Drill 3: Dynamic matrix + empty guard

Write `plan_matrix.py`. It reads the supported Python versions from the `pyproject.toml` classifiers, emits only the oldest and newest on PRs and all of them on `main`, and writes `count`. Force it to emit `[]` and show that your guard skips `test` cleanly while `gate` still reports.

### Drill 4: Services without flakes

Add a Postgres service with **no** health check and a test that connects immediately. Run it 5 times and count the failures. Add `--health-cmd` and run it 5 more times. Record both counts.

### Drill 5: R cache correctness

Hand-roll an `renv` cache with a key that omits the R version, and run it on `release` then `oldrel-1`. Describe what happens. Fix the key (and remove `restore-keys`), then explain in two sentences why a partial R restore is worse than none.

### Drill 6: Flake arithmetic

Your suite has 1,200 tests and an observed whole-run flake rate of 30%. Estimate the per-test `p`. Then compute `P(green)` after quarantining the worst 10 tests, assuming they accounted for half of all flakes.

---

## Part B — Mini-challenge: dual-language release train

**Scenario:** The org ships a Python package and an R companion in lockstep versions (`1.4.0` for both), plus a container image. Today each one is built separately per environment, and a `PYPI_TOKEN` secret exists in 11 repos. Replace this with one release train.

### Build

```text
.github/workflows/
  ci.yml          # Python matrix + R check + gate (Day 1 pattern)
  build.yml       # on: push tags v*; ancestry check; builds dist/ + R tarball + image ONCE;
                  # SHA256SUMS; attest-build-provenance
  release.yml     # verify → staging → production → sinks
.github/scripts/
  publish_guard.py   # publish | skip | conflict
docs/RELEASE.md      # state machine, reproducibility level, rollback runbook
```

### Hard constraints

| # | Constraint |
|---|---|
| R1 | Artifacts built exactly once. No deploy job contains a build step |
| R2 | Digest verified at staging *and* production |
| R3 | PyPI via trusted publishing (environment `pypi`); R to an S3 `drat` repo via OIDC (stub the bucket if you have no cloud account); image to GHCR, deployed by digest |
| R4 | A `verify` job runs `gh attestation verify` with `--repo`, `--signer-workflow`, `--source-ref` before any publish |
| R5 | Order: draft release → GHCR → R repo → PyPI → publish the draft |
| R6 | Each sink is idempotent with publish/skip/conflict semantics |
| R7 | Production environment restricted to `v*` tags with required reviewers |
| R8 | No long-lived registry credentials anywhere |

### Failure tests (record a run URL for each)

| # | Scenario | Required outcome |
|---|---|---|
| F1 | Tag pushed on a commit that isn't on `main` | Build refuses, with a clear error |
| F2 | Artifact swapped between build and production (simulate by re-uploading) | Digest check fails the promotion |
| F3 | Artifact attested by a *different* workflow file | `verify` rejects it |
| F4 | R sink fails after GHCR succeeds | Release marked partial and an issue opened; re-run converges with GHCR `skip` |
| F5 | Re-run a fully released version | Every sink returns `skip`; run is green |
| F6 | Rebuild changes a byte, same version | `publish_guard.py` returns `conflict` and stops |

### Questions to answer in writing

1. Draw the state machine for *your* sinks and mark the point of no return.
2. State your reproducibility level and the evidence for it. If you claim L3, show the rebuild-and-compare job.
3. Lockstep or independent versions for the Python and R packages? Defend your choice.
4. Compute your lead time. Which term dominates, and what would you change first?

### Grading

| Dimension | Weight |
|---|---|
| Correctness: R1–R8 hold, and F1–F6 behave as required | 35% |
| Security: no long-lived credentials; verification actually constrains the signer | 30% |
| Operability: partial failures are loud and convergent; rollback runbook is tested | 20% |
| Cost / latency: measured lead time, and the dominant term identified | 15% |

**Automatic fail:** any rebuild in a deploy job, a `PYPI_TOKEN` secret, or publishing to PyPI before the production gate.
