# Governor

Reduce token and cost waste in Cursor and VS Code agent runs by scoping hard.

Governor watches open editors, warns on bloated files, installs lean ignore rules,
drafts tight briefs from your selection, and keeps a dark/gold control panel in the activity bar.

- Site: https://governor.zoitra.com
- Source: https://github.com/Phal273/governor

## Features

- **Open-editor meter** — estimate tokens in open editors (status bar + panel)
- **Large-file warnings** — nudge when a file over `governor.warnFileBytes` opens
- **Install/Upgrade `.cursorignore`** — ship a lean default ignore set
- **Install lean rules** — write `.cursor/rules/governor-lean.mdc`
- **Draft lean brief** — selection-aware brief you can copy into an agent chat
- **Scan bloat** — find heavy paths that should stay out of context

## Install from VSIX

### Quick (CLI)

```bash
# VS Code
code --install-extension governor-0.1.0.vsix

# Cursor
cursor --install-extension governor-0.1.0.vsix
```

### From the UI

1. Download `governor-0.1.0.vsix` from Releases or build it locally
2. VS Code / Cursor: Extensions view → `...` → **Install from VSIX...**
3. Reload the window
4. Open the **Governor** icon in the activity bar


## Commands

| Command | What it does |
| --- | --- |
| Governor: Open Panel | Focus the Governor view |
| Governor: Refresh Meter | Recompute open-editor tokens |
| Governor: Install/Upgrade .cursorignore | Write lean ignore patterns |
| Governor: Install Lean Rules | Write governor-lean.mdc |
| Governor: Draft Lean Brief | Build a brief from the active selection |
| Governor: Scan Bloat | List heavy workspace files |
| Governor: Copy Brief to Clipboard | Copy the latest brief |

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `governor.showStatusBar` | `true` | Show the token meter in the status bar |
| `governor.warnFileBytes` | `400000` | Warn when opening files larger than this |
| `governor.charsPerToken` | `4` | Characters-per-token estimate |

## Build

Requirements: Node.js 20+

```bash
npm install
npm run compile
npm run package
```

That produces `governor-0.1.0.vsix` in the repo root.

## License

MIT — Ethan Mooneyham, 2026
