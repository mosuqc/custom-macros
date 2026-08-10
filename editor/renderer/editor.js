import { parseCmcm, serializeCmcm, ParseError } from './cmcm.js';
import { formatDate, PRESET_FORMATS } from './date-formats.js';
import { COMMAND_GROUPS, LABEL_TO_COMMAND, ALL_COMMANDS } from './commands.js';

// ---- State ----
let currentMacro = null;   // { name, steps, filename, dirty }
let macroFiles = [];       // filenames on disk

// ---- DOM refs ----
const macroListEl = document.getElementById('macro-list');
const emptyState = document.getElementById('empty-state');
const editorPanel = document.getElementById('editor-panel');
const macroNameInput = document.getElementById('macro-name');
const stepsListEl = document.getElementById('steps-list');
const btnNew = document.getElementById('btn-new');
const btnAddStep = document.getElementById('btn-add-step');
const btnSave = document.getElementById('btn-save');
const btnRename = document.getElementById('btn-rename');
const btnDelete = document.getElementById('btn-delete');
const commandDialog = document.getElementById('command-dialog');
const commandSearch = document.getElementById('command-search');
const commandListEl = document.getElementById('command-list');
const commandDialogClose = document.getElementById('command-dialog-close');

// ---- Sidebar ----

async function refreshSidebar() {
  macroFiles = await window.macroAPI.listMacros();
  macroListEl.innerHTML = '';
  for (const file of macroFiles) {
    const li = document.createElement('li');
    li.textContent = file.replace('.cmcm', '');
    li.dataset.filename = file;
    if (currentMacro && currentMacro.filename === file) {
      li.classList.add('active');
      if (currentMacro.dirty) li.classList.add('dirty');
    }
    li.addEventListener('click', () => loadMacro(file));
    macroListEl.appendChild(li);
  }
}

// ---- Load / New ----

async function loadMacro(filename) {
  if (currentMacro?.dirty) {
    if (!confirm('You have unsaved changes. Discard them?')) return;
  }
  try {
    const content = await window.macroAPI.readMacro(filename);
    const parsed = parseCmcm(content);
    currentMacro = {
      name: parsed.name,
      steps: parsed.steps,
      filename,
      dirty: false,
    };
    showEditor();
  } catch (err) {
    alert(`Failed to load macro: ${err.message}`);
  }
}

function newMacro() {
  if (currentMacro?.dirty) {
    if (!confirm('You have unsaved changes. Discard them?')) return;
  }
  currentMacro = {
    name: '',
    steps: [],
    filename: null,
    dirty: false,
  };
  showEditor();
  macroNameInput.focus();
}

// ---- Render editor ----

function showEditor() {
  emptyState.hidden = true;
  editorPanel.hidden = false;
  macroNameInput.value = currentMacro.name;
  renderSteps();
  refreshSidebar();
}

function hideEditor() {
  emptyState.hidden = false;
  editorPanel.hidden = true;
  currentMacro = null;
  refreshSidebar();
}

function markDirty() {
  if (currentMacro && !currentMacro.dirty) {
    currentMacro.dirty = true;
    refreshSidebar();
  }
}

function renderSteps() {
  stepsListEl.innerHTML = '';
  let stepNum = 1;
  currentMacro.steps.forEach((step, index) => {
    const row = document.createElement('div');
    row.className = 'step-row';

    // Step number
    const numEl = document.createElement('span');
    numEl.className = 'step-num';
    if (step.type === 'comment') {
      numEl.textContent = '#';
    } else {
      numEl.textContent = `${stepNum}.`;
      stepNum++;
    }
    row.appendChild(numEl);

    // Type selector
    const typeSelect = document.createElement('select');
    typeSelect.className = 'step-type-select';
    for (const opt of ['Comment', 'Insert', 'CardMirror']) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      typeSelect.appendChild(o);
    }
    if (step.type === 'comment') typeSelect.value = 'Comment';
    else if (step.type === 'insert-text' || step.type === 'insert-date') typeSelect.value = 'Insert';
    else if (step.type === 'cardmirror') typeSelect.value = 'CardMirror';
    typeSelect.addEventListener('change', () => {
      changeStepType(index, typeSelect.value);
    });
    row.appendChild(typeSelect);

    // Content area (varies by type)
    const contentEl = document.createElement('div');
    contentEl.className = 'step-content';

    if (step.type === 'comment') {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'step-comment-input';
      input.value = step.text;
      input.placeholder = 'Comment...';
      input.addEventListener('input', () => {
        currentMacro.steps[index].text = input.value;
        markDirty();
      });
      contentEl.appendChild(input);
    } else if (step.type === 'insert-text') {
      const subSelect = createSubtypeSelect('Text', index);
      contentEl.appendChild(subSelect);
      const input = document.createElement('input');
      input.type = 'text';
      input.value = step.content;
      input.placeholder = 'Text to insert...';
      input.addEventListener('input', () => {
        currentMacro.steps[index].content = input.value;
        markDirty();
      });
      contentEl.appendChild(input);
    } else if (step.type === 'insert-date') {
      const subSelect = createSubtypeSelect('Date', index);
      contentEl.appendChild(subSelect);

      const input = document.createElement('input');
      input.type = 'text';
      input.value = step.format;
      input.placeholder = 'm.dd.yy';
      input.style.maxWidth = '140px';

      const preview = document.createElement('span');
      preview.className = 'date-preview';
      preview.textContent = formatDate(step.format, new Date());

      input.addEventListener('input', () => {
        currentMacro.steps[index].format = input.value;
        preview.textContent = input.value ? formatDate(input.value, new Date()) : '';
        markDirty();
      });
      contentEl.appendChild(input);
      contentEl.appendChild(preview);

      // Preset dropdown
      const presetSelect = document.createElement('select');
      presetSelect.className = 'step-subtype-select';
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = 'Presets...';
      presetSelect.appendChild(defaultOpt);
      for (const preset of PRESET_FORMATS) {
        const o = document.createElement('option');
        o.value = preset.format;
        o.textContent = `${preset.label} → ${preset.example}`;
        presetSelect.appendChild(o);
      }
      presetSelect.addEventListener('change', () => {
        if (presetSelect.value) {
          input.value = presetSelect.value;
          currentMacro.steps[index].format = presetSelect.value;
          preview.textContent = formatDate(presetSelect.value, new Date());
          presetSelect.value = '';
          markDirty();
        }
      });
      contentEl.appendChild(presetSelect);
    } else if (step.type === 'cardmirror') {
      const display = document.createElement('div');
      display.className = 'command-display';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'command-label' + (step.label ? '' : ' empty');
      labelSpan.textContent = step.label || 'Select command...';
      display.appendChild(labelSpan);

      // Show keybinding or unbound warning
      if (step.label) {
        const cmd = LABEL_TO_COMMAND[step.label.toLowerCase()];
        if (cmd && cmd.defaultKey) {
          const keySpan = document.createElement('span');
          keySpan.className = 'cmd-key';
          keySpan.textContent = formatKeybind(cmd.defaultKey);
          display.appendChild(keySpan);
        } else if (cmd && !cmd.defaultKey) {
          const warn = document.createElement('span');
          warn.className = 'unbound-warning';
          warn.textContent = 'no keybind';
          display.appendChild(warn);
        }
      }

      const browseBtn = document.createElement('button');
      browseBtn.className = 'btn-browse';
      browseBtn.textContent = 'Browse...';
      browseBtn.addEventListener('click', () => openCommandBrowser(index));
      display.appendChild(browseBtn);

      contentEl.appendChild(display);
    }

    row.appendChild(contentEl);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-step';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove step';
    removeBtn.addEventListener('click', () => {
      currentMacro.steps.splice(index, 1);
      markDirty();
      renderSteps();
    });
    row.appendChild(removeBtn);

    stepsListEl.appendChild(row);
  });
}

function createSubtypeSelect(selected, stepIndex) {
  const sel = document.createElement('select');
  sel.className = 'step-subtype-select';
  for (const opt of ['Text', 'Date']) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    sel.appendChild(o);
  }
  sel.value = selected;
  sel.addEventListener('change', () => {
    if (sel.value === 'Text') {
      currentMacro.steps[stepIndex] = { type: 'insert-text', content: '' };
    } else {
      currentMacro.steps[stepIndex] = { type: 'insert-date', format: 'm.dd.yy' };
    }
    markDirty();
    renderSteps();
  });
  return sel;
}

function changeStepType(index, newType) {
  if (newType === 'Comment') {
    currentMacro.steps[index] = { type: 'comment', text: '' };
  } else if (newType === 'Insert') {
    currentMacro.steps[index] = { type: 'insert-text', content: '' };
  } else if (newType === 'CardMirror') {
    currentMacro.steps[index] = { type: 'cardmirror', label: '' };
  }
  markDirty();
  renderSteps();
}

// ---- Command Browser ----

let commandBrowserTargetIndex = -1;

function openCommandBrowser(stepIndex) {
  commandBrowserTargetIndex = stepIndex;
  commandSearch.value = '';
  renderCommandList('');
  commandDialog.showModal();
  commandSearch.focus();
}

function renderCommandList(filter) {
  commandListEl.innerHTML = '';
  const lowerFilter = filter.toLowerCase();

  for (const group of COMMAND_GROUPS) {
    const matchingCmds = group.commands.filter(cmd =>
      !lowerFilter || cmd.label.toLowerCase().includes(lowerFilter) || cmd.id.toLowerCase().includes(lowerFilter)
    );
    if (matchingCmds.length === 0) continue;

    const header = document.createElement('div');
    header.className = 'command-group-header';
    header.textContent = group.group;
    commandListEl.appendChild(header);

    for (const cmd of matchingCmds) {
      const item = document.createElement('div');
      item.className = 'command-item';

      const label = document.createElement('span');
      label.className = 'cmd-label';
      label.textContent = cmd.label;
      item.appendChild(label);

      if (cmd.defaultKey) {
        const key = document.createElement('span');
        key.className = 'cmd-key';
        key.textContent = formatKeybind(cmd.defaultKey);
        item.appendChild(key);
      } else {
        const unbound = document.createElement('span');
        unbound.className = 'cmd-unbound';
        unbound.textContent = 'no keybind';
        item.appendChild(unbound);
      }

      item.addEventListener('click', () => {
        currentMacro.steps[commandBrowserTargetIndex] = {
          type: 'cardmirror',
          label: cmd.label,
        };
        markDirty();
        renderSteps();
        commandDialog.close();
      });
      commandListEl.appendChild(item);
    }
  }
}

commandSearch.addEventListener('input', () => {
  renderCommandList(commandSearch.value);
});

commandDialogClose.addEventListener('click', () => {
  commandDialog.close();
});

// ---- Save / Rename / Delete ----

async function saveMacro() {
  if (!currentMacro) return;

  const name = macroNameInput.value.trim();
  if (!name) {
    alert('Please enter a macro name.');
    macroNameInput.focus();
    return;
  }
  currentMacro.name = name;

  const filename = currentMacro.filename || `${sanitizeFilename(name)}.cmcm`;

  try {
    const content = serializeCmcm({
      name: currentMacro.name,
      steps: currentMacro.steps,
    });
    await window.macroAPI.writeMacro(filename, content);
    currentMacro.filename = filename;
    currentMacro.dirty = false;
    await refreshSidebar();
  } catch (err) {
    alert(`Failed to save: ${err.message}`);
  }
}

async function renameMacro() {
  if (!currentMacro?.filename) return;

  const oldName = currentMacro.filename.replace('.cmcm', '');
  const newName = prompt('New name:', oldName);
  if (!newName || newName === oldName) return;

  const newFilename = `${sanitizeFilename(newName)}.cmcm`;
  try {
    await window.macroAPI.renameMacro(currentMacro.filename, newFilename);
    currentMacro.filename = newFilename;
    currentMacro.name = newName;
    macroNameInput.value = newName;
    await refreshSidebar();
  } catch (err) {
    alert(`Failed to rename: ${err.message}`);
  }
}

async function deleteMacro() {
  if (!currentMacro?.filename) return;
  const deleted = await window.macroAPI.deleteMacro(currentMacro.filename);
  if (deleted) {
    hideEditor();
    await refreshSidebar();
  }
}

// ---- Utility ----

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'Untitled';
}

function formatKeybind(keyStr) {
  const isMac = navigator.platform.includes('Mac');
  if (isMac) {
    return keyStr
      .replace(/Mod/g, '⌘')
      .replace(/Alt/g, '⌥')
      .replace(/Shift/g, '⇧')
      .replace(/-/g, '');
  }
  return keyStr
    .replace(/Mod/g, 'Ctrl')
    .replace(/-/g, '+');
}

// ---- Event wiring ----

btnNew.addEventListener('click', newMacro);
btnAddStep.addEventListener('click', () => {
  if (!currentMacro) return;
  currentMacro.steps.push({ type: 'insert-text', content: '' });
  markDirty();
  renderSteps();
  // scroll to bottom
  stepsListEl.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
});
btnSave.addEventListener('click', saveMacro);
btnRename.addEventListener('click', renameMacro);
btnDelete.addEventListener('click', deleteMacro);

macroNameInput.addEventListener('input', () => {
  if (currentMacro) {
    currentMacro.name = macroNameInput.value;
    markDirty();
  }
});

// Menu shortcuts from main process
window.macroAPI.onMenuNew(() => newMacro());
window.macroAPI.onMenuSave(() => saveMacro());

// ---- Build Plugin ----

const btnBuild = document.getElementById('btn-build');
btnBuild.addEventListener('click', async () => {
  btnBuild.disabled = true;
  btnBuild.textContent = 'Building...';
  try {
    const result = await window.macroAPI.buildPlugin();
    alert(`Plugin built with ${result.count} macro(s):\n${result.names.join(', ')}\n\nRestart CardMirror to load the updated plugin.`);
  } catch (err) {
    alert(`Build failed: ${err.message}`);
  } finally {
    btnBuild.disabled = false;
    btnBuild.textContent = 'Build Plugin';
  }
});

// ---- Init ----
refreshSidebar();
