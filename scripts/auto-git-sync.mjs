import { execFile } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { basename, resolve } from "node:path";

const root = process.cwd();
const debounceMs = Number(process.env.AUTO_GIT_SYNC_DEBOUNCE_MS ?? 10000);
const remote = process.env.AUTO_GIT_SYNC_REMOTE ?? "origin";
const branch = process.env.AUTO_GIT_SYNC_BRANCH ?? "main";

const ignored = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
]);

let timer;
let running = false;
let pending = false;

function runGit(args) {
  return new Promise((resolvePromise) => {
    execFile("git", args, { cwd: root, windowsHide: true }, (error, stdout, stderr) => {
      resolvePromise({
        ok: !error,
        code: error?.code ?? 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

async function hasChanges() {
  const res = await runGit(["status", "--porcelain"]);
  return res.ok && res.stdout.length > 0;
}

async function sync() {
  if (running) {
    pending = true;
    return;
  }

  running = true;
  pending = false;

  try {
    if (!(await hasChanges())) {
      console.log("[auto-git-sync] no changes");
      return;
    }

    const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const message = `Auto sync: ${stamp}`;

    console.log("[auto-git-sync] changes detected → add/commit/push");

    let res = await runGit(["add", "."]);
    if (!res.ok) throw new Error(res.stderr || res.stdout || "git add failed");

    res = await runGit(["commit", "-m", message]);
    if (!res.ok) {
      const text = `${res.stdout}\n${res.stderr}`;
      if (text.includes("nothing to commit")) {
        console.log("[auto-git-sync] nothing to commit");
        return;
      }
      throw new Error(text || "git commit failed");
    }

    res = await runGit(["push", remote, branch]);
    if (!res.ok) throw new Error(res.stderr || res.stdout || "git push failed");

    console.log(`[auto-git-sync] pushed → ${remote}/${branch}`);
  } catch (error) {
    console.error("[auto-git-sync] failed:", error.message);
  } finally {
    running = false;
    if (pending) schedule();
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(sync, debounceMs);
}

function shouldIgnore(filename) {
  if (!filename) return false;
  const parts = String(filename).split(/[\\/]/);
  return parts.some((part) => ignored.has(part) || basename(part).startsWith(".codex-dev"));
}

if (!existsSync(resolve(root, ".git"))) {
  console.error("[auto-git-sync] .git not found. Run git init/setup first.");
  process.exit(1);
}

console.log(`[auto-git-sync] watching ${root}`);
console.log(`[auto-git-sync] debounce=${debounceMs}ms target=${remote}/${branch}`);
console.log("[auto-git-sync] Ctrl+C to stop");

watch(root, { recursive: true }, (_eventType, filename) => {
  if (shouldIgnore(filename)) return;
  console.log(`[auto-git-sync] changed: ${filename}`);
  schedule();
});

schedule();