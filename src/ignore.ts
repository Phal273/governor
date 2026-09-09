import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export const DEFAULT_PATTERNS: string[] = [
  "# Governor lean ignore - keep agents off heavy / generated paths",
  "node_modules/",
  "dist/",
  "build/",
  "out/",
  ".next/",
  ".nuxt/",
  ".turbo/",
  ".cache/",
  "coverage/",
  "*.min.js",
  "*.min.css",
  "*.map",
  "*.lock",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "**/*.png",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.gif",
  "**/*.webp",
  "**/*.ico",
  "**/*.mp4",
  "**/*.mov",
  "**/*.zip",
  "**/*.tar",
  "**/*.gz",
  "**/*.7z",
  "**/*.pdf",
  "**/*.wasm",
  "**/*.sqlite",
  "**/*.db",
  ".git/",
  ".svn/",
  "vendor/",
  "__pycache__/",
  "*.pyc",
  ".venv/",
  "venv/",
  "target/",
  "*.vsix",
];

const MARKER = "# Governor lean ignore";

const END_MARKER = "# End Governor lean ignore";

function defaultBlock(): string {
  return DEFAULT_PATTERNS.join("\n") + "\n" + END_MARKER + "\n";
}

function stripGovernorBlock(existing: string): string[] {
  const lines = existing.split(/\r?\n/);
  const kept: string[] = [];
  let inGov = false;
  for (const line of lines) {
    if (line.startsWith(MARKER)) {
      inGov = true;
      continue;
    }
    if (inGov) {
      if (line === END_MARKER || line.startsWith(END_MARKER)) {
        inGov = false;
        continue;
      }
      if (line.trim() === "") continue;
      if (DEFAULT_PATTERNS.includes(line)) continue;
      inGov = false;
      kept.push(line);
      continue;
    }
    kept.push(line);
  }
  return kept;
}

export async function installOrUpgradeCursorignore(workspaceFolder: vscode.WorkspaceFolder): Promise<string> {
  const fileName = "." + "cursor" + "ignore";
  const filePath = path.join(workspaceFolder.uri.fsPath, fileName);
  const desired = defaultBlock();

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, desired, "utf8");
    return "created";
  }

  const existing = fs.readFileSync(filePath, "utf8");
  const defaultSet = new Set(DEFAULT_PATTERNS);
  defaultSet.add(END_MARKER);

  if (existing.includes(MARKER)) {
    const userLines = stripGovernorBlock(existing);
    const out: string[] = [...DEFAULT_PATTERNS, END_MARKER];
    const seen = new Set(out);
    for (const line of userLines) {
      if (!line.trim()) continue;
      if (seen.has(line) || defaultSet.has(line)) continue;
      if (line.startsWith(MARKER) || line.startsWith(END_MARKER)) continue;
      out.push(line);
      seen.add(line);
    }
    fs.writeFileSync(filePath, out.join("\n") + "\n", "utf8");
    return "upgraded";
  }

  const userLines = existing.split(/\r?\n/).filter((line) => {
    if (!line.trim()) return false;
    if (defaultSet.has(line) || DEFAULT_PATTERNS.includes(line)) return false;
    return true;
  });
  const out = [...DEFAULT_PATTERNS, END_MARKER, ...userLines];
  fs.writeFileSync(filePath, out.join("\n") + "\n", "utf8");
  return "merged";
}
