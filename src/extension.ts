import * as vscode from "vscode";
import { measureOpenEditors, MeterSnapshot, formatTokens, formatBytes } from "./meter";
import { installOrUpgradeCursorignore } from "./ignore";
import { installLeanRules } from "./rules";
import { scanBloat } from "./bloat";
import { draftLeanBrief } from "./brief";
import { GovernorPanel } from "./panel";

let panel: GovernorPanel;
let status: vscode.StatusBarItem;
let latestBrief = "";
let refreshTimer: NodeJS.Timeout | undefined;
const warnedLarge = new Set<string>();

export function activate(context: vscode.ExtensionContext): void {
  panel = new GovernorPanel(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(GovernorPanel.viewType, panel, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.command = "governor.open";
  status.tooltip = "Open Governor";
  context.subscriptions.push(status);
  updateStatusBar();

  context.subscriptions.push(
    vscode.commands.registerCommand("governor.open", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.governor");
      refreshMeter();
    }),
    vscode.commands.registerCommand("governor.refresh", () => refreshMeter()),
    vscode.commands.registerCommand("governor.installCursorignore", async () => {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) { vscode.window.showWarningMessage("Governor needs an open workspace folder."); return; }
      const result = await installOrUpgradeCursorignore(folder);
      const fileName = "." + "cursor" + "ignore";
      await offerOpen(folder, fileName, "Governor .cursorignore " + result + ".");
    }),
    vscode.commands.registerCommand("governor.installRules", async () => {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) { vscode.window.showWarningMessage("Governor needs an open workspace folder."); return; }
      const result = await installLeanRules(folder);
      await offerOpen(folder, ".cursor/rules/governor-lean.mdc", "Governor lean rules " + result + ".");
    }),
    vscode.commands.registerCommand("governor.draftBrief", () => {
      const brief = draftLeanBrief(vscode.window.activeTextEditor);
      latestBrief = brief.text;
      panel.setBrief(latestBrief);
      vscode.window.showInformationMessage("Governor drafted a lean brief.");
    }),
    vscode.commands.registerCommand("governor.scanBloat", async () => {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) { vscode.window.showWarningMessage("Governor needs an open workspace folder."); return; }
      const warnBytes = vscode.workspace.getConfiguration("governor").get<number>("warnFileBytes", 400000);
      const hits = await scanBloat(folder, warnBytes);
      panel.setBloat(hits);
      const top = hits[0];
      vscode.window.showInformationMessage(
        hits.length ? ("Governor found " + hits.length + " heavy paths. Largest: " + top.path + " (" + formatBytes(top.bytes) + ")") : "Governor found no heavy paths."
      );
    }),
    vscode.commands.registerCommand("governor.copyBrief", async () => {
      if (!latestBrief) {
        const brief = draftLeanBrief(vscode.window.activeTextEditor);
        latestBrief = brief.text;
        panel.setBrief(latestBrief);
      }
      await vscode.env.clipboard.writeText(latestBrief);
      vscode.window.showInformationMessage("Governor brief copied to clipboard.");
    }),
    vscode.window.onDidChangeActiveTextEditor(() => scheduleRefresh()),
    vscode.window.onDidChangeVisibleTextEditors(() => scheduleRefresh()),
    vscode.workspace.onDidChangeTextDocument(() => scheduleRefresh()),
    vscode.workspace.onDidOpenTextDocument((doc) => {
      scheduleRefresh();
      void warnLargeDocument(doc);
    }),
    vscode.workspace.onDidCloseTextDocument(() => scheduleRefresh()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("governor")) {
        updateStatusBar();
        scheduleRefresh();
      }
    })
  );

  refreshMeter();
}

export function deactivate(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
}

function getCharsPerToken(): number {
  return vscode.workspace.getConfiguration("governor").get<number>("charsPerToken", 4);
}

function scheduleRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    refreshMeter();
  }, 300);
}

function refreshMeter(): void {
  const snapshot: MeterSnapshot = measureOpenEditors(getCharsPerToken());
  panel?.setMeter(snapshot);
  updateStatusBar(snapshot);
}

function updateStatusBar(snapshot?: MeterSnapshot): void {
  if (!status) return;
  const show = vscode.workspace.getConfiguration("governor").get<boolean>("showStatusBar", true);
  if (!show) { status.hide(); return; }
  const snap = snapshot ?? measureOpenEditors(getCharsPerToken());
  status.text = "$(dashboard) Gov " + formatTokens(Math.round(snap.tokens)) + " tok";
  status.show();
}

async function offerOpen(folder: vscode.WorkspaceFolder, relativePath: string, message: string): Promise<void> {
  const pick = await vscode.window.showInformationMessage(message, "Open file");
  if (pick !== "Open file") return;
  const uri = vscode.Uri.joinPath(folder.uri, ...relativePath.split("/"));
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: true });
}

async function warnLargeDocument(doc: vscode.TextDocument): Promise<void> {
  if (doc.uri.scheme !== "file") return;
  const key = doc.uri.toString();
  if (warnedLarge.has(key)) return;
  const warnBytes = vscode.workspace.getConfiguration("governor").get<number>("warnFileBytes", 400000);
  let size = 0;
  try {
    size = (await vscode.workspace.fs.stat(doc.uri)).size;
  } catch {
    size = Buffer.byteLength(doc.getText(), "utf8");
  }
  if (size < warnBytes) return;
  warnedLarge.add(key);
  const pick = await vscode.window.showWarningMessage(
    "Governor: " + vscode.workspace.asRelativePath(doc.uri) + " is " + formatBytes(size) + ". Large files inflate agent context.",
    "Draft Lean Brief",
    "Dismiss"
  );
  if (pick === "Draft Lean Brief") {
    await vscode.commands.executeCommand("governor.draftBrief");
  }
}
