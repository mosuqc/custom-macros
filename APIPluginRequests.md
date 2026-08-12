# CardMirror Plugin API — Feature Requests for Custom Macros

Hi — I maintain [Custom Macros](https://github.com/mosuqc/custom-macros), a CardMirror plugin that adds multi-step macro support (text insertion, date formatting, command sequencing, conditionals, loops, variables). The plugin works, but four missing API capabilities force it into fragile DOM-level workarounds that will eventually break. I'm documenting all four here so we can address them in one pass rather than coming back piecemeal.

Everything below includes **what** it is, **why** it's needed, **security implications**, and **concrete code change suggestions** against the current source. The code suggestions reference `src/editor/plugin-api.ts` and `src/editor/plugin-registry.ts` as they exist today.

---

## 1. `api.exec(commandId)` — Run any command by its internal ID

### What it does

Lets a plugin invoke any registered CardMirror command (built-in or plugin-provided) by its string ID — e.g., `api.exec('toggleBold')`, `api.exec('applyBlockStyle')`.

### Why it's needed

Custom Macros needs to fire CardMirror commands as steps in a macro sequence. Right now, it does this by constructing synthetic `KeyboardEvent`s and dispatching them on the `.ProseMirror` element:

```js
var event = new KeyboardEvent('keydown', {
  key: 'b', ctrlKey: true, bubbles: true, cancelable: true,
});
document.querySelector('.ProseMirror').dispatchEvent(event);
```

This has three problems:

1. **100 of 168 commands have no default keybinding.** They are completely unreachable — the plugin literally cannot invoke them. Every "Speech", "Collaboration", "Quick Card", "Dropzone", and most "AI" commands are dead to macros.

2. **Synthetic events may fail.** `KeyboardEvent`s created with `new KeyboardEvent()` have `event.isTrusted === false`. If ProseMirror or a future Electron update checks `isTrusted` on keydown handlers, every command invocation breaks at once.

3. **User keybinding changes break it.** The plugin ships a hardcoded 68-entry map of `{ label → default keybinding }`. If a user rebinds Ctrl+B to something else, `CardMirror:Bold` in a macro fires the wrong command silently.

`api.exec(commandId)` eliminates all three problems with one method.

### Security implications

**Minimal additional risk.** Plugins are already full-trust code running in the renderer with access to the DOM, localStorage, and the full `window` scope. A plugin that wanted to call `toggleBold` can already do so via the KeyboardEvent workaround (for the 68 commands that have keybindings). `api.exec` just makes it reliable and extends it to the other 100 commands. It doesn't grant any capability the trust model doesn't already permit.

The one consideration: `api.exec` makes destructive commands (e.g., closing documents, deleting content) easier to call programmatically. If a future sandboxing effort (mentioned as a possibility for v2 in the spec) wants to gate certain commands, `exec` is the natural chokepoint — you could add an allowlist filter inside it rather than trying to intercept synthetic keyboard events.

### Suggested implementation

The infrastructure already exists. `runPluginCommand(id)` in `plugin-registry.ts` dispatches plugin commands by ID. The built-in ribbon command system dispatches through `RIBBON_COMMAND_IDS` and the keymap stack. The `AnyCommandId` type already unions both.

**In `src/editor/plugin-api.ts`:**

Add `exec` to the `CardMirrorPluginApi` interface:

```typescript
export interface CardMirrorPluginApi {
  readonly appVersion: string;
  // ... existing methods ...

  /** Run any registered command (built-in or plugin) by its ID.
   *  Returns true if the command was found and executed. */
  exec(commandId: string): boolean;
}
```

Add a `runCommand` callback to `PluginApiDeps`:

```typescript
export interface PluginApiDeps {
  // ... existing deps ...

  /** Execute a command by its AnyCommandId string.
   *  Covers both ribbon commands and plugin commands. */
  runCommand(commandId: string): boolean;
}
```

Add the implementation in `createPluginApi`:

```typescript
export function createPluginApi(pluginId: string, deps: PluginApiDeps): CardMirrorPluginApi {
  // ... existing code ...

  return {
    // ... existing methods ...

    exec(commandId) {
      return deps.runCommand(commandId);
    },
  };
}
```

**At the call site** (wherever `createPluginApi` is called — likely in the editor initialization code that passes `PluginApiDeps`):

The `runCommand` implementation needs to handle both built-in and plugin commands. You already have the pieces:

```typescript
// In the PluginApiDeps construction:
runCommand(commandId: string): boolean {
  // Try plugin commands first (already implemented in plugin-registry.ts)
  if (isPluginCommandId(commandId)) {
    return runPluginCommand(commandId);
  }
  // Try built-in ribbon commands
  // (this depends on your internal dispatch — something like
  //  executeRibbonCommand(commandId, view) using whatever
  //  mechanism the keymap system uses to fire commands)
  return executeRibbonCommand(commandId);
},
```

The exact built-in dispatch depends on how `ribbon-commands.ts` currently fires commands internally. The keymap handler already does this when a keybinding is pressed — `exec` just needs to call into the same path without a keyboard event.

---

## 2. `api.insertText(text)` — Insert text at cursor via ProseMirror transactions

### What it does

Inserts a string at the current cursor position (or replaces the current selection) through ProseMirror's transaction system.

### Why it's needed

Custom Macros currently inserts text using the deprecated `document.execCommand('insertText')` API:

```js
var editor = document.querySelector('.ProseMirror[contenteditable="true"]');
editor.focus();
document.execCommand('insertText', false, text);
```

With a fallback to synthetic `InputEvent` dispatch:

```js
var event = new InputEvent('beforeinput', {
  inputType: 'insertText', data: text,
  bubbles: true, cancelable: true,
});
editor.dispatchEvent(event);
```

Problems:

1. **`document.execCommand` is deprecated.** Browsers are actively removing it. Chrome still supports it but it could disappear in any Electron update.

2. **Bypasses ProseMirror's state management.** DOM-level text insertion doesn't go through ProseMirror's transaction system. This can corrupt undo history, break collaboration sync (if collab is ever used alongside macros), and confuse any ProseMirror plugin that tracks transactions.

3. **Newlines require a separate hack.** The macro's `Insert:Newline` step currently fakes an Enter keypress (`new KeyboardEvent('keydown', { key: 'Enter', ... })`), which has the same `isTrusted` fragility as the command dispatch issue.

A proper `api.insertText(text)` that goes through `view.dispatch(tr.insertText(text))` fixes all three problems. Newline insertion could be handled by this method (inserting `\n`) or by `api.exec('splitBlock')` if you add `exec` — either way, the DOM hack goes away.

### Security implications

**None beyond existing trust model.** A full-trust plugin can already write arbitrary content to the editor via `document.execCommand` or direct DOM manipulation. `api.insertText` just makes it go through ProseMirror properly, which is strictly better for document integrity.

### Suggested implementation

**In `src/editor/plugin-api.ts`:**

Add to the interface:

```typescript
export interface CardMirrorPluginApi {
  // ... existing methods ...

  /** Insert text at the current cursor position or replace the
   *  current selection. Goes through ProseMirror transactions
   *  so undo, collab, and plugins all see the change. */
  insertText(text: string): boolean;
}
```

Add the implementation in `createPluginApi`:

```typescript
export function createPluginApi(pluginId: string, deps: PluginApiDeps): CardMirrorPluginApi {
  // ... existing code ...

  return {
    // ... existing methods ...

    insertText(text) {
      const view = deps.getView();
      if (!view) return false;

      const { state } = view;
      const { from, to } = state.selection;
      const tr = state.tr.insertText(text, from, to);
      view.dispatch(tr);
      view.focus();
      return true;
    },
  };
}
```

That's it. `deps.getView()` already exists in `PluginApiDeps` — no new dependencies needed. ProseMirror's `tr.insertText()` handles cursor advancement, selection replacement, and transaction propagation automatically.

If you want to keep newline insertion separate from `exec` (not everyone has a `splitBlock` command ID memorized), you could also accept `\n` in `insertText` and convert it to a block split:

```typescript
insertText(text) {
  const view = deps.getView();
  if (!view) return false;

  // Split on newlines: insert text segments with block splits between
  const parts = text.split('\n');
  let tr = view.state.tr;
  const { from, to } = view.state.selection;

  if (parts.length === 1) {
    tr = tr.insertText(text, from, to);
  } else {
    // Replace selection with first segment, then split+insert for rest
    tr = tr.insertText(parts[0], from, to);
    for (let i = 1; i < parts.length; i++) {
      tr = tr.split(tr.mapping.map(to));
      if (parts[i]) {
        tr = tr.insertText(parts[i], tr.selection.from);
      }
    }
  }

  view.dispatch(tr);
  view.focus();
  return true;
},
```

The simple single-segment version is fine for our needs — multiline is a nice-to-have.

---

## 3. `api.getContext()` — Read the structural hierarchy at the cursor

### What it does

Returns the structural ancestry of the node at the current cursor position — which Pocket, Hat, Block, Tag, etc. the cursor is inside, plus the document name. Something like:

```typescript
interface DocContext {
  documentName: string | null;
  pocket: string | null;
  hat: string | null;
  block: string | null;
  tag: string | null;
  analytic: string | null;
  undertag: string | null;
  cite: string | null;
}
```

### Why it's needed

Custom Macros has a full condition grammar for context-aware macro behavior:

```
IF Pocket.contains("2AC") OR DocumentName.contains("2AC")
  SET !speech = "1NC"
ELIF Pocket.contains("2NC") OR Pocket.contains("1NR")
  SET !speech = "2AC"
END
```

This is fully parsed, validated, and the editor has autocomplete for it — but at runtime, every `Element.contains()` condition evaluates to `false` because the plugin has no way to read the document structure. The plugin currently shows a toast: *"Document queries require CardMirror API v2"* and falls through to defaults.

`docInfo()` gives us the document title but not the structural position within the document. We need to know *where in the doc tree* the cursor sits.

### Also needed: `api.querySiblings(nodeType)`

Returns text content of sibling nodes of a given structural type near the cursor. Used for:

```
SET !flowNum = COUNT(Nearby.Blocks.containing(!speech)) + 1
```

This counts how many sibling Block headings contain a specific label (e.g., "1NC") to auto-number flow blocks. The parser and expression evaluator handle this — only the document query is missing.

```typescript
interface SiblingResult {
  /** Text content of each sibling heading of the requested type. */
  siblings: string[];
}
```

### Security implications

**Read-only document access — no new write capability.** This exposes the text content of structural headings near the cursor. Plugins already have full DOM access and could `querySelectorAll` their way through the rendered document, but that approach is fragile and doesn't map cleanly to ProseMirror's document model. Providing a proper read API is safer than having plugins scrape the DOM.

If future sandboxing restricts DOM access, `getContext()` would become the *only* way for plugins to read document structure — having it go through the API means you have a single point to add permission checks.

### Suggested implementation

**In `src/editor/plugin-api.ts`:**

Add the types and methods:

```typescript
export interface DocContext {
  documentName: string | null;
  pocket: string | null;
  hat: string | null;
  block: string | null;
  tag: string | null;
  analytic: string | null;
  undertag: string | null;
  cite: string | null;
}

export interface CardMirrorPluginApi {
  // ... existing methods ...

  /** Structural hierarchy at the current cursor position. */
  getContext(): DocContext | null;

  /** Text content of sibling nodes of the given structural type
   *  within the same parent container. */
  querySiblings(nodeType: string): string[];
}
```

The implementation walks ProseMirror's resolved position to find ancestors:

```typescript
getContext() {
  const view = deps.getView();
  if (!view) return null;

  const { state } = view;
  const $pos = state.selection.$from;
  const ident = deps.getDocIdentity();

  const context: DocContext = {
    documentName: ident?.docTitle ?? null,
    pocket: null, hat: null, block: null, tag: null,
    analytic: null, undertag: null, cite: null,
  };

  // Walk ancestors from cursor to root
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    const typeName = node.type.name;  // e.g., 'pocket', 'hat', 'block'

    // Map ProseMirror node type names to context keys
    // (adjust the mapping if your internal type names differ)
    if (typeName in context && context[typeName as keyof DocContext] === null) {
      // Get the heading text — typically the first child
      // or a specific heading node within the container
      const heading = findHeadingText(node);
      (context as any)[typeName] = heading;
    }
  }

  return context;
},
```

The `findHeadingText` helper depends on your document schema — in most CardMirror structures, each container (pocket, hat, block) has a heading child node whose `textContent` is the display name:

```typescript
function findHeadingText(containerNode: Node): string | null {
  // Walk the first few children looking for a heading-type node
  for (let i = 0; i < Math.min(containerNode.childCount, 3); i++) {
    const child = containerNode.child(i);
    // Adjust this check to match your schema's heading node types
    if (child.type.name.endsWith('Head') || child.type.name.endsWith('Heading')) {
      return child.textContent || null;
    }
  }
  // Fallback: first child's text
  return containerNode.firstChild?.textContent || null;
}
```

For `querySiblings`:

```typescript
querySiblings(nodeType) {
  const view = deps.getView();
  if (!view) return [];

  const { state } = view;
  const $pos = state.selection.$from;

  // Find the nearest ancestor that contains children of nodeType
  for (let d = $pos.depth; d > 0; d--) {
    const parent = $pos.node(d);
    const siblings: string[] = [];

    parent.forEach((child) => {
      if (child.type.name === nodeType) {
        const heading = findHeadingText(child);
        if (heading !== null) siblings.push(heading);
      }
    });

    if (siblings.length > 0) return siblings;
  }

  return [];
},
```

You know your schema better than I do — the node type names (`pocket`, `hat`, `block`, etc.) and the heading structure may need adjustment. The `ExtractedKind` type already lists the valid structural types (`'pocket' | 'hat' | 'block' | 'tag' | 'analytic' | 'undertag' | 'cite'`), so the mapping should be straightforward.

---

## 4. `api.getSelectedText()` — Return the raw text of the current selection

### What it does

Returns the plain text content of the current editor selection, or an empty string if nothing is selected.

```typescript
/** Raw text of the current selection, or "" if collapsed. */
getSelectedText(): string;
```

### Why it's needed

`extractSelection()` already exists but returns structured `ExtractedItem[]` objects decomposed by heading type — it's designed for flowing/extraction workflows, not for "give me the selected text." A macro that wants to transform or wrap selected text (e.g., wrap in brackets, prefix with a label, convert case) needs the raw string.

Use case example — a macro that wraps the selection in a citation format:

```
1. SET !sel = Selection
2. CardMirror:Bold
3. Insert:Text:[
4. Insert:!sel
5. Insert:Text:]
```

This would require a way to capture the selection text into a variable before the macro modifies it.

### Security implications

**None.** `extractSelection()` already exposes document content in a more structured form. `getSelectedText()` is strictly less information — just the raw text, no docId, no source tokens, no structural decomposition.

### Suggested implementation

**In `src/editor/plugin-api.ts`:**

```typescript
export interface CardMirrorPluginApi {
  // ... existing methods ...

  /** Plain text of the current selection, or "" if nothing is selected. */
  getSelectedText(): string;
}
```

Implementation in `createPluginApi`:

```typescript
getSelectedText() {
  const view = deps.getView();
  if (!view) return '';

  const { state } = view;
  const { from, to } = state.selection;
  if (from === to) return '';

  return state.doc.textBetween(from, to, '\n');
},
```

Three lines of logic. `state.doc.textBetween()` is a built-in ProseMirror method that extracts text content between two positions, joining blocks with the specified separator (newline in this case).

---

## Summary

| Method | What it replaces | Risk of current workaround |
|---|---|---|
| `api.exec(id)` | Synthetic `KeyboardEvent` dispatch | 100 commands unreachable; `isTrusted` failure; keybind drift |
| `api.insertText(text)` | Deprecated `document.execCommand` | Bypasses ProseMirror state; undo/collab breakage; deprecation |
| `api.getContext()` | Nothing — completely missing | All conditions evaluate to `false` |
| `api.querySiblings(type)` | Nothing — completely missing | All `COUNT()` expressions return `0` |
| `api.getSelectedText()` | Partial overlap with `extractSelection()` | Can't capture raw selection for transformation macros |

None of these expand the trust boundary — plugins are already full-trust renderer code. These methods just route plugin operations through ProseMirror's proper APIs instead of around them, which is better for document integrity, undo history, and collaboration correctness.

If there's a preferred way to submit these (issue, PR, discussion), let me know and I'll use that instead. Happy to pair on the implementation if it would help.

— Q (mosuqc)
