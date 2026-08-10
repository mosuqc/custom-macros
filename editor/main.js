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
    if (sc.startsWith('Insert:Text:')) {
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
