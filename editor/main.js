const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

function getMacrosDir() {
  const platform = process.platform;
  if (platform === 'win32') {
    return path.join(process.env.APPDATA, 'custom-macros', 'macros');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'custom-macros', 'macros');
  } else {
    const xdg = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    return path.join(xdg, 'custom-macros', 'macros');
  }
}

const MACROS_DIR = getMacrosDir();
const FILENAME_RE = /^[a-zA-Z0-9_\- ]+\.cmcm$/;

function ensureMacrosDir() {
  fs.mkdirSync(MACROS_DIR, { recursive: true });
}

function validateFilename(filename) {
  if (!FILENAME_RE.test(filename)) {
    throw new Error(`Invalid filename: "${filename}"`);
  }
  const resolved = path.resolve(MACROS_DIR, filename);
  if (!resolved.startsWith(path.resolve(MACROS_DIR))) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 640,
    minHeight: 480,
    title: 'Custom Macros Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'New Macro', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu:new') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu:save') },
        { type: 'separator' },
        { label: 'Open Macros Folder', click: () => require('electron').shell.openPath(MACROS_DIR) },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  ensureMacrosDir();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers

ipcMain.handle('macros:get-dir', () => MACROS_DIR);

ipcMain.handle('macros:list', async () => {
  ensureMacrosDir();
  const files = await fs.promises.readdir(MACROS_DIR);
  return files.filter(f => f.endsWith('.cmcm')).sort();
});

ipcMain.handle('macros:read', async (_event, filename) => {
  const filepath = validateFilename(filename);
  return fs.promises.readFile(filepath, 'utf-8');
});

ipcMain.handle('macros:write', async (_event, filename, content) => {
  const filepath = validateFilename(filename);
  await fs.promises.writeFile(filepath, content, 'utf-8');
});

ipcMain.handle('macros:delete', async (_event, filename) => {
  const filepath = validateFilename(filename);
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Delete', 'Cancel'],
    defaultId: 1,
    title: 'Delete Macro',
    message: `Delete "${filename.replace('.cmcm', '')}"?`,
    detail: 'This cannot be undone.',
  });
  if (result.response === 0) {
    await fs.promises.unlink(filepath);
    return true;
  }
  return false;
});

ipcMain.handle('macros:rename', async (_event, oldFilename, newFilename) => {
  const oldPath = validateFilename(oldFilename);
  const newPath = validateFilename(newFilename);
  if (fs.existsSync(newPath)) {
    throw new Error(`A macro named "${newFilename.replace('.cmcm', '')}" already exists`);
  }
  await fs.promises.rename(oldPath, newPath);
});

ipcMain.handle('macros:exists', async (_event, filename) => {
  try {
    const filepath = validateFilename(filename);
    return fs.existsSync(filepath);
  } catch {
    return false;
  }
});

// ---- Build Plugin ----

// Keep in sync with parseExpression/parseCondition in cmcm.js
function parseExpressionForBuild(str) {
  str = str.trim();
  if (str.startsWith('"') && str.endsWith('"')) {
    return { type: 'string', value: str.slice(1, -1) };
  }
  if (/^\d+$/.test(str)) {
    return { type: 'number', value: parseInt(str, 10) };
  }
  if (str.startsWith('!') && /^![a-zA-Z_]\w*$/.test(str)) {
    return { type: 'variable', name: str.slice(1) };
  }
  const binaryMatch = str.match(/^(.+?)\s*([+\-])\s*(.+)$/);
  if (binaryMatch) {
    try {
      const left = parseExpressionForBuild(binaryMatch[1]);
      const right = parseExpressionForBuild(binaryMatch[3]);
      if (left && right) {
        return { type: 'binary', operator: binaryMatch[2], left, right };
      }
    } catch (e) { }
  }
  const countMatch = str.match(/^COUNT\((.+)\)$/);
  if (countMatch) {
    const inner = countMatch[1].trim();
    if (/^Nearby\.[A-Z]\w*$/.test(inner)) {
      const elem = inner.split('.')[1];
      return { type: 'count', element: elem, nearby: true, filter: null };
    }
    if (/^[A-Z]\w*$/.test(inner)) {
      return { type: 'count', element: inner, nearby: false, filter: null };
    }
    const filterMatch = inner.match(/^(Nearby\.)?([A-Z]\w*)\.containing\((.+)\)$/);
    if (filterMatch) {
      const nearby = !!filterMatch[1];
      const elem = filterMatch[2];
      const filterStr = filterMatch[3].trim();
      let filter;
      if (filterStr.startsWith('"') && filterStr.endsWith('"')) {
        filter = { type: 'string', value: filterStr.slice(1, -1) };
      } else if (filterStr.startsWith('!')) {
        filter = { type: 'variable', name: filterStr.slice(1) };
      } else {
        return null;
      }
      return { type: 'count', element: elem, nearby, filter };
    }
  }
  return null;
}

function parseConditionForBuild(str) {
  const placeholders = [];
  let escaped = str;
  const quoteMatch = /"([^"\\]|\\.)*"/g;
  let match;
  while ((match = quoteMatch.exec(str)) !== null) {
    const idx = placeholders.length;
    placeholders.push(match[0]);
    escaped = escaped.replace(match[0], `__Q${idx}__`);
  }
  const orGroups = escaped.split(/\s+OR\s+/i).map(g => g.trim());
  const result = orGroups.map(group => {
    const andAtoms = group.split(/\s+AND\s+/i).map(a => a.trim());
    return andAtoms.map(atomStr => {
      for (let i = 0; i < placeholders.length; i++) {
        atomStr = atomStr.replace(`__Q${i}__`, placeholders[i]);
      }
      // Parse atomic condition
      const containsMatch = atomStr.match(/^(Nearby\.)?([A-Z]\w*)\.contains\((.+)\)$/);
      if (containsMatch) {
        const nearby = !!containsMatch[1];
        const element = containsMatch[2];
        const valueStr = containsMatch[3].trim();
        let value;
        if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
          value = { type: 'string', value: valueStr.slice(1, -1) };
        } else if (valueStr.startsWith('!')) {
          value = { type: 'variable', name: valueStr.slice(1) };
        } else {
          return null;
        }
        return { type: 'contains', element, nearby, value };
      }
      const compareMatch = atomStr.match(/^!([a-zA-Z_]\w*)\s*(=|>|<)\s*(.+)$/);
      if (compareMatch) {
        const variable = compareMatch[1];
        const operator = compareMatch[2];
        const valueStr = compareMatch[3].trim();
        let value;
        if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
          value = { type: 'string', value: valueStr.slice(1, -1) };
        } else if (/^\d+$/.test(valueStr)) {
          value = { type: 'number', value: parseInt(valueStr, 10) };
        } else {
          return null;
        }
        return { type: 'compare', variable, operator, value };
      }
      return null;
    }).filter(a => a !== null);
  });
  return result;
}

function parseCmcmForBuild(text) {
  const lines = text.split('\n');
  let name = null;
  const steps = [];
  let foundName = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (!foundName) {
      const m = trimmed.match(/^NAME:\s*(.+)$/i);
      if (!m) continue;
      name = m[1].trim();
      foundName = true;
      continue;
    }
    if (trimmed.startsWith('#')) {
      steps.push({ type: 'comment', text: trimmed.slice(1).trim() });
      continue;
    }
    const sc = trimmed.replace(/^\d+\.\s*/, '');

    // Handle control flow
    if (sc === 'ELSE') {
      steps.push({ type: 'else' });
    } else if (sc === 'END') {
      steps.push({ type: 'end' });
    } else if (sc.startsWith('IF ')) {
      const condition = parseConditionForBuild(sc.slice(3));
      if (condition) {
        steps.push({ type: 'if', condition });
      }
    } else if (sc.startsWith('ELIF ')) {
      const condition = parseConditionForBuild(sc.slice(5));
      if (condition) {
        steps.push({ type: 'elif', condition });
      }
    } else if (sc === 'BREAK') {
      steps.push({ type: 'break' });
    } else if (sc.startsWith('REPEAT ')) {
      const countExpr = parseExpressionForBuild(sc.slice(7));
      if (countExpr) {
        steps.push({ type: 'repeat', count: countExpr });
      }
    } else if (sc.startsWith('WHILE ')) {
      const condition = parseConditionForBuild(sc.slice(6));
      if (condition) {
        steps.push({ type: 'while', condition });
      }
    } else if (sc.startsWith('SET !')) {
      const rest = sc.slice(5);
      const eqIdx = rest.indexOf('=');
      if (eqIdx !== -1) {
        const varname = rest.slice(0, eqIdx).trim();
        if (/^[a-zA-Z_]\w*$/.test(varname)) {
          const exprStr = rest.slice(eqIdx + 1).trim();
          const expression = parseExpressionForBuild(exprStr);
          if (expression) {
            steps.push({ type: 'set', variable: varname, expression });
          }
        }
      }
    } else if (sc.startsWith('Insert:!')) {
      const varname = sc.slice(8);
      if (/^[a-zA-Z_]\w*$/.test(varname)) {
        steps.push({ type: 'insert-var', variable: varname });
      }
    } else if (sc.startsWith('Insert:Clipboard:') || sc === 'Insert:Clipboard') {
      steps.push({ type: 'insert-clipboard' });
    } else if (sc.startsWith('Insert:Prompt:')) {
      const message = sc.slice(14);
      if (message) {
        steps.push({ type: 'insert-prompt', message });
      }
    } else if (sc.startsWith('Insert:Counter:')) {
      const name = sc.slice(15).trim();
      if (name) {
        steps.push({ type: 'insert-counter', name });
      }
    } else if (sc.startsWith('Insert:Text:')) {
      steps.push({ type: 'insert-text', content: sc.slice(12) });
    } else if (sc.startsWith('Insert:Date:')) {
      steps.push({ type: 'insert-date', format: sc.slice(12) });
    } else if (sc.startsWith('CardMirror:')) {
      steps.push({ type: 'cardmirror', label: sc.slice(11).trim() });
    }
  }
  return name ? { name, steps } : null;
}

ipcMain.handle('plugin:build', async () => {
  ensureMacrosDir();
  const files = (await fs.promises.readdir(MACROS_DIR)).filter(f => f.endsWith('.cmcm'));
  const macros = [];
  for (const file of files) {
    try {
      const content = await fs.promises.readFile(path.join(MACROS_DIR, file), 'utf-8');
      const parsed = parseCmcmForBuild(content);
      if (parsed) macros.push(parsed);
    } catch (_) { /* skip */ }
  }

  const templatePath = path.join(__dirname, '..', 'plugin', 'plugin.js');
  let template = await fs.promises.readFile(templatePath, 'utf-8');

  const macrosJson = JSON.stringify(macros, null, 2);
  template = template.replace(
    /\/\/ __MACROS_START__\n\s*var MACROS = \[.*?\];\n\s*\/\/ __MACROS_END__/s,
    '// __MACROS_START__\n  var MACROS = ' + macrosJson + ';\n  // __MACROS_END__'
  );

  await fs.promises.writeFile(templatePath, template, 'utf-8');
  return { count: macros.length, names: macros.map(m => m.name) };
});
