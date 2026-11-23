# Day 4 — Enterprise Control Plane, Supply-Chain Defense, and Running Actions as a Product

**Assumes:** Days 1–3
**Activity:** [`../activities/day-04-capstone.md`](../activities/day-04-capstone.md)

**Thesis:** At org scale you stop writing workflows and start operating a platform: policy, identity, provenance, cost, and an internal developer API. The question changes from "is this workflow correct?" to "can an incorrect workflow exist at all?"

---

## 1. Policy flows down and tightens

Enterprise policy → org policy (Actions permissions, allow-list, rulesets, runner groups, secrets) → repo rulesets, environments, and workflows. **A repo can be stricter than the org but never looser.** That's what makes governance tractable: you set a central floor and teams raise it.

Keep two things separate: **the library is what teams opt into; policy is what they can't opt out of.** A "helpful" reusable workflow that quietly enforces policy gets routed around, and the policy disappears the moment someone writes their own workflow.

---

## 2. Actions permissions and the allow-list

The only defensible production setting is **"Allow enterprise/org actions and selected"**: GitHub-authored actions, verified creators, and an explicit list (`astral-sh/setup-uv@*`, `r-lib/actions/*@*`, …).

- The allow-list controls **which actions** may run, and SHA pinning controls **which version**. You need both.
- It applies to transitive `uses:` too. An allowed composite action that calls a disallowed action gets blocked, so test allow-list changes against real workflows.
- In an incident it's also your **fastest containment switch**: removing an action blocks it in every repo at once.

Set org-wide **default `GITHUB_TOKEN` permissions to read-only** and require approval before fork PRs from first-time contributors can run.

---

## 3. Rulesets as policy-as-code

Org rulesets target repos **by custom property** (`tier: production`) rather than by name list:

```json
{
  "name": "org-default-main-protection",
  "target": "branch",
  "enforcement": "evaluate",
  "conditions": {
    "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] },
    "repository_property": { "include": [{ "name": "tier", "property_values": ["production"] }] }
  },
  "rules": [
    { "type": "deletion" }, { "type": "non_fast_forward" }, { "type": "required_signatures" },
    { "type": "pull_request", "parameters": { "required_approving_review_count": 2,
      "dismiss_stale_reviews_on_push": true, "require_code_owner_review": true } },
    { "type": "required_status_checks", "parameters": {
      "required_status_checks": [{ "context": "gate" }] } },
    { "type": "workflows", "parameters": { "workflows": [{
      "repository_id": 123456, "path": ".github/workflows/security-baseline.yml",
      "ref": "refs/heads/main" }] } }
  ],
  "bypass_actors": []
}
```

- `required_status_checks: gate`. The name stability you built on Days 1 and 3 pays off here.
- The **`workflows` rule = required workflows**: a central workflow that must pass in every targeted repo and that teams can't remove.
- **`enforcement: "evaluate"`** is dry-run mode. Always start there and read the rule insights before switching to `active`.
- **Bypass actors are the audit finding.** "Temporary" emergency bypasses tend to become permanent. Prefer a documented, alerting, time-boxed break-glass procedure.

### 3.1 The required policy lint

This lint makes Day 1's five-attack threat model mechanical:

```python
# policy_lint/__main__.py (essentials)
SHA_PIN = re.compile(r"^[^@]+@[0-9a-f]{40}$")
EVENT_INTERP = re.compile(r"\$\{\{\s*(github\.event|inputs|github\.head_ref)[^}]*\}\}")

doc = yaml.safe_load(path.read_text()) or {}
triggers = doc.get("on", doc.get(True, {})) or {}   # YAML 1.1 parses bare `on:` as True!
privileged = {"pull_request_target", "workflow_run", "issue_comment"} & set(triggers)
# fail on: no workflow-level permissions, write-all, unpinned or @main uses:,
#          event interpolation in run:, privileged checkout of a head/PR ref
```

`doc.get(True, …)` is not a typo. Without it, PyYAML reads the `on:` key as the boolean `True`, so the linter sees no triggers at all and silently passes. It's the most common bug in homegrown Actions linters.

---

## 4. Identity: choosing a credential

| Identity | Scope | Lifetime | Attributed to | Use when |
|---|---|---|---|---|
| `GITHUB_TOKEN` | This repo | The run | The workflow | Default, always try it first |
| GitHub App token | Repos it's installed on | ~1 h | The App | Cross-repo / org automation |
| Fine-grained PAT | What a *person* can reach | Up to 1 yr | **A human** | Almost never in CI |
| OIDC | External cloud | 15–60 min | Repo + workflow + environment | Any cloud access |

**App tokens beat PATs:** they're installation-scoped and short-lived, the audit log attributes actions to the bot rather than a person, and they survive offboarding. Unlike `GITHUB_TOKEN`, **App-token actions *do* trigger other workflows**. That fixes Day 2's tag-recursion problem, and it means you now have to guard against loops. The App's private key is the one long-lived secret you still hold, so keep it as an org secret restricted to specific repos, and rotate it.

```yaml
- uses: actions/create-github-app-token@<sha> # v1
  id: app
  with:
    app-id: ${{ vars.PLATFORM_APP_ID }}
    private-key: ${{ secrets.PLATFORM_APP_PRIVATE_KEY }}
    owner: ${{ github.repository_owner }}
    repositories: config-repo
```

**Multi-repo fan-out:** `repository_dispatch` returns 204 when the request is *accepted*, not when it's done. There's no transaction and no callback. Record the outcome for each target and fail loudly on partial fan-out. For version adoption, **prefer pull over push**: Dependabot already delivers a PR on each team's own schedule.

---

## 5. The platform API, cost, and audit

**Operate through the API, not the UI.** Run an inventory script every quarter. It walks every repo's workflows and counts unpinned `uses:` refs and privileged triggers. The output is your *actual* risk surface, which is often different from what the policy document describes.

| Task | Endpoint |
|---|---|
| Runs / jobs / timing | `GET /repos/{o}/{r}/actions/runs`, `…/runs/{id}/jobs`, `…/runs/{id}/timing` |
| Cancel / disable | `POST …/runs/{id}/cancel`, `PUT …/workflows/{wf}/disable` |
| Org policy / allow-list | `GET /orgs/{o}/actions/permissions[/selected-actions]` |
| Runner groups | `GET /orgs/{o}/actions/runner-groups` |
| Purge a cache | `DELETE /repos/{o}/{r}/actions/caches?key=…` |

**Chargeback:** repository custom properties (`team`, `cost-center`, `tier`) connect billing to ownership. Use them for both rulesets and chargeback. **Artifact retention** defaults to 90 days for every run. Setting it to 14 days org-wide, with explicit longer retention for releases, is often the biggest saving available. Publish the cost report; visibility changes behavior more than quotas do.

**Audit:** stream the audit log to a SIEM with your own retention. Two events should **page someone**: `self_hosted_runner_registered` and a ruleset being weakened (`repository_ruleset.update`). Both appear in real attack chains and are rare enough in normal operation to be low-noise.

---

## 6. Threat model for the platform

| # | Adversary | Entry | Primary control |
|---|---|---|---|
| T1 | Malicious contributor | Fork PR | The untrusted zone holds nothing |
| T2 | Compromised action | `uses:` | SHA pin + allow-list + minimal permissions |
| T3 | Cache poisoner | A cache that a privileged job restores | Privileged jobs never restore caches |
| T4 | Credential thief | Leaked PAT, loose OIDC trust, rogue runner | OIDC with a tight `sub`, App tokens, runner alerts |
| T5 | Insider | Legitimate write access | Rulesets, required signatures, audit alerts |

T2 is the one that scales: 40 repos × 15 actions each is 600 pieces of code that run with your tokens. Pinning bounds *when* you accept a change. It doesn't make the code safe.

### 6.1 Cache poisoning, precisely

The scoping rules: a cache written on branch X is readable by X and branches created from it, the default branch's cache is readable by everyone, a feature branch can't overwrite the default branch's entry, and fork PRs are isolated. **What scoping doesn't prevent:** a PR poisoning its *own* scope, which a privileged job on that ref then restores, and `restore-keys` prefixes matching a broader entry than you intended.

Defenses: **privileged jobs never restore caches**; prefix keys by trust level (`pr-` vs `main-`); **reconcile after restore** (`uv sync --frozen`), because a restore you trust without reconciling is an execution primitive; and know the purge command before you need it.

### 6.2 Attestation verification as an enforced gate

```yaml
verify-and-deploy:
  environment: production
  permissions: { contents: read, id-token: write, attestations: read }
  steps:
    - env: { GH_TOKEN: "${{ github.token }}", IMAGE: "ghcr.io/my-org/api@${{ inputs.digest }}" }
      run: |
        gh attestation verify "oci://${IMAGE}" \
          --repo my-org/api \
          --signer-workflow my-org/api/.github/workflows/build.yml \
          --source-ref refs/heads/main --format json > attestation.json
    - run: python verify_predicate.py attestation.json   # assert the builder id, non-empty bundles
    - run: ./deploy.sh production
```

> Generating an attestation costs one line. **Verifying it is the control.** Verification must constrain **repo + workflow + ref**.

**SLSA, honestly:** L1 means provenance exists. L2 means it's signed and the build is hosted, which GitHub-hosted runners plus attestations give you. L3 requires hardened, isolated builds, and most orgs that claim L3 are really L2 with good hygiene. An overstated level fails an audit harder than an honest lower one.

---

## 7. Debugging and incident response

### 7.1 The debugging escalation ladder

1. Read the log and the job summary.
2. Re-run with `ACTIONS_STEP_DEBUG=true` (temporarily, because it raises the risk of leaking secrets).
3. Dump `toJSON(github)` / `toJSON(needs)`.
4. Reproduce in a container that matches the runner image. (`act` only approximates it: no real artifacts, caches, OIDC, or API.)
5. Build a minimal repro workflow on a scratch branch.
6. **Last resort:** tmate/SSH. Never in a job with production credentials, never on a public repo, always with `limit-access-to-actor: true` and a short timeout, and rotate anything the job could see afterwards.

For intermittent failures, change one environment variable at a time: image version, action versions, cache hit vs miss, matrix cell, time of day, parallelism. On failure, write forensic context to the summary (image, cache hit, `GITHUB_RUN_ATTEMPT`, disk and memory). A failure that repeats on a re-run is a defect, not a flake.

### 7.2 The four standard incidents

| Incident | First move | Then |
|---|---|---|
| **Compromised action** | **Contain:** remove it from the org allow-list (blocks every repo at once) | Inventory usage (`gh search code --owner org "uses: bad/action"`), set the exposure window, **rotate every secret any affected job could reach**, check cloud logs for OIDC role assumptions, verify artifacts built in the window, re-pin to a known-good SHA or vendor it, write a postmortem |
| **Runaway minutes** | List in-progress runs; cancel; `PUT …/disable` the workflow | Usual causes: a scheduled job with no concurrency group, a self-triggering App-token loop, a combinatorial dynamic matrix. Prevent with `concurrency` on every schedule, `timeout-minutes` everywhere, and a billing alert at 80% |
| **Leaked secret** | **Revoke first, investigate second** | Map the exposure (logs, artifacts, caches, forks), rotate everywhere it's configured, check for use, enable push protection, move to OIDC |
| **Cache poisoning** | Enumerate and purge entries via the API | Repopulate from the default branch; add trust-level key prefixes |

### 7.3 Split or combine jobs?

Each job pays 15–40 s of overhead (assignment, image, checkout, action download). Splitting into `k` jobs only pays off when `T_work > k/(k−1) · T_overhead`. With 30 s of overhead, don't split work that takes under 60 s. Splitting a 40-second lint into four jobs costs 4× the overhead and saves nothing.

---

## 8. Running it as a product

### 8.1 SLIs and SLOs

| SLI | Example SLO |
|---|---|
| p50 / p95 push → gate | < 10 / < 20 min |
| p95 queue time | < 45 s |
| Pipeline reliability: 1 − (**infra-caused** failures / runs) | > 99% |
| Merge-queue ejection rate | < 2% |

A failing test is the platform working correctly. Classify failures so the infrastructure-caused ones (provisioning, action downloads, rate limits) are measurable. **Error budget:** while you're within budget, ship features. When you exceed it, reliability work comes first. Publish the burn rate.

### 8.2 Golden paths and maturity

A repo template whose entire CI is a ~20-line `ci.yml` that calls the pinned library is your most effective governance tool. **Track adoption.** Below about 70%, the path isn't good enough yet, so find out what the holdouts need instead of mandating compliance.

| Level | State | Characteristic failure |
|---|---|---|
| L1 Ad hoc | Every repo hand-rolled | Nobody knows what runs where |
| L2 Shared | A library exists; adoption is voluntary | Half the org is on a fork of v1 |
| L3 Governed | Rulesets and required workflows | Policy exists but is unmeasured |
| L4 Measured | SLOs, cost, adoption tracked | Nobody acts on the metrics |
| L5 Optimized | Error budgets drive priorities | — |

The classic trap is jumping from L2 to L3 without measurement: a required workflow breaks things, nobody can quantify the damage, and the policy is rolled back for good. **Measure before you enforce.**

### 8.3 Rollout and change management

Measure (inventory) → **evaluate mode** for about 2 weeks → pilot with 5 friendly repos → roll out by `tier` property → active, with **owned and dated exceptions** (an undated exception is permanent) → review bypasses and exceptions every quarter.

Any change to a contract (the gate name, a required workflow, the permission model) needs a short **RFC**: problem with evidence, proposal, **blast radius as a measured list of repos and owners**, migration, rollback in under an hour, and timeline. Deprecations get a 90-day minimum, `::warning::` annotations, and a dated removal.

### 8.4 Designing for audit

| Auditor question | Evidence |
|---|---|
| Which commit produced this artifact? | Provenance attestation |
| Who approved this deploy? | Environment approval record |
| Can a developer deploy without review? | Ruleset, environment config, bypass list |
| Was the artifact modified after build? | Digest verified at each boundary |
| **Prove the controls were active on 2026-03-14** | **Only possible if the audit log is streamed and policy lives in git** |

Manage rulesets, allow-lists, and runner groups **as code** (Terraform GitHub provider, or committed JSON applied by CI). Then the state of a control on any past date is a `git log` query, and every policy change goes through a reviewed, attributable, revertible PR.

### 8.5 Ownership and priorities

The target model: **the platform team owns the floor, the library, the runners, and incidents; product teams own their `ci.yml` and their tests.** The interface between them is the versioned input contract of the reusable workflow. Staff roughly one platform engineer per 50–100 active repos. Page only for: runner capacity below the floor, the merge queue stuck across repos, a policy misconfiguration blocking merges, an unexpected runner registration, or a weakened ruleset.

Prioritize by `(Impact × Confidence) / Effort`, where Impact ≈ ΔC_wait + ΔC_infra + ΔC_escape + Δrisk. **Cheap risk reductions** (verifying attestations, cutting retention, retiring PATs) are almost always under-prioritized, and big migrations (everything to ARC) are over-prioritized because they're more interesting.

---

## 9. Final rubric: the whole course on one page

| # | Control | Day |
|---|---|---|
| 1 | `permissions: {}` at workflow scope; minimal per job | 1 |
| 2 | Untrusted code never shares a job with credentials | 1 |
| 3 | No `${{ github.event.* }}` in `run:` | 1 |
| 4 | Actions SHA-pinned; org allow-list enforced | 1, 4 |
| 5 | Build once; promote by digest; verify at each boundary | 2 |
| 6 | OIDC publishing; no standing registry credentials | 2 |
| 7 | Irreversible sinks last, idempotent, convergent | 2 |
| 8 | Provenance generated **and verified** (repo + workflow + ref) | 2, 4 |
| 9 | Affected targets from a tested dependency graph | 3 |
| 10 | One stable gate that survives an empty matrix | 1, 3 |
| 11 | `merge_group` handled; queue tests the speculative merge | 3 |
| 12 | Ephemeral runners; pools partitioned by trust | 3 |
| 13 | Budget with targets and named enforcement | 3 |
| 14 | Org rulesets + required workflows, rolled out in evaluate mode | 4 |
| 15 | App tokens or OIDC; no PATs | 4 |
| 16 | Audit log streamed; policy as code | 4 |
| 17 | Privileged jobs never restore caches | 4 |
| 18 | Runbooks for the four standard incidents | 4 |
| 19 | Deprecation driven by measurement | 1, 4 |
| 20 | SLOs published; error budget drives priorities | 4 |

**The through-line:** CI is a distributed system with a security boundary and a cost function. Most questions that look like YAML syntax are really about one of those three. Before you start typing, ask which one you're dealing with.

**Where to go next:** hermetic builds (Nix/Bazel) toward SLSA L3+, OPA/Conftest in place of the hand-rolled lint, OpenTelemetry traces for pipelines, and static reachability analysis for "can an untrusted event reach this credential?"
