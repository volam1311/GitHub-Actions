# GitHub Actions — 4-Day Intensive

Senior track. Assumes you're fluent in Python and R. There's no intro to CI and no walkthrough of YAML as a language.

**Cadence:** 1 week × 4 days. Budget about 1.5 h for the lecture and 4–5 h for the lab each day.

**How to use each day:**

1. Read the lecture in `notes/day-0X-*.md`.
2. Do the lab in `activities/day-0X-*.md`. Each lab has short **drills** (Part A) followed by a **mini-challenge** (Part B). Day 4's challenge is the capstone, which builds on everything from Days 1–3.

## Repository layout

```text
.
├── README.md                                   ← this file (syllabus + index)
├── notes/                                      lectures: read these
│   ├── day-01-execution-model-and-trust-boundary.md
│   ├── day-02-production-ci-and-release.md
│   ├── day-03-orchestration-at-scale.md
│   └── day-04-enterprise-control-plane.md
└── activities/                                 labs: do these
    ├── day-01-execution-and-trust-lab.md
    ├── day-02-ci-and-release-lab.md
    ├── day-03-scale-lab.md
    └── day-04-capstone.md
```

---

## Syllabus

| Day | Read (`notes/`) | Do (`activities/`) |
|---|---|---|
| 1 | [Execution model, composition, and the trust boundary](notes/day-01-execution-model-and-trust-boundary.md) | [Drills + **safe-by-construction CI library**](activities/day-01-execution-and-trust-lab.md) |
| 2 | [Production CI for Python & R, and release engineering](notes/day-02-production-ci-and-release.md) | [Drills + **dual-language release train**](activities/day-02-ci-and-release-lab.md) |
| 3 | [Orchestration at scale: runners, monorepos, merge queues, capacity](notes/day-03-orchestration-at-scale.md) | [Drills + **monorepo CI control plane**](activities/day-03-scale-lab.md) |
| 4 | [Enterprise control plane, supply-chain defense, and running Actions as a product](notes/day-04-enterprise-control-plane.md) | [Drills + **Capstone: Actions platform for a regulated org**](activities/day-04-capstone.md) |

**What each day covers:**

- **Day 1:** event ingress and definition refs, the job DAG and skip contagion, concurrency, expression injection, permissions, the three action runtimes, pinning, cache vs artifact, secrets and OIDC, threat modeling, and library API design.
- **Day 2:** lockfile-frozen Python and R CI, services, matrix engineering, honest change detection, flakes, the gate job, build-once promotion, trusted publishing, provenance verification, promotion as a state machine, and rollback.
- **Day 3:** runner isolation and ARC, affected-target computation, required-check stability, merge queues, queueing math, cost attribution, and budgets.
- **Day 4:** allow-lists, org rulesets and required workflows, choosing an identity, the platform API, cache poisoning, attestation gates, incident runbooks, SLOs, maturity, and designing for audit.

---

## Assessment standard (every challenge)

| Dimension | Pass condition |
|---|---|
| Correctness | Graphs, gates, and promotions can't be bypassed by a crafted event |
| Security | Least-privilege tokens, pinned SHAs, no untrusted code on privileged triggers |
| Operability | Stable check names, observability hooks, failure isolation |
| Cost / latency | Explicit budget; matrix and cache choices justified |
| Transfer | Another senior engineer can adopt the workflows without a walkthrough |

---

## Start here

Open [notes/day-01-execution-model-and-trust-boundary.md](notes/day-01-execution-model-and-trust-boundary.md), then complete [activities/day-01-execution-and-trust-lab.md](activities/day-01-execution-and-trust-lab.md).
