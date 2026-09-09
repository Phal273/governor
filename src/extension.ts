import * as vscode from "vscode";
import { measureOpenEditors, MeterSnapshot, formatTokens } from "./meter";
import { installOrUpgradeCursorignore } from "./ignore";
import { installLeanRules } from "./rules";
import { scanBloat, formatBytes } from "./bloat";
import { draftLeanBrief } from "./brief";
import { GovernorPanel } from "./panel";

let panel: GovernorPanel;
let status: vscode.StatusBarItem;
let latestBrief = "";

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
      vscode.window.showInformationMessage("Governor .cursorignore " + result + ".");
    }),
    vscode.commands.registerCommand("governor.installRules", async () => {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (!folder) { vscode.window.showWarningMessage("Governor needs an open workspace folder."); return; }
      const result = await installLeanRules(folder);
      vscode.window.showInformationMessage("Governor lean rules " + result + ".");
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
    vscode.window.onDidChangeActiveTextEditor(() => refreshMeter()),
    vscode.window.onDidChangeVisibleTextEditors(() => refreshMeter()),
    vscode.workspace.onDidChangeTextDocument(() => refreshMeter()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("governor")) {
        updateStatusBar();
        refreshMeter();
      }
    }),
    vscode.workspace.onDidOpenTextDocument((doc) => {
      void warnLargeDocument(doc);
    })
  );

  refreshMeter();
}

export function deactivate(): void {}

function getCharsPerToken(): number {
  return vscode.workspace.getConfiguration("governor").get<number>("charsPerToken", 4);
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
  status.text = "$(dashboard) Gov " + formatTokens(snap.tokens) + " tok";
  status.show();
}

async function warnLargeDocument(doc: vscode.TextDocument): Promise<void> {
  if (doc.uri.scheme !== "file") return;
  const warnBytes = vscode.workspace.getConfiguration("governor").get<number>("warnFileBytes", 400000);
  let size = 0;
  try {
    size = (await vscode.workspace.fs.stat(doc.uri)).size;
  } catch {
    size = Buffer.byteLength(doc.getText(), "utf8");
  }
  if (size < warnBytes) return;
  const pick = await vscode.window.showWarningMessage(
    "Governor: " + vscode.workspace.asRelativePath(doc.uri) + " is " + formatBytes(size) + ". Large files inflate agent context.",
    "Draft Lean Brief",
    "Dismiss"
  );
  if (pick === "Draft Lean Brief") {
    await vscode.commands.executeCommand("governor.draftBrief");
  }
}
