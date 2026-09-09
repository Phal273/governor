import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export type BloatHit = {
  path: string;
  bytes: number;
  reason: string;
};

const SKIP_DIRS = new Set([
  "node_modules", ".git", "out", "dist", "build", ".next", ".turbo", ".cache", "coverage", "vendor", ".venv", "venv", "target"
]);

export async function scanBloat(workspaceFolder: vscode.WorkspaceFolder, warnBytes: number): Promise<BloatHit[]> {
  const root = workspaceFolder.uri.fsPath;
  const hits: BloatHit[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (ent.name.startsWith(".") && ent.name !== ".cursorignore" && ent.name !== ".cursorrules") {
        if (SKIP_DIRS.has(ent.name)) continue;
      }
      if (SKIP_DIRS.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { stack.push(full); continue; }
      if (!ent.isFile()) continue;
      let st: fs.Stats;
      try { st = fs.statSync(full); } catch { continue; }
      const rel = path.relative(root, full);
      const ext = path.extname(ent.name).toLowerCase();
      const heavyExt = new Set([".png",".jpg",".jpeg",".gif",".webp",".mp4",".mov",".zip",".tar",".gz",".7z",".pdf",".wasm",".sqlite",".db",".vsix",".map"]);
      if (st.size >= warnBytes) {
        hits.push({ path: rel, bytes: st.size, reason: "large file" });
      } else if (heavyExt.has(ext) && st.size >= Math.min(warnBytes, 100000)) {
        hits.push({ path: rel, bytes: st.size, reason: "heavy binary/media" });
      } else if (/lock/i.test(ent.name) && st.size >= 50000) {
        hits.push({ path: rel, bytes: st.size, reason: "lockfile" });
      }
    }
  }
  hits.sort((a, b) => b.bytes - a.bytes);
  return hits.slice(0, 50);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
