const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('macroAPI', {
  getMacrosDir: () => ipcRenderer.invoke('macros:get-dir'),
  listMacros: () => ipcRenderer.invoke('macros:list'),
  readMacro: (filename) => ipcRenderer.invoke('macros:read', filename),
  writeMacro: (filename, content) => ipcRenderer.invoke('macros:write', filename, content),
  deleteMacro: (filename) => ipcRenderer.invoke('macros:delete', filename),
  renameMacro: (oldName, newName) => ipcRenderer.invoke('macros:rename', oldName, newName),
  macroExists: (filename) => ipcRenderer.invoke('macros:exists', filename),

  onMenuNew: (callback) => ipcRenderer.on('menu:new', callback),
  onMenuSave: (callback) => ipcRenderer.on('menu:save', callback),
});
