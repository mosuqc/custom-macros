# Custom Macros for CardMirror — Handoff

## Setup Instructions (for the human)

1. `git clone https://github.com/mosuqc/custom-macros.git`
2. Install [Node.js](https://nodejs.org) if not already installed
3. `cd custom-macros/editor && npm install && npm start` to launch the macro editor
4. To install the plugin in CardMirror: Settings → Plugins → install from `mosuqc/custom-macros`
   - If blocked by the allowlist, open CardMirror's dev console and run `__plugins('community-on')`
5. Raw `.cmcm` macro files live in `%APPDATA%/custom-macros/macros/` (Windows) / `~/Library/Application Support/custom-macros/macros/` (macOS) / `$XDG_DATA_HOME/custom-macros/macros/` (Linux). These are NOT in the repo — recreate them in the editor or copy from the old machine.
6. After creating/editing macros in the editor, click **Build Plugin** to bake them into `plugin/plugin.js`, then commit, push, create a new GitHub release with the two assets (`plugin/cardmirror-plugin.json` and `plugin/plugin.js`), reinstall in CardMirror, and restart.

---

## Context for the next Claude agent

### What this project is

**Custom Macros** is a CardMirror plugin that adds multi-step macro support. CardMirror is an open-source Electron debate/evidence app that uses ProseMirror as its editor. Its native `keyboardMacros` system only supports single text insertion — this plugin fills the gap with sequenced steps: text insertion, date formatting, and CardMirror command execution.

The project has two components:
- **Macro Editor** (`editor/`) — a standalone Electron app for creating, editing, and managing `.cmcm` macro files
- **CardMirror Plugin** (`plugin/`) — `plugin.js` + `cardmirror-plugin.json` that registers macros as commands in CardMirror's command palette

### Repo structure

```
custom-macros/
├── editor/                        # Macro Editor (Electron, vanilla JS)
│   ├── package.json
│   ├── main.js                    # Main process: window, IPC file ops, Build Plugin logic
│   ├── preload.js                 # contextBridge IPC for renderer
│   └── renderer/
│       ├── index.html             # UI: sidebar + editor area + command browser dialog
│       ├── styles.css             # Light/dark theme
│       ├── editor.js              # Editor logic: step CRUD, save/load, command browser, build
│       ├── cmcm.js                # .cmcm parser/serializer (shared format module)
│       ├── commands.js            # Full 168-command CardMirror database by group
│       └── date-formats.js        # Date format token replacement + presets
├── plugin/
│   ├── cardmirror-plugin.json     # Plugin manifest (id: custom-macros, apiVersion: 1)
│   └── plugin.js                  # Self-contained plugin with embedded macro data
├── .gitignore
└── handoff.md                     # This file
```

### How the plugin works

CardMirror's renderer has `nodeIntegration: false`, so the plugin **cannot** use `require('fs')`. Instead, macros are **baked into plugin.js as a JSON array** between `// __MACROS_START__` and `// __MACROS_END__` markers. The editor's "Build Plugin" button reads all `.cmcm` files from the shared macros directory and rewrites `plugin/plugin.js` with the macro data embedded.

**Execution engine:**
- `Insert:Text:` → `document.execCommand('insertText', false, text)` on the `.ProseMirror` element
- `Insert:Date:` → format date with token replacement, then insert as text
- `CardMirror:` → dispatch `KeyboardEvent('keydown', ...)` matching the command's default keybinding

**Known limitation:** ~100 of 168 CardMirror commands have no default keybinding. The KeyboardEvent approach only works for commands that have one. The editor shows a "no keybind" warning on these.

### .cmcm file format

```
NAME: HSTag
1. Insert:Text:accessed 
2. Insert:Date:m.dd.yy
3. Insert:Text: // 
4. CardMirror:Bold
5. CardMirror:Italic
6. Insert:Text:mosuQ
7. CardMirror:Bold
8. CardMirror:Italic
9. Insert:Text:]
```

- `NAME:` required first line
- `#` lines are comments
- `Insert:Text:<content>` — literal text (everything after second colon, trailing spaces preserved)
- `Insert:Date:<format>` — date tokens: `m`, `mm`, `d`, `dd`, `yy`, `yyyy`, `MON`, `Mon`, `MONTH`, `Month` (greedy longest-match)
- `CardMirror:<label>` — fires command by its display label (e.g., "Bold", not "toggleBold")
- Step numbers are cosmetic; order is by line position

### CardMirror plugin API reference

Full docs: https://github.com/ant981228/cardmirror/blob/main/reference-docs/cardmirror-plugin-api.md

Key points:
- Plugins register via `window.__registerCardMirrorPlugin({ id, name, apiVersion: 1, commands, settings })`
- Each command needs `id` (prefixed with `<pluginId>.`), `label`, `run(api)` function
- `api.showToast(msg)`, `api.storage.get/set`, `api.settings.get` are available
- No `insertText()` or `dispatchCommand()` in the API — hence the DOM-level workarounds
- Plugins are distributed as GitHub releases with `cardmirror-plugin.json` + `plugin.js` assets
- Keybinding format is ProseMirror-style: `Mod-b`, `F4`, `Mod-Shift-=` (`Mod` = Ctrl on Win/Linux, Cmd on macOS)

### Release workflow

1. Make changes
2. Bump `version` in `plugin/cardmirror-plugin.json` to match the new tag
3. If macros changed, run Build Plugin in the editor (or manually edit the `MACROS` array in `plugin/plugin.js`)
4. Commit and push
5. `gh release create vX.Y.Z plugin/cardmirror-plugin.json plugin/plugin.js --title "vX.Y.Z" --notes "..."`
6. In CardMirror: reinstall from `mosuqc/custom-macros`, restart

### What's been tested and working

- HSTag macro: inserts `accessed 8.10.26 // **_mosuQ_**]` with correct bold+italic formatting
- Plugin installs and shows in CardMirror's Plugins tab (v1.1.0)
- Macros appear in command palette as "Macro: <name>" and can be assigned keybinds
- Community-mode install works via `__plugins('community-on')` in dev console

### What's planned but not yet built

- **Editor hasn't been launched yet** — Node.js was not available on the first dev machine. The full Electron editor UI is written but untested. Expect bugs on first run.
- **Conditionals, loops, variables** — planned for v2, not in v1
- **Additional Insert types** (`Clipboard:`, `Prompt:`, `Counter:`) — planned for future
- **KeyboardEvent simulation may not work for all commands** — ProseMirror may check `event.isTrusted` in some code paths. If this surfaces, the fallback is to request `dispatchCommand()` be added to CardMirror's plugin API.

### GitHub

- Repo: https://github.com/mosuqc/custom-macros
- Owner: mosuqc
- Auth: `gh auth login` (GitHub CLI)
- CardMirror source: https://github.com/ant981228/cardmirror
