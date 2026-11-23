# GitHub Actions — Activities: Deploy a Website with Your Own Workflows

Read [`notes.md`](notes.md) first.

## The project

This repo already has a small website in [`site/`](site/). It's an interactive page that explains how GitHub Actions works. **You'll write the workflows** that check it, build it and publish it to **GitHub Pages**, one step at a time.

When you're done, the page will show a banner like this:

> 🟢 Deployed by run #14 · commit 3fa9c1e · 2 minutes ago

That banner is filled in by *your* workflow, so the page you deploy shows the run that deployed it.

### What's already here (you don't write these)

| File | What it does |
|---|---|
| `site/index.html`, `styles.css`, `app.js` | The website |
| `scripts/check_site.py` | Checks the site for missing files and broken links. Exits with an error if something is wrong |
| `scripts/build_info.py` | Writes `site/build-info.json` (run number, commit, author…) so the page can show who deployed it |

### What you'll write

| File | Built in steps |
|---|---|
| `.github/workflows/hello.yml` | 1 |
| `.github/workflows/check.yml` | 2, 6, 7, 8 |
| `.github/workflows/deploy.yml` | 3, 4, 5, 6, 8, 9 |

### How each step works

| Part | What it gives you |
|---|---|
| **Goal** | What you'll learn |
| **Write** | What your workflow must do (the requirements) |
| **Guidance** | Explanations and **example code from a different situation**. The examples show the syntax, but you have to adapt them; copying them as-is won't solve the step |
| **Try it** | What to do on GitHub |
| **You should see** | How to tell it worked |
| **Self-check** | A list to compare your file against |
| **Write down** | A short question to answer in your `NOTES.md` |

If you get stuck: re-read the notes section the step names, open the failed run's log, and compare your file line by line with the **Self-check** list.

---

## Step 0: Set up (10 min)

1. **Preview the site on your computer:**
   ```bash
   python3 -m http.server 8000 -d site
   ```
   Open <http://localhost:8000>. The banner says *"Local preview: this copy was not deployed by GitHub Actions yet."* Press `Ctrl+C` to stop the server.
2. **Run the checker yourself:**
   ```bash
   python3 scripts/check_site.py site
   ```
   It should print `Site check ✅ passed`.
3. **Turn on GitHub Pages:** on GitHub, open this repo → **Settings** → **Pages** → under **Build and deployment**, set **Source** to **GitHub Actions**.
   > GitHub Pages is free for **public** repos. For a private repo you need a paid plan, or you can make the repo public.
4. **Create the folder for your workflows:**
   ```bash
   mkdir -p .github/workflows
   ```

Your site will be published at `https://<your-username>.github.io/<repo-name>/`. For this repo that's `https://volam1311.github.io/GitHub-Actions/`.

---

## Step 1: Your first workflow (15 min) · Notes §1–2

**Goal:** Write a workflow, run it, and read its log.

**Write** `.github/workflows/hello.yml`. It should:
- run on every `push`, and also when you click a button
- have one job, `hello`, on `ubuntu-24.04`
- check out the code, then run `python3 scripts/build_info.py hello-info.json`

**Guidance:**
- A workflow file always has these top-level keys, in this order: `name`, `on`, `permissions`, `jobs`.
- `on:` can list several events. The "button" event is called `workflow_dispatch`.
- Start with `permissions: {}` at the top, then give the job only what it needs. Reading the repo's code needs `contents: read`.
- Each item under `steps:` is either `- uses: <action>` or `- run: <command>`.

Example of the overall shape (a different workflow, which just prints the date every night):

```yaml
name: nightly-date
on:
  schedule:
    - cron: "17 2 * * *"
permissions: {}
jobs:
  print-date:
    runs-on: ubuntu-24.04
    steps:
      - run: date
```

**Try it:**
1. Commit and push: `git add . && git commit -m "Add hello workflow" && git push`
2. On GitHub, open the **Actions** tab → click the run → click the `hello` job.
3. Expand the `build_info.py` step. It prints the JSON it wrote.
4. Now run it from the button: **Actions** → **hello** (left sidebar) → **Run workflow**.

**You should see:** two runs, one with event `push` and one with `workflow_dispatch`. The JSON shows your real commit SHA, run number and username. The script read these from variables that GitHub sets automatically (`GITHUB_SHA`, `GITHUB_RUN_NUMBER`, …).

**Try breaking it:** remove the checkout step and push. The run fails with *"can't open file scripts/build_info.py"*. Put the step back.

**Self-check:**
- [ ] Two events under `on:`
- [ ] `permissions: {}` at the top, and `contents: read` on the job
- [ ] The checkout step comes **before** the `run:` step

**Write down:** why the checkout step is needed.

> When you've finished Step 1, disable this workflow so it stops running on every push: **Actions** → **hello** → `···` → **Disable workflow**.

---

## Step 2: Check the site on every pull request (20 min) · Notes §2–3

**Goal:** Stop broken changes from being merged, by running the checker on every PR.

**Write** `.github/workflows/check.yml`. It should:
- be named `check`
- run on pull requests
- have one job, `test`, that checks out the code, sets up Python 3.12, and runs the site checker on the `site` folder

**Guidance:**
- To get a specific Python version, use the `actions/setup-python` action and pass the version under `with:`.
- Passing settings to an action looks like this (an example with a different action):
  ```yaml
  - uses: actions/setup-node@v4
    with:
      node-version: "20"
  ```
- A step **fails** when its command exits with a non-zero code. `check_site.py` exits with `1` when it finds a problem, so the job fails automatically. You don't need any extra logic.

**Try it:**
1. Create a branch, add the file, push, and open a pull request:
   ```bash
   git switch -c add-check
   git add .github/workflows/check.yml
   git commit -m "Add site check"
   git push -u origin add-check
   ```
2. **Break the site on purpose.** On the same branch, open `site/index.html`, change `href="styles.css"` to `href="style.css"`, commit and push.
3. Look at the PR's **Checks**, and at the **Summary** page of the failed run.
4. Fix the link back to `styles.css`, push, and merge the PR.

**You should see:**

| Moment | Result |
|---|---|
| PR opened | ✅ the `test` check passes |
| After breaking the link | ❌ fails. The run Summary has a table: *broken link or asset: 'style.css'*. **Files changed** shows the error next to the line |
| After fixing it | ✅ green again |

**Self-check:**
- [ ] Triggered by `pull_request`
- [ ] Three steps: checkout → set up Python 3.12 → run the checker
- [ ] Only `contents: read` permission

**Write down:** what makes a step "fail" in GitHub Actions.

---

## Step 3: Deploy to GitHub Pages (20 min) · Notes §10–11

**Goal:** Publish the site with the official Pages actions.

**Write** `.github/workflows/deploy.yml`. It should:
- be named `deploy`
- run on pushes to `main`, and from the button
- have **one** job, `deploy`, that checks out the code, uploads the `site/` folder as a Pages artifact, and deploys it
- use the `github-pages` environment and show the live URL on the run page

**Guidance:**
- Read Notes §11. It names the two actions you need, says which permissions they require, and explains why.
- Look up each action's inputs on its GitHub page: [`actions/upload-pages-artifact`](https://github.com/actions/upload-pages-artifact) (which folder to upload) and [`actions/deploy-pages`](https://github.com/actions/deploy-pages) (what it outputs).
- To use a step's output later, give the step an `id:`, then refer to it as `steps.<id>.outputs.<name>`.
- An environment with a clickable URL looks like this (an example for a staging server):
  ```yaml
  environment:
    name: staging
    url: https://staging.example.com
  ```
  The `url:` value can be an expression like `${{ steps.<id>.outputs.<name> }}`.
- To limit a push trigger to one branch, put `branches:` under `push:`.

**Try it:**
1. Commit to `main` and push.
2. Open the run. When it finishes, the job shows the URL. Click it.

**You should see:** your site, live on the internet 🎉. The banner still says *"Local preview…"*, because nothing has written `build-info.json` yet. That comes in Step 5. The repo's front page now lists `github-pages` under **Deployments**.

If the deploy step fails with a permissions error, compare your job's `permissions:` with Notes §11.

**Self-check:**
- [ ] Triggers: push to `main` + manual button
- [ ] Three permissions on the job: one to read code, one to publish Pages, one for OIDC
- [ ] `environment:` with name `github-pages` and a `url:` taken from the deploy step's output
- [ ] The upload step points at the `site/` folder

**Write down:** what `id-token: write` lets the job do, and what it does **not** let it do.

---

## Step 4: Split into build and deploy jobs (15 min) · Notes §3, §5

**Goal:** Give each job only the permissions it needs, and pass files between jobs with an artifact.

Right now one job holds *all* the permissions for its whole run. Split it:

| Job | Does | Permissions |
|---|---|---|
| `build` | Checkout + upload the Pages artifact | Read code only |
| `deploy` | Deploys the artifact. Waits for `build` | Publish Pages + OIDC only |

**Guidance:**
- Each job runs on a different machine. `upload-pages-artifact` stores the files on GitHub, so the `deploy` job can publish them **without** checking out the code.
- Making one job wait for another is one line, `needs:`. Example from a different project:
  ```yaml
  jobs:
    compile:
      runs-on: ubuntu-24.04
      steps: [...]
    package:
      needs: compile
      runs-on: ubuntu-24.04
      steps: [...]
  ```
- Ask yourself which job actually *publishes*. That job gets the environment and the publishing permissions.

**Try it:** push to `main` and open the run.

**You should see:** a picture with two boxes, `build` → `deploy`, connected by a line. The site still deploys.

**Self-check:**
- [ ] `build` has only `contents: read`
- [ ] `deploy` has `needs: build`, no checkout step, and no `contents` permission
- [ ] The `environment:` block is on `deploy`

**Write down:** why it's safer that the `build` job can't publish to Pages.

---

## Step 5: Show the build info on the page, safely (25 min) · Notes §8, Rule 1

**Goal:** Make the page show the run that deployed it, and learn why untrusted text must never go straight into `run:`.

`scripts/build_info.py site/build-info.json` writes the file the page reads. It needs **one thing from you**: the commit message, passed as an environment variable named `COMMIT_MESSAGE`. In a workflow, the commit message of a push is `${{ github.event.head_commit.message }}`.

Anyone who can push chooses their commit message, so treat it as **untrusted text**.

### 5a. The unsafe way (do this on purpose)

1. In the `build` job, after checkout, add this deliberately **unsafe** step:
   ```yaml
   - name: Show the commit message (UNSAFE)
     run: echo "Deploying: ${{ github.event.head_commit.message }}"
   ```
2. Make a commit with this exact message, and push it to `main`:
   ```bash
   git commit --allow-empty -m 'hi" && echo "INJECTED $((6*7))" && echo "'
   git push
   ```
3. Open the run and expand the **UNSAFE** step.

**You should see:** a line `INJECTED 42`. The shell **ran your commit message as a command**.

### 5b. The safe way

**Write:** delete the unsafe step. Add a step that runs `scripts/build_info.py` with the output path `site/build-info.json`, and hands it the commit message safely.

**Guidance:**
- The safe pattern: put the untrusted value into `env:` on the step, then the script reads the environment variable. Example with a **PR title** instead:
  ```yaml
  - name: Greet the PR
    env:
      PR_TITLE: ${{ github.event.pull_request.title }}
    run: python3 -c 'import os; print("Thanks for:", os.environ["PR_TITLE"])'
  ```
  The title never becomes part of the command text, so it can't change what the command does.
- Your variable name must be exactly `COMMIT_MESSAGE`, because that's the name `build_info.py` reads.
- **Order matters:** the file has to exist *before* the upload step packs `site/`.

**Try it:**
1. Push. Open your site and refresh.
2. Push the tricky commit message from 5a again.
3. Try a message that attacks the *web page*:
   ```bash
   git commit --allow-empty -m '<img src=x onerror=alert("hacked")>'
   git push
   ```

**You should see:**

| Moment | Result |
|---|---|
| 1 | 🟢 The banner shows *Deployed by run #N · commit abc1234 · just now*. Click it to open your run. Section 3 of the page fills in the build card |
| 2 | No `INJECTED 42` in the log. The page shows the message as plain text |
| 3 | **No popup.** The page shows `<img src=x …>` as text, because `app.js` uses `textContent`, never `innerHTML` |

**Self-check:**
- [ ] No `${{ github.event... }}` appears anywhere inside a `run:` line
- [ ] The build-info step comes after checkout and before the upload
- [ ] The env variable is named `COMMIT_MESSAGE`

**Write down:** in one or two sentences, why `env:` stops the attack in 5a.

---

## Step 6: Only deploy if the check passes (20 min) · Notes §9

**Goal:** Reuse `check.yml` inside `deploy.yml`, so a broken site never goes live.

**Write:**
1. Make `check.yml` callable from other workflows, while keeping its pull-request trigger.
2. In `deploy.yml`, add a first job named `check` that **calls** `check.yml`.
3. Make `build` wait for `check`.

**Guidance:**
- A workflow becomes reusable when you add the `workflow_call` event to its `on:` list.
- A job that calls another workflow has `uses:` *instead of* `runs-on:` and `steps:`. Example calling a different (imaginary) workflow:
  ```yaml
  jobs:
    lint:
      uses: ./.github/workflows/lint.yml
      permissions:
        contents: read
  ```
- The caller must grant the permissions that the called workflow's jobs need. Look at what `check.yml`'s job uses.

**Try it:**
1. Push to `main`. The run picture now shows `check / test` → `build` → `deploy`.
2. **Push a broken link to `main`** (`styles.css` → `style.css`).
3. Fix it and push again.

**You should see:** in step 2, `check / test` ❌, while `build` and `deploy` are **skipped**, so your live site keeps the last good version. In step 3, it's green and deploys.

**Self-check:**
- [ ] `check.yml`'s `on:` has two events
- [ ] `deploy.yml` has three jobs: `check`, `build`, `deploy`
- [ ] The `check` job has no `runs-on:` or `steps:`

**Write down:** what happens to a job when a job it `needs` fails.

---

## Step 7: Test on several Python versions, plus a gate (20 min) · Notes §4

**Goal:** Use a matrix, and add one stable "gate" check.

**Write:** in `check.yml`:
1. Run the `test` job on Python **3.10, 3.11, 3.12 and 3.13**, and don't let one failure cancel the others.
2. Add a job `gate` that waits for `test`, always runs unless the run was cancelled, and fails unless `test` succeeded.

**Guidance:**
- A matrix example, with Node versions instead of Python:
  ```yaml
  strategy:
    fail-fast: false
    matrix:
      node: ["18", "20", "22"]
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node }}
  ```
- Notes §3 explains why a job that `needs` a failed job is normally skipped, and which `if:` makes it run anyway.
- Inside the gate, `needs.<job-id>.result` is `success`, `failure`, `cancelled` or `skipped`. The shell command `test "A" = "B"` exits with code 1 when A and B differ, which fails the step.

**Try it:** open a PR with any small change.

**You should see:** `test (3.10)`, `test (3.11)`, `test (3.12)`, `test (3.13)` and `gate`. The four tests run **at the same time**. Bonus: make the checker fail on purpose, and confirm that `gate` still runs and turns red.

**Self-check:**
- [ ] Four Python versions, and `fail-fast: false`
- [ ] `python-version` comes from the matrix, not a fixed value
- [ ] `gate` has `needs:` and an `if:`, and fails unless the result is `success`

**Write down:** why you'd require only `gate` in branch protection, and not the four `test (…)` checks. (What happens to the names if you add Python 3.14 later?)

---

## Step 8: Concurrency, so deploys don't clash (15 min) · Notes §6

**Goal:** Cancel outdated PR checks, but never cancel a deploy halfway through.

**Write:**
1. In `deploy.yml`: make sure only one deploy runs at a time. A new deploy **waits**; it never cancels the running one.
2. In `check.yml`: when a PR gets a new push, **cancel** the older check run for that same PR. Start the group name with `check-` so it can't clash with the deploy group.

**Guidance:**
- `concurrency:` takes a `group` (a name) and `cancel-in-progress` (true or false). Runs with the same group name never run at the same time.
- Example for a *different* workflow that builds docs, where each branch gets its own group and old runs are cancelled:
  ```yaml
  concurrency:
    group: docs-${{ github.ref }}
    cancel-in-progress: true
  ```
- For the PR checks you need a value that's the same for every push to one PR. Which `github.event.pull_request...` field is that? Remember that `check.yml` also runs from `deploy.yml`, where there's no PR, so add a fallback with `||`.
- `cancel-in-progress` can be an expression, so it can be true for pull requests only.

**Try it:**
1. On a PR branch, push 4 times quickly:
   ```bash
   for i in 1 2 3 4; do git commit --allow-empty -m "push $i"; git push; done
   ```
2. On `main`, push twice about 10 seconds apart.

**You should see:** three PR check runs **cancelled**, with only the last one finishing. On `main`, the second deploy shows **Pending** until the first finishes, and nothing is cancelled.

**Self-check:**
- [ ] The deploy group is a fixed name, with `cancel-in-progress: false`
- [ ] The check group includes the PR number, with a fallback
- [ ] The check group cancels only on pull requests

**Write down:** what could go wrong if a deploy were cancelled halfway through.

---

## Step 9: Smarter triggers (10 min) · Notes §2

**Goal:** Only deploy when something that affects the site changed.

**Write:** limit the `push` trigger in `deploy.yml` so it only runs when files change in `site/`, `scripts/` or `.github/workflows/`. The manual button must keep working.

**Guidance:**
- `paths:` goes under the event, next to `branches:`. Example for a docs project:
  ```yaml
  on:
    push:
      branches: [main]
      paths:
        - "docs/**"
        - "mkdocs.yml"
  ```
- `**` means "anything inside this folder, at any depth".

**Try it:**
1. Edit only `notes.md` and push to `main`. No deploy starts.
2. Change some text in `site/index.html` and push. A deploy runs, and your change is live.
3. Click **Run workflow** on `deploy`. It still works.

**Self-check:**
- [ ] Three path patterns under `push:`
- [ ] The manual trigger is still there

**Write down:** why `paths:` filters are fine here, but risky for deciding which *tests* to run in a big project. (Notes §2.)

---

## Step 10: Lock it down (25 min) · Notes §8, Rule 2

**Goal:** Pin every action to an exact commit, and protect your branch and your deploy.

### 10a. Pin actions to SHAs

1. Find the commit SHA behind an action's version tag. Example for `actions/checkout`:
   ```bash
   gh api repos/actions/checkout/git/ref/tags/v4.2.2 --jq '.object.sha, .object.type'
   ```
   If the type is `tag` rather than `commit`, look one level deeper:
   ```bash
   gh api repos/actions/checkout/git/tags/<sha-from-above> --jq .object.sha
   ```
2. Replace the tag with the SHA, and keep the version as a comment, in this format:
   ```yaml
   - uses: some-owner/some-action@<40-character-sha> # v1.2.3
   ```
3. Do this for **every** action in your workflows. (Find each action's latest version on its **Releases** page.)
4. Set up Dependabot to update the pins for you. Here's an example `.github/dependabot.yml` that keeps **Python packages** up to date. Change it so it watches **GitHub Actions** instead ([docs: ecosystem names](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference#package-ecosystem-)):
   ```yaml
   version: 2
   updates:
     - package-ecosystem: pip
       directory: "/"
       schedule:
         interval: weekly
   ```

**You should see:** everything still green. `grep -rn "uses:" .github/workflows` shows a SHA on every line, except the local `./.github/workflows/check.yml`.

### 10b. Require the gate before merging

1. **Settings** → **Rules** → **Rulesets** → **New ruleset** → **New branch ruleset**.
2. Name it `main`, set **Enforcement** to **Active**, and under **Target branches** add **Include default branch**.
3. Tick **Require status checks to pass**, click **Add checks**, and add the check that should guard `main`. (Which one? See your answer to Step 7.)
4. Save, then open a PR that breaks a link.

**You should see:** the **Merge** button is blocked until the check passes.

> From now on, changes to `main` have to go through a pull request.

### 10c. Only `main` can deploy

1. **Settings** → **Environments** → **github-pages**. Under **Deployment branches and tags**, make sure only `main` is allowed.
2. Create a branch `sneaky`, push it, then **Actions** → **deploy** → **Run workflow** → choose `sneaky`.

**You should see:** `deploy` is **rejected** with *"Branch sneaky is not allowed to deploy to github-pages"*. Your live site is untouched.

**Write down:** why 10c matters, given that anyone with write access could otherwise run `deploy.yml` on their own branch.

---

## You're done 🎉

Open your live site. The banner shows the run that deployed it, and the page explains every stage of the process you just built.

### Final checklist

- [ ] `check.yml` runs on PRs, tests 4 Python versions, and has a `gate` job
- [ ] `deploy.yml` runs `check` → `build` → `deploy`, and a broken site never deploys
- [ ] The commit message reaches the script only through `env:`
- [ ] Each workflow starts with `permissions: {}`, and each job gets only what it needs
- [ ] `deploy` uses the `github-pages` environment, and only `main` may deploy
- [ ] Deploys never cancel each other; old PR checks do get cancelled
- [ ] Every action is pinned to a SHA, and Dependabot watches GitHub Actions
- [ ] The gate is required before merging to `main`
- [ ] The live page shows *Deployed by run #…*

### Want more?

- Add a weekly `schedule:` trigger so the page rebuilds every Monday, and watch "Built at" change.
- Write a Markdown summary to `$GITHUB_STEP_SUMMARY` with a link to the live site.
- Change the website itself, for example by adding a tenth stage to the stepper, and let your workflow deploy it.
