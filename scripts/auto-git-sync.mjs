import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const delayMs = Number(process.env.AUTO_GIT_SYNC_INTERVAL_MS || 60000);
const branch = process.env.AUTO_GIT_SYNC_BRANCH || "main";
const messagePrefix = process.env.AUTO_GIT_SYNC_MESSAGE || "auto-sync";

async function run(command, args) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 10,
  });
  return `${stdout || ""}${stderr || ""}`.trim();
}

async function hasChanges() {
  const status = await run("git", ["status", "--porcelain"]);
  return status.length > 0;
}

async function syncOnce() {
  if (!(await hasChanges())) {
    console.log(`[auto-git-sync] clean`);
    return;
  }

  const timestamp = new Date().toISOString();
  console.log(`[auto-git-sync] changes found -> commit/push ${timestamp}`);

  await run("git", ["add", "-A"]);
  await run("git", ["commit", "-m", `${messagePrefix}: ${timestamp}`]);

  try {
    await run("git", ["push", "origin", branch]);
  } catch {
    console.error(`[auto-git-sync] push failed on ${branch}, trying current branch`);
    await run("git", ["push"]);
  }

  console.log(`[auto-git-sync] pushed`);
}

async function main() {
  const once = process.argv.includes("--once");
  await syncOnce();

  if (once) return;

  console.log(`[auto-git-sync] watching every ${delayMs}ms`);
  setInterval(() => {
    syncOnce().catch((error) => {
      console.error(`[auto-git-sync] ${error.message}`);
    });
  }, delayMs);
}

main().catch((error) => {
  console.error(`[auto-git-sync] fatal: ${error.message}`);
  process.exit(1);
});