import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
export { formatBytes } from "./meter";

export type BloatHit = {
  path: string;
  bytes: number;
  reason: string;
};

const SKIP_DIRS = new Set([
  "node_modules", ".git", "out", "dist", "build", ".next", ".turbo", ".cache",
  "coverage", "vendor", ".venv", "venv", "target", ".svn", "__pycache__", ".nuxt"
]);

const MAX_FILES = 20000;
const MAX_DEPTH = 12;

const HEAVY_EXT = new Set([
  ".png",".jpg",".jpeg",".gif",".webp",".mp4",".mov",".zip",".tar",".gz",".7z",
  ".pdf",".wasm",".sqlite",".db",".vsix",".map"
]);

export async function scanBloat(workspaceFolder: vscode.WorkspaceFolder, warnBytes: number): Promise<BloatHit[]> {
  const root = workspaceFolder.uri.fsPath;
  const hits: BloatHit[] = [];
  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
  let seenFiles = 0;

  while (stack.length) {
    if (seenFiles >= MAX_FILES) break;
    const { dir, depth } = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      if (seenFiles >= MAX_FILES) break;
      if (ent.isSymbolicLink()) continue;
      if (SKIP_DIRS.has(ent.name)) continue;
      // Skip other hidden dirs (keep scanning hidden files like .cursorignore at root only via name checks below)
      if (ent.name.startsWith(".") && ent.isDirectory()) continue;

      const full = path.join(dir, ent.name);
      // Defense in depth: skip symlink targets even if Dirent lied
      try {
        if (fs.lstatSync(full).isSymbolicLink()) continue;
      } catch {
        continue;
      }

      if (ent.isDirectory()) {
        if (depth + 1 <= MAX_DEPTH) stack.push({ dir: full, depth: depth + 1 });
        continue;
      }
      if (!ent.isFile()) continue;

      seenFiles += 1;
      let st: fs.Stats;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) continue;

      const rel = path.relative(root, full);
      const ext = path.extname(ent.name).toLowerCase();
      if (st.size >= warnBytes) {
        hits.push({ path: rel, bytes: st.size, reason: "large file" });
      } else if (HEAVY_EXT.has(ext) && st.size >= Math.min(warnBytes, 100000)) {
        hits.push({ path: rel, bytes: st.size, reason: "heavy binary/media" });
      } else if (/lock/i.test(ent.name) && st.size >= 50000) {
        hits.push({ path: rel, bytes: st.size, reason: "lockfile" });
      }
    }
  }

  hits.sort((a, b) => b.bytes - a.bytes);
  return hits.slice(0, 50);
}
