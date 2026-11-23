// Progressive enhancement: without JavaScript every stage panel is visible.
document.documentElement.classList.add("js");

/* ---------- Stage stepper ---------- */
(function stepper() {
  const buttons = Array.from(document.querySelectorAll(".stage-btn"));
  const panels = buttons.map((b) => document.getElementById(b.dataset.target));
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  let current = 0;

  buttons.forEach((btn, i) => {
    btn.id = "tab-" + btn.dataset.target;
    btn.setAttribute("aria-controls", btn.dataset.target);
    panels[i].setAttribute("aria-labelledby", btn.id);
    btn.addEventListener("click", () => select(i, true));
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); select(Math.min(i + 1, buttons.length - 1), true); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); select(Math.max(i - 1, 0), true); }
      if (e.key === "Home")       { e.preventDefault(); select(0, true); }
      if (e.key === "End")        { e.preventDefault(); select(buttons.length - 1, true); }
    });
  });

  prev.addEventListener("click", () => select(current - 1, false));
  next.addEventListener("click", () => select(current + 1, false));

  function select(i, focusTab) {
    if (i < 0 || i >= buttons.length) return;
    current = i;
    buttons.forEach((b, j) => {
      const on = j === i;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle("done", j < i);
      panels[j].classList.toggle("active", on);
    });
    if (focusTab) buttons[i].focus();
    prev.disabled = i === 0;
    next.disabled = i === buttons.length - 1;
  }

  // Allow deep links like #stage-runner
  const fromHash = panels.findIndex((p) => "#" + p.id === location.hash);
  select(fromHash >= 0 ? fromHash : 0, false);
})();

/* ---------- Build information ---------- */
// build-info.json is written by YOUR workflow (scripts/build_info.py).
// Every value is treated as untrusted text: we only ever use textContent,
// never innerHTML, so a commit message like <img onerror=...> is shown, not run.
(async function buildInfo() {
  const dot = document.getElementById("build-dot");
  const summary = document.getElementById("build-summary");
  const note = document.getElementById("build-note");
  const table = document.getElementById("build-table");

  let info;
  try {
    const res = await fetch("build-info.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    info = await res.json();
  } catch {
    dot.classList.add("local");
    summary.textContent = "Local preview: this copy was not deployed by GitHub Actions yet.";
    note.textContent = "No build-info.json was found. Once your deploy workflow runs, this card shows which run, commit and person published the page.";
    return;
  }

  const text = (v, fallback = "–") => (typeof v === "string" || typeof v === "number") && String(v).trim() ? String(v) : fallback;
  const set = (id, v) => { document.getElementById(id).textContent = text(v); };

  const repoOk = typeof info.repository === "string" && /^[\w.-]+\/[\w.-]+$/.test(info.repository);
  const runOk = /^\d+$/.test(String(info.run_id || ""));
  const runUrl = repoOk && runOk ? `https://github.com/${info.repository}/actions/runs/${info.run_id}` : null;
  const shortSha = text(info.sha, "").slice(0, 7) || "–";
  const when = info.built_at ? new Date(info.built_at) : null;
  const validDate = when && !isNaN(when);

  // Banner
  dot.classList.add(info.local ? "local" : "ok");
  summary.textContent = "";
  const label = document.createElement(runUrl ? "a" : "span");
  if (runUrl) { label.href = runUrl; label.rel = "noopener"; }
  label.textContent = info.local
    ? "Built locally with scripts/build_info.py (not by GitHub Actions)"
    : `Deployed by run #${text(info.run_number, "?")} · commit ${shortSha} · ${validDate ? relative(when) : "unknown time"}`;
  summary.appendChild(label);

  // Card
  note.textContent = info.local
    ? "These values came from your machine. Deploy with your workflow to see real run data."
    : "These values were written into build-info.json by the workflow run that deployed this page.";
  set("bi-workflow", info.workflow);
  set("bi-event", info.event);
  set("bi-actor", info.actor);
  set("bi-ref", info.ref);
  set("bi-sha", info.sha);
  set("bi-message", info.commit_message);
  set("bi-time", validDate ? when.toLocaleString() : info.built_at);
  const run = document.getElementById("bi-run");
  run.textContent = runUrl ? `#${text(info.run_number, "?")} (view log)` : "–";
  if (runUrl) { run.href = runUrl; run.rel = "noopener"; } else { run.removeAttribute("href"); }
  table.hidden = false;
})();

function relative(date) {
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const units = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [name, secs] of units) {
    const n = Math.floor(s / secs);
    if (n >= 1) return `${n} ${name}${n > 1 ? "s" : ""} ago`;
  }
  return "just now";
}
