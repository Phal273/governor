import * as vscode from "vscode";
import { MeterSnapshot, formatTokens, formatBytes } from "./meter";
import { BloatHit } from "./bloat";

const ALLOWED_COMMANDS = new Set([
  "governor.refresh",
  "governor.draftBrief",
  "governor.installCursorignore",
  "governor.installRules",
  "governor.scanBloat",
  "governor.copyBrief",
  "governor.open"
]);

export class GovernorPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = "governor.panel";
  private view?: vscode.WebviewView;
  private meter?: MeterSnapshot;
  private bloat: BloatHit[] = [];
  private briefText = "";

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.render();
    webviewView.webview.onDidReceiveMessage((msg) => {
      if (!msg || typeof msg.command !== "string") return;
      if (!ALLOWED_COMMANDS.has(msg.command)) return;
      void vscode.commands.executeCommand(msg.command);
    });
  }

  setMeter(meter: MeterSnapshot): void { this.meter = meter; this.refresh(); }
  setBloat(bloat: BloatHit[]): void { this.bloat = bloat; this.refresh(); }
  setBrief(text: string): void { this.briefText = text; this.refresh(); }
  refresh(): void { if (this.view) this.view.webview.html = this.render(); }

  private truncatePath(p: string, max = 42): string {
    if (p.length <= max) return p;
    return "…" + p.slice(-(max - 1));
  }

  private render(): string {
    const m = this.meter;
    const tokens = m ? m.tokens : 0;
    const files = m ? m.files : [];
    const fileCount = m ? m.fileCount : 0;
    const totalBytes = m ? m.bytes : 0;
    const budget = vscode.workspace.getConfiguration("governor").get<number>("softTokenBudget", 32000);
    const pct = Math.max(0, Math.min(100, Math.round((tokens / Math.max(budget, 1)) * 100)));
    const fileRows = files.slice(0, 8).map((f) => {
      const full = escapeHtml(f.path);
      const short = escapeHtml(this.truncatePath(f.path));
      return `<tr><td title="${full}">${short}</td><td class="num">${formatTokens(f.tokens)}</td><td class="num">${f.lines}</td></tr>`;
    }).join("");
    const bloatRows = this.bloat.slice(0, 8).map((b) => {
      const full = escapeHtml(b.path);
      const short = escapeHtml(this.truncatePath(b.path));
      return `<tr><td title="${full}">${short}</td><td class="num">${formatBytes(b.bytes)}</td><td>${escapeHtml(b.reason)}</td></tr>`;
    }).join("");
    const briefPreview = escapeHtml(this.briefText || "Draft a lean brief from the active selection.");
    const meta = escapeHtml(fileCount + " files · " + formatBytes(totalBytes));
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
:root{--bg:#14110f;--panel:#1c1814;--ink:#f3e6c7;--muted:#a89878;--gold:#d4a017;--gold2:#f0c14b;--line:#3a3228;--danger:#c45c26;}
*{box-sizing:border-box}
body{margin:0;padding:12px;font:12px/1.45 ui-sans-serif,system-ui,sans-serif;color:var(--ink);background:radial-gradient(1200px 600px at 0% 0%,#2a2116 0%,var(--bg) 55%);}
h1{margin:0 0 4px;font-size:16px;letter-spacing:0.04em;color:var(--gold2)}
h2{margin:16px 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted)}
.sub{color:var(--muted);margin-bottom:12px}
.meta{color:var(--muted);margin-top:6px;font-variant-numeric:tabular-nums}
.meter{display:flex;gap:8px;align-items:end;padding:12px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(180deg,#241c14,var(--panel));box-shadow:inset 0 1px 0 #00000055}
.meter .big{font-size:28px;font-weight:700;color:var(--gold);font-variant-numeric:tabular-nums}
.meter .unit{color:var(--muted);margin-bottom:4px}
.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
button{appearance:none;border:1px solid var(--line);background:#2a221a;color:var(--ink);border-radius:10px;padding:8px 10px;cursor:pointer;font-weight:600}
button.primary{background:linear-gradient(180deg,var(--gold2),var(--gold));color:#1a1208;border-color:#8a6a12}
button:hover{filter:brightness(1.08)}
table{width:100%;border-collapse:collapse}
th,td{padding:6px 4px;border-bottom:1px solid var(--line);text-align:left}
th{color:var(--muted);font-weight:600}
td.num{text-align:right;font-variant-numeric:tabular-nums}
td[title]{max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.brief{white-space:pre-wrap;padding:10px;border-radius:10px;border:1px dashed var(--line);background:#100e0c;color:var(--ink);max-height:180px;overflow:auto}
.gauge{height:8px;border-radius:999px;background:#2b241c;overflow:hidden;margin-top:8px}
.gauge>i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--danger))}
</style>
</head>
<body>
  <h1>Governor</h1>
  <div class="sub">Scope hard. Spend fewer tokens.</div>
  <div class="meter">
    <div class="big">${formatTokens(tokens)}</div>
    <div class="unit">est. tokens in open editors</div>
  </div>
  <div class="meta">${meta}</div>
  <div class="gauge"><i style="width:${pct}%"></i></div>
  <div class="actions">
    <button class="primary" data-cmd="governor.refresh">Refresh</button>
    <button data-cmd="governor.draftBrief">Draft Brief</button>
    <button data-cmd="governor.installCursorignore">Install Ignore</button>
    <button data-cmd="governor.installRules">Install Rules</button>
    <button data-cmd="governor.scanBloat">Scan Bloat</button>
    <button data-cmd="governor.copyBrief">Copy Brief</button>
  </div>
  <h2>Open editors</h2>
  <table><thead><tr><th>File</th><th>Tok</th><th>Lines</th></tr></thead><tbody>${fileRows || "<tr><td colspan=3>No editors</td></tr>"}</tbody></table>
  <h2>Bloat scan</h2>
  <table><thead><tr><th>Path</th><th>Size</th><th>Why</th></tr></thead><tbody>${bloatRows || "<tr><td colspan=3>Run Scan Bloat</td></tr>"}</tbody></table>
  <h2>Lean brief</h2>
  <div class="brief">${briefPreview}</div>
  <script>
    const vscode = acquireVsCodeApi();
    for (const btn of document.querySelectorAll("[data-cmd]")) {
      btn.addEventListener("click", () => vscode.postMessage({ command: btn.getAttribute("data-cmd") }));
    }
  </script>
</body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
