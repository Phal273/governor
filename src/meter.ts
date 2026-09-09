import * as vscode from "vscode";

export type MeterFile = { path: string; bytes: number; lines: number; tokens: number; untitled?: boolean };
export type MeterSnapshot = {
  files: MeterFile[];
  bytes: number;
  lines: number;
  tokens: number;
  fileCount: number;
  untitledCount: number;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

export function formatTokens(tokens: number): string {
  const n = Math.round(tokens);
  if (n < 1000) return String(n);
  return (n / 1000).toFixed(1) + "k";
}

export function emptyMeter(): MeterSnapshot {
  return { files: [], bytes: 0, lines: 0, tokens: 0, fileCount: 0, untitledCount: 0 };
}

function displayPath(doc: vscode.TextDocument): string {
  if (doc.isUntitled || doc.uri.scheme === "untitled") {
    return doc.fileName || "(untitled)";
  }
  return vscode.workspace.asRelativePath(doc.uri, false);
}

function collectDocs(): vscode.TextDocument[] {
  const byKey = new Map<string, vscode.TextDocument>();

  for (const editor of vscode.window.visibleTextEditors) {
    const doc = editor.document;
    if (doc.uri.scheme !== "file" && doc.uri.scheme !== "untitled") continue;
    byKey.set(doc.uri.toString(), doc);
  }

  const tabGroups = (vscode.window as unknown as { tabGroups?: { all: Array<{ tabs: Array<{ input?: unknown }> }> } }).tabGroups;
  if (tabGroups?.all) {
    for (const group of tabGroups.all) {
      for (const tab of group.tabs) {
        const input = tab.input as { uri?: vscode.Uri } | undefined;
        if (!input?.uri) continue;
        if (input.uri.scheme !== "file" && input.uri.scheme !== "untitled") continue;
        const key = input.uri.toString();
        if (byKey.has(key)) continue;
        const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === key);
        if (open) byKey.set(key, open);
      }
    }
  }

  return [...byKey.values()];
}

export function measureOpenEditors(charsPerToken: number): MeterSnapshot {
  const files: MeterFile[] = [];
  let bytes = 0;
  let lines = 0;
  let tokens = 0;
  let untitledCount = 0;
  const cpt = Math.max(charsPerToken, 1);

  for (const doc of collectDocs()) {
    const untitled = doc.isUntitled || doc.uri.scheme === "untitled";
    if (untitled) untitledCount += 1;
    const text = doc.getText();
    const b = Buffer.byteLength(text, "utf8");
    const l = doc.lineCount;
    const t = text.length / cpt;
    files.push({ path: displayPath(doc), bytes: b, lines: l, tokens: t, untitled });
    bytes += b;
    lines += l;
    tokens += t;
  }

  files.sort((a, b) => b.bytes - a.bytes);
  return {
    files,
    bytes,
    lines,
    tokens,
    fileCount: files.length,
    untitledCount
  };
}
