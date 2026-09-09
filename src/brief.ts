import * as vscode from "vscode";

export type LeanBrief = {
  title: string;
  goal: string;
  scopeFiles: string[];
  selection: string;
  constraints: string[];
  text: string;
};

export function draftLeanBrief(editor: vscode.TextEditor | undefined): LeanBrief {
  const constraints = [
    "Stay inside the listed scope files unless a dependency forces a tiny extra read.",
    "Do not dump large files; quote only the lines you change.",
    "Prefer a short plan, then a minimal diff.",
    "Skip generated, vendored, lock, and media paths."
  ];
  if (!editor) {
    const text = [
      "# Governor Lean Brief",
      "",
      "## Goal",
      "Describe the change you want.",
      "",
      "## Scope",
      "- (open a file / select code, then re-run Draft Lean Brief)",
      "",
      "## Constraints",
      ...constraints.map((c) => "- " + c),
      ""
    ].join("\n");
    return { title: "Lean Brief", goal: "Describe the change you want.", scopeFiles: [], selection: "", constraints, text };
  }
  const doc = editor.document;
  const rel = doc.uri.scheme === "untitled" ? doc.fileName : vscode.workspace.asRelativePath(doc.uri);
  const sel = editor.selection;
  const selected = sel.isEmpty ? "" : doc.getText(sel);
  const startLine = sel.isEmpty ? 1 : sel.start.line + 1;
  const endLine = sel.isEmpty ? Math.max(doc.lineCount, 0) : sel.end.line + 1;
  let snippet = "";
  if (selected) {
    snippet = selected.split(/\r?\n/).slice(0, 40).join("\n");
  } else if (doc.getText().length === 0) {
    snippet = "(empty file)";
  } else {
    const snipEnd = Math.min(19, Math.max(doc.lineCount - 1, 0));
    snippet = doc.getText(new vscode.Range(0, 0, snipEnd, Number.MAX_SAFE_INTEGER));
    const lines = snippet.split(/\r?\n/);
    if (lines.length > 20) snippet = lines.slice(0, 20).join("\n");
  }
  const goal = selected
    ? "Work on the selected region in " + rel + " (lines " + startLine + "-" + endLine + ")."
    : "Work on " + rel + " with minimal surrounding context.";
  const scopeFiles = [rel];
  const text = [
    "# Governor Lean Brief",
    "",
    "## Goal",
    goal,
    "",
    "## Scope",
    "- " + rel + (selected ? "#L" + startLine + "-L" + endLine : ""),
    "",
    "## Context snippet",
    "```",
    snippet.trimEnd(),
    "```",
    "",
    "## Constraints",
    ...constraints.map((c) => "- " + c),
    ""
  ].join("\n");
  return { title: "Lean Brief", goal, scopeFiles, selection: selected, constraints, text };
}
