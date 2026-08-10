// Custom Macros — CardMirror Plugin
// Loads .cmcm macro files and registers them as executable commands.

(function () {
  'use strict';

  // ---- Platform directory resolution ----

  function getMacrosDir() {
    var path, os;
    try {
      path = require('path');
      os = require('os');
    } catch (_) {
      return null;
    }
    var platform = process.platform;
    if (platform === 'win32') {
      return path.join(process.env.APPDATA, 'custom-macros', 'macros');
    } else if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'custom-macros', 'macros');
    } else {
      var xdg = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
      return path.join(xdg, 'custom-macros', 'macros');
    }
  }

  // ---- .cmcm parser (inlined) ----

  function parseCmcm(text) {
    var lines = text.split('\n');
    var name = null;
    var steps = [];
    var foundName = false;

    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      if (trimmed === '') continue;

      if (!foundName) {
        var nameMatch = trimmed.match(/^NAME:\s*(.+)$/i);
        if (!nameMatch) continue;
        name = nameMatch[1].trim();
        foundName = true;
        continue;
      }

      if (trimmed.startsWith('#')) {
        steps.push({ type: 'comment', text: trimmed.slice(1).trim() });
        continue;
      }

      var stepContent = trimmed.replace(/^\d+\.\s*/, '');

      if (stepContent.startsWith('Insert:Text:')) {
        steps.push({ type: 'insert-text', content: stepContent.slice(12) });
      } else if (stepContent.startsWith('Insert:Date:')) {
        steps.push({ type: 'insert-date', format: stepContent.slice(12) });
      } else if (stepContent.startsWith('CardMirror:')) {
        steps.push({ type: 'cardmirror', label: stepContent.slice(11).trim() });
      }
    }

    return name ? { name: name, steps: steps } : null;
  }

  // ---- Date formatting (inlined) ----

  var MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  var MONTH_ABBR = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec',
  ];

  var DATE_TOKENS = [
    { p: 'MONTH', fn: function(d) { return MONTH_NAMES[d.getMonth()].toUpperCase(); } },
    { p: 'Month', fn: function(d) { return MONTH_NAMES[d.getMonth()]; } },
    { p: 'month', fn: function(d) { return MONTH_NAMES[d.getMonth()].toLowerCase(); } },
    { p: 'MON',   fn: function(d) { return MONTH_ABBR[d.getMonth()].toUpperCase(); } },
    { p: 'Mon',   fn: function(d) { return MONTH_ABBR[d.getMonth()]; } },
    { p: 'mon',   fn: function(d) { return MONTH_ABBR[d.getMonth()].toLowerCase(); } },
    { p: 'yyyy',  fn: function(d) { return String(d.getFullYear()); } },
    { p: 'yy',    fn: function(d) { return String(d.getFullYear()).slice(-2); } },
    { p: 'mm',    fn: function(d) { return String(d.getMonth() + 1).padStart(2, '0'); } },
    { p: 'dd',    fn: function(d) { return String(d.getDate()).padStart(2, '0'); } },
    { p: 'm',     fn: function(d) { return String(d.getMonth() + 1); } },
    { p: 'd',     fn: function(d) { return String(d.getDate()); } },
  ];

  function formatDate(fmt, date) {
    var result = '';
    var i = 0;
    while (i < fmt.length) {
      var matched = false;
      for (var t = 0; t < DATE_TOKENS.length; t++) {
        var tok = DATE_TOKENS[t];
        if (fmt.substr(i, tok.p.length) === tok.p) {
          result += tok.fn(date);
          i += tok.p.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        result += fmt[i];
        i++;
      }
    }
    return result;
  }

  // ---- Label-to-keybind map (subset of commands with keybindings) ----

  var LABEL_KEYBIND_MAP = {
    'new document': 'Mod-n',
    'open file': 'Mod-o',
    'save': 'Mod-s',
    'save as…': 'Mod-Shift-s',
    'save send doc': 'Mod-Alt-s',
    'save marked cards': 'Mod-Alt-m',
    'send to speech (at cursor)': '`',
    'send to speech (at end)': 'Alt-`',
    'send to dropzone': 'Mod-`',
    'insert received card (at cursor)': 'Mod-p',
    'insert received card (at end)': 'Mod-Alt-p',
    'apply pocket style': 'F4',
    'apply hat style': 'F5',
    'apply block style': 'F6',
    'apply tag style': 'F7',
    'apply analytic style': 'Mod-F7',
    'apply undertag style': 'Mod-F8',
    'number: toggle number role': 'Mod-Alt-1',
    'number: toggle substructure role': 'Mod-Alt-2',
    'number: toggle start-over-here': 'Mod-Alt-3',
    'apply cite style': 'F8',
    'toggle underline': 'F9',
    'underline (toggle while typing)': 'Mod-u',
    'apply emphasis style': 'F10',
    'emphasize acronym': 'Alt-F10',
    'toggle highlight': 'F11',
    'highlight acronym': 'Alt-F11',
    'toggle background color': 'Mod-F11',
    'bold': 'Mod-b',
    'italic': 'Mod-i',
    'superscript': 'Mod-Shift-=',
    'subscript': 'Mod-=',
    'condense': 'F3',
    'condense without paragraph integrity': 'Alt-F3',
    'condense without paragraph integrity (with pilcrows)': 'Mod-Alt-F3',
    'uncondense': 'Mod-Alt-Shift-F3',
    'toggle case': 'Shift-F3',
    'paste plain text': 'F2',
    'clear': 'F12',
    'shrink card text': 'Mod-8',
    'smart shrink (deeper for unmarked paragraphs)': 'Mod-Alt-8',
    'restore card text size': 'Mod-Shift-8',
    'copy previous cite': 'Alt-F8',
    'select current heading': 'Alt-a',
    'move container up': 'Mod-Alt-ArrowUp',
    'move container down': 'Mod-Alt-ArrowDown',
    'reading-position marker (toggle)': 'Mod-Shift-d',
    'find': 'Mod-f',
    'find and replace': 'Mod-h',
    'find without category grouping': 'Alt-f',
    'search everything': 'Mod-Shift-Space',
    'minimize window': 'Mod-m',
    'zoom in': 'Mod-=',
    'zoom out': 'Mod--',
    'chrome scale up': 'Mod-Alt-=',
    'chrome scale down': 'Mod-Alt--',
    'reset chrome scale to 100%': 'Mod-Alt-0',
    'add note to selection': 'Mod-Shift-n',
    'focus slot 1': 'Mod-1',
    'focus slot 2': 'Mod-2',
    'focus slot 3': 'Mod-3',
    'send doc to slot 1': 'Mod-Shift-1',
    'send doc to slot 2': 'Mod-Shift-2',
    'send doc to slot 3': 'Mod-Shift-3',
    'toggle slot expand / restore': 'Mod-Shift-f',
    'close doc or window': 'Mod-w',
    'ask ai about selection': 'Mod-Shift-q',
    'format cite from selection (ai)': 'Mod-Shift-x',
    'translate selection to clipboard (ai)': 'Mod-Shift-t',
    'repair ocr/pdf text (ai)': 'Mod-Shift-r',
    'repair formatting (ai)': 'Mod-Alt-r',
    'toggle voice control': 'Mod-Shift-V',
    'cut card with ai…': 'Mod-Alt-c',
  };

  // ---- Keybind parser ----

  function parseKeybind(keybindStr) {
    var parts = keybindStr.split('-');
    var key = parts[parts.length - 1];
    var ctrl = false, meta = false, shift = false, alt = false;
    var isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

    for (var i = 0; i < parts.length - 1; i++) {
      var mod = parts[i];
      if (mod === 'Mod') {
        if (isMac) meta = true; else ctrl = true;
      } else if (mod === 'Shift') {
        shift = true;
      } else if (mod === 'Alt') {
        alt = true;
      } else if (mod === 'Control') {
        ctrl = true;
      } else if (mod === 'Meta') {
        meta = true;
      }
    }

    return { key: key, ctrlKey: ctrl, metaKey: meta, shiftKey: shift, altKey: alt };
  }

  // ---- Execution engine ----

  function findEditor() {
    return document.querySelector('.ProseMirror[contenteditable="true"]');
  }

  function insertText(text) {
    var editor = findEditor();
    if (!editor) throw new Error('No active editor found');
    editor.focus();
    var ok = document.execCommand('insertText', false, text);
    if (!ok) {
      var event = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: text,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(event);
    }
  }

  function executeCommand(label) {
    var keybind = LABEL_KEYBIND_MAP[label.toLowerCase()];
    if (!keybind) {
      throw new Error('"' + label + '" has no keybinding. Assign one in CardMirror Settings → Keybindings.');
    }

    var editor = findEditor();
    if (!editor) throw new Error('No active editor found');
    editor.focus();

    var parsed = parseKeybind(keybind);
    var event = new KeyboardEvent('keydown', {
      key: parsed.key,
      ctrlKey: parsed.ctrlKey,
      metaKey: parsed.metaKey,
      shiftKey: parsed.shiftKey,
      altKey: parsed.altKey,
      bubbles: true,
      cancelable: true,
    });
    editor.dispatchEvent(event);
  }

  function executeMacro(macro, api) {
    var steps = macro.steps;
    var idx = 0;

    function runNext() {
      while (idx < steps.length) {
        var step = steps[idx];
        idx++;

        if (step.type === 'comment') continue;

        try {
          if (step.type === 'insert-text') {
            insertText(step.content);
          } else if (step.type === 'insert-date') {
            insertText(formatDate(step.format, new Date()));
          } else if (step.type === 'cardmirror') {
            executeCommand(step.label);
          }
        } catch (err) {
          api.showToast('Macro "' + macro.name + '" failed: ' + err.message);
          return;
        }

        // Yield between steps to let ProseMirror process
        if (idx < steps.length) {
          setTimeout(runNext, 10);
          return;
        }
      }
    }

    runNext();
  }

  // ---- Macro loading ----

  function loadMacrosFromDisk() {
    var fs, path;
    try {
      fs = require('fs');
      path = require('path');
    } catch (_) {
      return null;
    }

    var dir = getMacrosDir();
    if (!dir) return null;

    try {
      if (!fs.existsSync(dir)) return [];
    } catch (_) {
      return null;
    }

    var files;
    try {
      files = fs.readdirSync(dir).filter(function (f) { return f.endsWith('.cmcm'); });
    } catch (_) {
      return [];
    }

    var macros = [];
    for (var i = 0; i < files.length; i++) {
      try {
        var content = fs.readFileSync(path.join(dir, files[i]), 'utf-8');
        var parsed = parseCmcm(content);
        if (parsed) macros.push(parsed);
      } catch (_) {
        // skip unparseable files
      }
    }
    return macros;
  }

  function loadMacrosFromStorage(api) {
    var stored = api.storage.get('__macros_cache');
    if (Array.isArray(stored)) return stored;
    return [];
  }

  // ---- Command ID sanitization ----

  function sanitizeId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unnamed';
  }

  // ---- Registration ----

  var macros = loadMacrosFromDisk();
  var usingStorage = false;

  if (macros === null) {
    usingStorage = true;
    // Storage fallback deferred to run() since we need the api reference
    macros = [];
  }

  var seenIds = {};
  var commands = [];

  for (var i = 0; i < macros.length; i++) {
    var macro = macros[i];
    var baseId = 'custom-macros.run-' + sanitizeId(macro.name);
    var cmdId = baseId;
    var suffix = 2;
    while (seenIds[cmdId]) {
      cmdId = baseId + '-' + suffix++;
    }
    seenIds[cmdId] = true;

    commands.push({
      id: cmdId,
      label: 'Macro: ' + macro.name,
      keywords: ['macro', macro.name.toLowerCase()],
      defaultKey: null,
      run: (function (m) {
        return function (api) {
          if (usingStorage && macros.length === 0) {
            macros = loadMacrosFromStorage(api);
            if (macros.length === 0) {
              api.showToast('No macros found. Create macros with the Custom Macros Editor.');
              return;
            }
          }
          executeMacro(m, api);
        };
      })(macro),
    });
  }

  // Always add the reload hint command
  commands.push({
    id: 'custom-macros.reload',
    label: 'Custom Macros: Reload',
    keywords: ['macro', 'reload', 'refresh'],
    defaultKey: null,
    run: function (api) {
      api.showToast('Restart CardMirror to reload macros from disk.');
    },
  });

  if (macros.length === 0 && !usingStorage) {
    commands.push({
      id: 'custom-macros.no-macros',
      label: 'Custom Macros: No macros found',
      keywords: ['macro'],
      defaultKey: null,
      run: function (api) {
        api.showToast('No .cmcm files found. Create macros with the Custom Macros Editor.');
      },
    });
  }

  window.__registerCardMirrorPlugin &&
    window.__registerCardMirrorPlugin({
      id: 'custom-macros',
      name: 'Custom Macros',
      apiVersion: 1,
      settings: [],
      commands: commands,
    });
})();
