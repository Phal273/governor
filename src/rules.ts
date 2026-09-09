import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const RULE_BODY = "---\ndescription: Governor lean scoping rules for Cursor agents\nglobs:\nalwaysApply: true\n---\n\n# Governor Lean Rules\n\n- Prefer the smallest relevant file set. Do not open or summarize the whole repo.\n- Respect ignore files and skip heavy, generated, media, and binary paths.\n- When editing, touch only files named in the brief or clearly required by the task.\n- Prefer diffs and targeted reads over dumping large files into context.\n- Ask before scanning directories that look generated, vendored, or archival.\n- Keep answers and plans short; avoid repeating file contents already in context.\n";

export async function installLeanRules(workspaceFolder: vscode.WorkspaceFolder): Promise<string> {
  const rulesDir = path.join(workspaceFolder.uri.fsPath, ".cursor", "rules");
  const filePath = path.join(rulesDir, "governor-lean.mdc");
  fs.mkdirSync(rulesDir, { recursive: true });
  const existed = fs.existsSync(filePath);
  fs.writeFileSync(filePath, RULE_BODY.endsWith("\n") ? RULE_BODY : RULE_BODY + "\n", "utf8");
  return existed ? "updated" : "created";
}
