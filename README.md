# GitHub Actions — Short Course

Learn GitHub Actions by writing the workflows that publish a real website.

| File / folder | What it is | Time |
|---|---|---|
| [`notes.md`](notes.md) | Plain-language explanations of how GitHub Actions works | ~1 hour |
| [`activities.md`](activities.md) | A step-by-step guide: **you** write the workflows that check, build and deploy `site/` to GitHub Pages | ~4 hours |
| [`site/`](site/) | The website: an interactive page that explains the GitHub Actions flow (already built) | — |
| [`scripts/`](scripts/) | Helpers your workflows call: `check_site.py` (link checker) and `build_info.py` (writes run info for the page) | — |

## How to use it

1. Read [`notes.md`](notes.md).
2. Follow [`activities.md`](activities.md), Steps 0–10. Each step tells you what to write, gives hints, shows what you should see, and has a hidden solution in case you get stuck.
3. When you finish, your live page at `https://<user>.github.io/<repo>/` shows **"Deployed by run #…"**, written there by the workflow you built.

## Preview the site locally

```bash
python3 -m http.server 8000 -d site      # then open http://localhost:8000
python3 scripts/check_site.py site       # run the same check your CI will run
```

## What you'll learn

- How workflows, jobs, steps, runners and actions fit together
- Triggers, `paths:` filters, and manual runs
- Job dependencies (`needs:`), passing files with artifacts, and job permissions
- Reusable workflows, matrices, and a stable `gate` check
- Concurrency that never cancels a deploy
- Script injection, and how `env:` prevents it
- Deploying to GitHub Pages through a protected environment with OIDC
- Pinning actions to SHAs, Dependabot, and branch rulesets
