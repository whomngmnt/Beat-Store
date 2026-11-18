// Beat descriptions and every other text are rendered by React, which
// escapes them, so a "<script>" in a description shows as text
// (.claude/rules/uploads.md). The only way around that is
// dangerouslySetInnerHTML, so no source file may use it.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === "generated" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

it("no file in src/ renders raw HTML", () => {
  const files = sourceFiles("src");
  expect(files.length).toBeGreaterThan(50);
  const offenders = files.filter((file) =>
    readFileSync(file, "utf8").includes("dangerouslySetInnerHTML"),
  );
  expect(offenders).toEqual([]);
});
