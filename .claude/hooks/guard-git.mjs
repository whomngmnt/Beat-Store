// Claude Code PreToolUse hook for the Bash and PowerShell tools.
//
// Blocks two things in this repo, whatever Claude decides:
//   1. pushing to the main branch
//   2. staging a .env file (git add .env, or a forced add that could include it)
//
// Claude Code sends the tool call as JSON on stdin. Exit code 2 blocks the
// call, and the stderr message is shown to Claude. Any other failure (bad
// input, crash) also blocks, because settings.json sets onFailure: "block".

import { execFileSync } from "node:child_process";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw);
const command = input.tool_input?.command ?? "";

// Look at each part of a chained command: "a && b; c | d".
for (const part of command.split(/&&|\|\||[;|\n]/)) {
  // Rough word split. Strip quotes so ".env" and '.env' are caught too.
  const words = part
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^["'`]+|["'`]+$/g, ""));

  const gitIndex = words.findIndex((word) => /^git(\.exe)?$/i.test(word));
  if (gitIndex === -1) continue;

  // Skip git's own options (e.g. "git -C some/dir push") to find the subcommand.
  let i = gitIndex + 1;
  while (i < words.length && words[i].startsWith("-")) {
    if (["-C", "-c", "--git-dir", "--work-tree"].includes(words[i])) i++; // skip its value
    i++;
  }
  const subcommand = words[i];
  const args = words.slice(i + 1);
  const options = args.filter((arg) => arg.startsWith("-"));
  const operands = args.filter((arg) => !arg.startsWith("-"));

  if (subcommand === "push") checkPush(options, operands);
  if (subcommand === "add" || subcommand === "stage") checkAdd(options, operands);
}

process.exit(0); // nothing matched: let the normal permission flow decide

function checkPush(options, operands) {
  if (options.includes("--all") || options.includes("--mirror")) {
    block("--all / --mirror would push main. Push develop only: git push origin develop");
  }

  // operands = [remote, ...refspecs], e.g. ["origin", "HEAD:main"]
  const refspecs = operands.slice(1);
  if (refspecs.some((ref) => /(^|[:+/])main$/.test(ref))) {
    block("pushing to main is not allowed. Push to develop: git push origin develop");
  }

  // "git push", "git push origin" and "git push origin HEAD" push the current branch.
  const pushesCurrentBranch =
    refspecs.length === 0 || refspecs.some((ref) => /^\+?(HEAD|@)$/.test(ref));
  if (pushesCurrentBranch) {
    const branch = currentBranch();
    if (branch === "main") block("you are on main. Switch to develop before pushing.");
    if (branch === null) block("could not tell the current branch. Use: git push origin develop");
  }
}

function checkAdd(options, operands) {
  // A forced add stages ignored files, which is how a .env file would slip in.
  if (options.some((opt) => opt === "--force" || /^-[a-zA-Z]*f/.test(opt))) {
    block("forced git add can stage ignored files like .env. Add files by name instead.");
  }

  const envFile = operands.find((path) => {
    const name = path.split(/[\\/]/).pop();
    return name.startsWith(".env") && name !== ".env.example";
  });
  if (envFile) block(`${envFile} must never be committed. Secrets stay out of git.`);
}

function currentBranch() {
  try {
    return execFileSync("git", ["branch", "--show-current"], {
      cwd: input.cwd,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function block(reason) {
  process.stderr.write(`Blocked by .claude/hooks/guard-git.mjs: ${reason}\n`);
  process.exit(2);
}
