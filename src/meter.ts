import * as vscode from "vscode";
export type MeterFile = { path: string; bytes: number; lines: number; tokens: number };
export type MeterSnapshot = { files: MeterFile[]; bytes: number; lines: number; tokens: number };

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + "B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + "KB";
  return (bytes / (1024 * 1024)).toFixed(2) + "MB";
}

export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(Math.round(tokens));
  return (tokens / 1000).toFixed(1) + "k";
}

export function emptyMeter(): MeterSnapshot { return { files: [], bytes: 0, lines: 0, tokens: 0 }; }


export function measureOpenEditors(charsPerToken: number): MeterSnapshot {
  const files: MeterFile[] = [];
  let bytes = 0;
  let lines = 0;
  let tokens = 0;
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.uri.scheme !== "file" || doc.isUntitled) continue;
    const text = doc.getText();
    const b = Buffer.byteLength(text, "utf8");
    const l = doc.lineCount;
    const t = text.length / Math.max(charsPerToken, 1);
    files.push({ path: doc.uri.fsPath, bytes: b, lines: l, tokens: t });
    bytes += b; lines += l; tokens += t;
  }
  files.sort((a, b) => b.bytes - a.bytes);
  return { files, bytes, lines, tokens };
}
