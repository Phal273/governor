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

export async function installOrUpgradeCursorignore(workspaceFolder: vscode.WorkspaceFolder): Promise<string> {
  const fileName = "." + "cursor" + "ignore";
  const filePath = path.join(workspaceFolder.uri.fsPath, fileName);
  const desired = DEFAULT_PATTERNS.join("\n") + "\n";
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, desired, "utf8");
    return "created";
  }
  const existing = fs.readFileSync(filePath, "utf8");
  if (existing.includes(MARKER)) {
    const kept: string[] = [];
    let inGov = false;
    let sawGov = false;
    for (const line of existing.split(/\r?\n/)) {
      if (line.startsWith(MARKER)) { inGov = true; sawGov = true; continue; }
      if (inGov) {
        if (line.trim() === "") { inGov = false; continue; }
        if (DEFAULT_PATTERNS.includes(line) || (!line.startsWith("#") && line.trim() !== "")) continue;
        inGov = false;
      }
      kept.push(line);
    }
    const merged = new Set<string>(DEFAULT_PATTERNS);
    const outLines: string[] = [...DEFAULT_PATTERNS];
    for (const line of kept) {
      if (!line.trim() || merged.has(line)) continue;
      outLines.push(line);
      merged.add(line);
    }
    fs.writeFileSync(filePath, outLines.join("\n") + "\n", "utf8");
    return sawGov ? "upgraded" : "merged";
  }
  const mergedText = desired + "\n# --- previous file ---\n" + existing;
  fs.writeFileSync(filePath, mergedText.endsWith("\n") ? mergedText : mergedText + "\n", "utf8");
  return "merged";
}
