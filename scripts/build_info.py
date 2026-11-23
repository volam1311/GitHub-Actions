#!/usr/bin/env python3
"""Write build-info.json so the deployed page can show which run built it.

Usage (in a workflow step):
    python scripts/build_info.py site/build-info.json

It reads GitHub's built-in environment variables (GITHUB_SHA, GITHUB_RUN_ID, ...),
which every workflow step has automatically.

It also reads one variable that YOU must pass in yourself:
    COMMIT_MESSAGE   the commit message (untrusted text, so pass it through env:)

Run it on your own machine and it writes placeholder values marked "local": true.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def main() -> int:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "site/build-info.json")
    in_actions = env("GITHUB_ACTIONS") == "true"

    info = {
        "local": not in_actions,
        "repository": env("GITHUB_REPOSITORY", "local/preview"),
        "workflow": env("GITHUB_WORKFLOW", "(not in GitHub Actions)"),
        "run_id": env("GITHUB_RUN_ID"),
        "run_number": env("GITHUB_RUN_NUMBER"),
        "event": env("GITHUB_EVENT_NAME", "local"),
        "actor": env("GITHUB_ACTOR", env("USER", "you")),
        "ref": env("GITHUB_REF_NAME", "local"),
        "sha": env("GITHUB_SHA", "0" * 40),
        # Untrusted: anyone who can push chooses this text. Keep it short.
        "commit_message": env("COMMIT_MESSAGE", "(COMMIT_MESSAGE was not provided)")[:200],
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out}:")
    print(json.dumps(info, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
