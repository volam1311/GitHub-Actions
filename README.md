# GitHub Actions — 4-Week Intensive Curriculum

Senior-track. Assumes fluency in Python and R. No CI primers, no YAML-as-a-language walkthroughs.

**Cadence:** 3 days/week × 4 weeks.

**How you use each day:**

1. Read the lecture in `week-NN/notes/day-0X-*.md` — that file is the teaching content.
2. Do the matching practice in `week-NN/activities/day-0X-*.md` — that file is the work you complete.
3. Every day has both, Day 3 included. The Day 3 lecture covers design judgment rather than mechanism, and its activity is the **Weekly Challenge** — a full synthesis project.

## Repository layout

Each week is a self-contained folder with two working trees:

| Path | Purpose |
|---|---|
| `week-NN/notes/` | Lecture content only. You read these. |
| `week-NN/activities/` | Practice for that same day. You do these. |

```text
.
├── README.md                          ← this file (syllabus + index)
├── week-01/
│   ├── README.md
│   ├── notes/
│   │   ├── day-01-scheduler-and-workflow-graph.md
│   │   ├── day-02-actions-reuse-and-trust.md
│   │   └── day-03-designing-the-trust-boundary.md
│   └── activities/
│       ├── day-01-workflow-graph-drills.md
│       ├── day-02-reuse-and-trust-drills.md
│       └── day-03-challenge-reusable-workflow-library.md
├── week-02/
│   ├── notes/
│   └── activities/
├── week-03/
│   ├── notes/
│   └── activities/
└── week-04/
    ├── notes/
    └── activities/
```

---

## Syllabus

### Week 1 — Execution Model, Composition, and the Trust Boundary

| Day | Read (`notes/`) | Do (`activities/`) |
|---|---|---|
| 1 | Scheduler internals and the workflow graph | Graph, event, and permission drills |
| 2 | Action types, reuse, and secret hygiene | Composition and pinning drills |
| 3 | Designing the trust boundary and the library API | **Weekly Challenge:** policy-grade reusable workflow library |

### Week 2 — Production CI for Python & R, Matrices, and Release Engineering

| Day | Read (`notes/`) | Do (`activities/`) |
|---|---|---|
| 1 | Language-native CI at production quality | Python/R CI drills |
| 2 | Release, promote, deploy | Release-train drills |
| 3 | Artifact integrity and promotion design | **Weekly Challenge:** release train for Python + R |

### Week 3 — Orchestration at Scale: Runners, Monorepos, and Merge Control

| Day | Read (`notes/`) | Do (`activities/`) |
|---|---|---|
| 1 | Self-hosted runners, scaling, and isolation | Runner topology drills |
| 2 | Monorepos, required checks, and merge queues | Merge-queue drills |
| 3 | Capacity planning and queue economics | **Weekly Challenge:** monorepo CI with merge queue and private runners |

### Week 4 — Enterprise Control Plane, Supply Chain, and Operating Actions as a Product

| Day | Read (`notes/`) | Do (`activities/`) |
|---|---|---|
| 1 | Org/enterprise governance and platform API | Governance drills |
| 2 | Hardening, attestations, and failure engineering | Incident drills |
| 3 | Operating Actions as an internal product | **Weekly Challenge:** Actions platform for a regulated org |

---

## Assessment standard (every challenge)

| Dimension | Pass condition |
|---|---|
| Correctness | Graphs, gates, and promotions cannot be bypassed by a crafted event |
| Security | Least-privilege tokens, pinned SHAs, no untrusted code on privileged triggers |
| Operability | Stable check names, observability hooks, failure isolation |
| Cost / latency | Explicit budget; matrix and cache choices justified |
| Transfer | Another senior engineer can adopt the workflows without a walkthrough |

---

## Start here

Open [week-01/notes/day-01-scheduler-and-workflow-graph.md](week-01/notes/day-01-scheduler-and-workflow-graph.md), then complete [week-01/activities/day-01-workflow-graph-drills.md](week-01/activities/day-01-workflow-graph-drills.md).
