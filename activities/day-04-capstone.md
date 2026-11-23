# Day 4 — Capstone: Actions Platform for a Regulated Org

**Lecture:** [`../notes/day-04-enterprise-control-plane.md`](../notes/day-04-enterprise-control-plane.md)
**Builds on:** your Day 1 library, Day 2 release train, and Day 3 control plane
**Time box:** about 5 hours (drills 60 min, capstone 4 h)

---

## Part A — Drills

### Drill 1: The `on:` bug

Write a 10-line Python script that loads a workflow with `yaml.safe_load` and prints `doc.get("on")`. Explain the output. Fix it, then run your fixed lint against every workflow you wrote on Days 1–3. Fix whatever it finds.

### Drill 2: Pick the credential

For each of these needs, choose `GITHUB_TOKEN`, an App token, a PAT, or OIDC, and justify the choice in one line: comment on this repo's PR; push a digest bump to `config-repo`; assume an AWS deploy role; publish to PyPI; trigger CI in 12 consumer repos after a release; read a private package from another org repo.

### Drill 3: Ruleset in evaluate mode

Write an org ruleset JSON that targets `tier: production`, requires the `gate` check and a `security-baseline` required workflow, and has **no** bypass actors. Apply it in `evaluate` mode (or, without org permissions, write out the `gh api` command you would use) and describe what rule insights you would read before switching to `active`.

### Drill 4: Incident tabletop (timed: 15 minutes)

At 09:12 an advisory says `popular-org/setup-thing@v2` was retagged to malicious code between 02:00 and 08:45. Write the exact commands and decisions for the first 30 minutes: containment, inventory, the exposure window, which secrets to rotate and why, and what you check in cloud logs.

### Drill 5: Split or combine

Your lint job takes 40 s and is split into 4 parallel jobs, each with 25 s of overhead. Compute the wall time and billed time for 4 jobs vs 1, and state the break-even `T_work` for `k = 4`.

---

## Part B — Capstone

### Scenario

A financial-services org has 40 repositories (Python services, Python libraries, R analysis packages) and sits at maturity L1–L2. An auditor arrives in 8 weeks. You have three findings: PATs that belong to departed staff, an `issue_comment` ChatOps deploy bot, and no evidence of which commit produced any production artifact. Design and build the platform, and show that its controls hold.

### Build

```text
platform-policy/                 # policy as code
  rulesets/org-default.json      # tier-targeted, evaluate → active plan
  actions-allow-list.json
  runner-groups.json
  apply.py                       # applies the JSON via the API (dry-run flag required)
  .github/workflows/
    security-baseline.yml        # required workflow running policy_lint
    apply-policy.yml             # applies on merge to main, App token
policy_lint/                     # Day 4 lint + tests
gha-workflows/                   # your Day 1–3 library, versioned (v1.0.0)
repo-template-python-r/          # golden path: ~20-line ci.yml
docs/
  OPERATING-MODEL.md
  RUNBOOKS.md
  AUDIT-EVIDENCE.md
```

### Hard constraints

| # | Constraint |
|---|---|
| P1 | All org policy (rulesets, allow-list, runner groups) lives in git and is applied by CI, never by hand |
| P2 | `security-baseline` is a required workflow, and `policy_lint` catches all five canonical defects (with tests) |
| P3 | No PATs. Cross-repo automation uses an App token; cloud and registry access use OIDC bound to an environment |
| P4 | The ChatOps bot is replaced by a design where commenting can't reach a credential (document the new flow) |
| P5 | Production deploys verify attestations with repo + workflow + ref before deploying, by digest |
| P6 | Privileged jobs never restore caches (enforced by the lint) |
| P7 | The golden-path template adopts the library in ≤ 20 lines and passes `security-baseline` unchanged |

### Adversarial evidence (record a run URL or output for each)

| # | Attempt | Required outcome |
|---|---|---|
| E1 | PR adds a workflow with `${{ github.event.issue.title }}` in `run:` | `security-baseline` fails the PR |
| E2 | PR adds `uses: some/action@main` in a job with secrets | Blocked by lint *and* by the allow-list |
| E3 | Deploy an image built by a workflow other than `build.yml` | Verification refuses it |
| E4 | Someone edits a ruleset by hand in the UI | Detected by drift between git and live config (`apply.py --dry-run` shows a diff) |
| E5 | A privileged job restores a cache | Lint fails |
| E6 | Template repo created from scratch | CI green on the first PR with no edits |

### OPERATING-MODEL.md

1. **Ownership split:** what the platform team owns and what product teams own, with the interface stated explicitly.
2. **SLOs:** four SLIs with targets, and how infrastructure-caused failures are classified.
3. **Maturity:** where the org is today, the target for 8 weeks, and the measurement you'll put in place before enforcing anything.
4. **Rollout plan:** measure → evaluate → pilot → tiered → active, with dates and an exception policy.
5. **Top 5 roadmap items** ranked by `(Impact × Confidence) / Effort`, with your numbers.

### RUNBOOKS.md

Runbooks for the four standard incidents: compromised action, runaway minutes, leaked secret, and cache poisoning. Each needs the first command to run, who gets paged, and the condition for declaring the incident over.

### AUDIT-EVIDENCE.md

For each auditor question in lecture §8.4, give the concrete evidence your platform produces and where it's stored. Include "prove the controls were active on a past date."

### Grading

| Dimension | Weight |
|---|---|
| Security: P3–P6 hold, and E1–E5 behave as required | 30% |
| Correctness: policy-as-code really drives the live config; lint is tested | 25% |
| Operability: runbooks are executable; golden path works (E6) | 20% |
| Transfer: another senior engineer could run this platform from the docs | 15% |
| Judgment: the roadmap and rollout are defensible with numbers | 10% |

**Automatic fail:** any PAT, an attestation that's generated but never verified, a standing bypass actor, or policy that exists only in the UI.

---

## Done

You've finished the course when the 20-row rubric in lecture §9 holds for everything you built across the four days.
