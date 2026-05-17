import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const intervalMs = Number(process.env.AUTO_GIT_SYNC_INTERVAL_MS || 60000);
const remote = process.env.AUTO_GIT_SYNC_REMOTE || "origin";
const branch = process.env.AUTO_GIT_SYNC_BRANCH || "main";
const messagePrefix = process.env.AUTO_GIT_SYNC_MESSAGE || "auto-sync";
const dryRun = process.argv.includes("--dry-run") || process.env.AUTO_GIT_SYNC_DRY_RUN === "1";
const once = process.argv.includes("--once") || dryRun;
let running = false;

async function run(command, args, options = {}) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 20,
    ...options,
  });
  return `${stdout || ""}${stderr || ""}`.trim();
}

async function currentBranch() {
  return run("git", ["branch", "--show-current"]);
}

async function hasChanges() {
  const status = await run("git", ["status", "--porcelain"]);
  return status.length > 0;
}

async function hasStagedChanges() {
  const output = await run("git", ["diff", "--cached", "--name-only"]);
  return output.length > 0;
}

async function assertGitRepo() {
  const inside = await run("git", ["rev-parse", "--is-inside-work-tree"]);
  if (inside !== "true") {
    throw new Error("not inside git work tree");
  }
}

async function syncOnce() {
  if (running) {
    console.log("[auto-git-sync] skip: previous sync still running");
    return;
  }

  running = true;
  try {
    await assertGitRepo();

    const activeBranch = await currentBranch();
    const pushBranch = branch || activeBranch;
    const timestamp = new Date().toISOString();

    if (!(await hasChanges())) {
      console.log(`[auto-git-sync] clean ${timestamp}`);
      return;
    }

    console.log(`[auto-git-sync] changes found ${timestamp}`);

    if (dryRun) {
      const status = await run("git", ["status", "--short"]);
      console.log(status);
      console.log("[auto-git-sync] dry-run: no commit/push");
      return;
    }

    await run("git", ["add", "-A"]);

    if (!(await hasStagedChanges())) {
      console.log("[auto-git-sync] nothing staged after git add");
      return;
    }

    const message = `${messagePrefix}: ${timestamp}`;
    await run("git", ["commit", "-m", message]);
    console.log(`[auto-git-sync] committed: ${message}`);

    try {
      await run("git", ["push", remote, pushBranch]);
      console.log(`[auto-git-sync] pushed ${remote}/${pushBranch}`);
    } catch (error) {
      console.error(`[auto-git-sync] push ${remote}/${pushBranch} failed: ${error.message}`);
      console.log("[auto-git-sync] trying plain git push");
      await run("git", ["push"]);
      console.log("[auto-git-sync] pushed with default upstream");
    }
  } finally {
    running = false;
  }
}

async function main() {
  await syncOnce();

  if (once) {
    return;
  }

  console.log(`[auto-git-sync] watching every ${intervalMs}ms`);
  setInterval(() => {
    syncOnce().catch((error) => {
      console.error(`[auto-git-sync] ${error.message}`);
    });
  }, intervalMs);
}

main().catch((error) => {
  console.error(`[auto-git-sync] fatal: ${error.message}`);
  process.exit(1);
});