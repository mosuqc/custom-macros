import { parseCmcm, serializeCmcm, parseCondition, parseExpression, serializeCondition, serializeExpression, VALID_ELEMENTS, validateSteps } from './cmcm.js';
import { PRESET_FORMATS } from './date-formats.js';
import { ALL_COMMANDS } from './commands.js';

// ---- State ----
let currentMacro = null;   // { name, steps, filename, dirty }
let macroFiles = [];       // filenames on disk

// ---- DOM refs ----
const macroListEl = document.getElementById('macro-list');
const emptyState = document.getElementById('empty-state');
const editorPanel = document.getElementById('editor-panel');
const macroNameInput = document.getElementById('macro-name');
const stepsListEl = document.getElementById('steps-list');
const syntaxPanel = document.getElementById('syntax-panel');
const btnSyntax = document.getElementById('btn-syntax');
const btnSyntaxClose = document.getElementById('btn-syntax-close');
const btnNew = document.getElementById('btn-new');
const btnAddStep = document.getElementById('btn-add-step');
const btnSave = document.getElementById('btn-save');
const btnRename = document.getElementById('btn-rename');
const btnDelete = document.getElementById('btn-delete');

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
    steps: [{ type: 'incomplete', raw: '' }],
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
  syntaxPanel.hidden = true;
  btnSyntax.classList.remove('active');
  macroNameInput.value = currentMacro.name;
  renderSteps();
  refreshSidebar();
}

function hideEditor() {
  emptyState.hidden = false;
  editorPanel.hidden = true;
  syntaxPanel.hidden = true;
  btnSyntax.classList.remove('active');
  currentMacro = null;
  refreshSidebar();
}

function toggleSyntax() {
  const showing = !syntaxPanel.hidden;
  if (showing) {
    syntaxPanel.hidden = true;
    btnSyntax.classList.remove('active');
    if (currentMacro) {
      editorPanel.hidden = false;
    } else {
      emptyState.hidden = false;
    }
  } else {
    syntaxPanel.hidden = false;
    btnSyntax.classList.add('active');
    emptyState.hidden = true;
    editorPanel.hidden = true;
  }
}

function markDirty() {
  if (currentMacro && !currentMacro.dirty) {
    currentMacro.dirty = true;
    refreshSidebar();
  }
}

// ---- Step format conversion ----

function stepToText(step) {
  if (step.type === 'comment') return `# ${step.text}`;
  if (step.type === 'if') return `IF ${serializeCondition(step.condition)}`;
  if (step.type === 'elif') return `ELIF ${serializeCondition(step.condition)}`;
  if (step.type === 'else') return 'ELSE';
  if (step.type === 'end') return 'END';
  if (step.type === 'break') return 'BREAK';
  if (step.type === 'repeat') return `REPEAT ${serializeExpression(step.count)}`;
  if (step.type === 'while') return `WHILE ${serializeCondition(step.condition)}`;
  if (step.type === 'set') return `SET !${step.variable} = ${serializeExpression(step.expression)}`;
  if (step.type === 'insert-var') return `Insert:!${step.variable}`;
  if (step.type === 'insert-newline') return 'Insert:Newline';
  if (step.type === 'insert-clipboard') return 'Insert:Clipboard:';
  if (step.type === 'insert-prompt') return `Insert:Prompt:${step.message}`;
  if (step.type === 'insert-counter') return `Insert:Counter:${step.name}`;
  if (step.type === 'insert-text') return `Insert:Text:${step.content}`;
  if (step.type === 'insert-date') return `Insert:Date:${step.format}`;
  if (step.type === 'cardmirror') return `CardMirror:${step.label}`;
  if (step.type === 'incomplete') return step.raw || '';
  return '';
}

function textToStep(text) {
  if (text.startsWith('# ') || text === '#') return { type: 'comment', text: text.slice(1).trimStart() };

  // Handle ELSE
  if (text === 'ELSE') return { type: 'else' };

  // Handle END
  if (text === 'END') return { type: 'end' };

  // Handle BREAK
  if (text === 'BREAK') return { type: 'break' };

  // Handle IF
  if (text.startsWith('IF ')) {
    try {
      const condition = parseCondition(text.slice(3));
      return { type: 'if', condition };
    } catch (e) {
      return { type: 'incomplete', raw: text };
    }
  }

  // Handle ELIF
  if (text.startsWith('ELIF ')) {
    try {
      const condition = parseCondition(text.slice(5));
      return { type: 'elif', condition };
    } catch (e) {
      return { type: 'incomplete', raw: text };
    }
  }

  // Handle REPEAT
  if (text.startsWith('REPEAT ')) {
    try {
      const countExpr = parseExpression(text.slice(7));
      return { type: 'repeat', count: countExpr };
    } catch (e) {
      return { type: 'incomplete', raw: text };
    }
  }

  // Handle WHILE
  if (text.startsWith('WHILE ')) {
    try {
      const condition = parseCondition(text.slice(6));
      return { type: 'while', condition };
    } catch (e) {
      return { type: 'incomplete', raw: text };
    }
  }

  // Handle SET
  if (text.startsWith('SET !')) {
    try {
      const rest = text.slice(5);
      const eqIdx = rest.indexOf('=');
      if (eqIdx === -1) {
        return { type: 'incomplete', raw: text };
      }
      const varname = rest.slice(0, eqIdx).trim();
      if (!/^[a-zA-Z_]\w*$/.test(varname)) {
        return { type: 'incomplete', raw: text };
      }
      const exprStr = rest.slice(eqIdx + 1).trim();
      const expression = parseExpression(exprStr);
      return { type: 'set', variable: varname, expression };
    } catch (e) {
      return { type: 'incomplete', raw: text };
    }
  }

  // Handle Insert:!var
  if (text.startsWith('Insert:!')) {
    const varname = text.slice(8);
    if (/^[a-zA-Z_]\w*$/.test(varname)) {
      return { type: 'insert-var', variable: varname };
    }
  }

  if (text === 'Insert:Newline' || text === 'Insert:Newline:') return { type: 'insert-newline' };
  if (text.startsWith('Insert:Clipboard:') || text === 'Insert:Clipboard') return { type: 'insert-clipboard' };
  if (text.startsWith('Insert:Prompt:') && text.length > 14) return { type: 'insert-prompt', message: text.slice(14) };
  if (text.startsWith('Insert:Counter:') && text.length > 15) return { type: 'insert-counter', name: text.slice(15).trim() };
  if (text.startsWith('Insert:Text:')) return { type: 'insert-text', content: text.slice(12) };
  if (text.startsWith('Insert:Date:') && text.length > 12) return { type: 'insert-date', format: text.slice(12) };
  if (text.startsWith('CardMirror:') && text.length > 11) return { type: 'cardmirror', label: text.slice(11) };
  if (text === '') return null;
  return { type: 'incomplete', raw: text };
}

// ---- Autocomplete state and logic ----

let activeDropdownIndex = -1;
let dropdownSelectedIndex = 0;

function getDefinedVariables() {
  if (!currentMacro) return [];
  const vars = new Set();
  for (const step of currentMacro.steps) {
    if (step.type === 'set') vars.add(step.variable);
  }
  return [...vars];
}

function getAutocompleteContext(value) {
  if (value === '') {
    return {
      phase: 'prefix',
      items: [
        { text: 'SET ', type: 'prefix' },
        { text: 'IF ', type: 'prefix' },
        { text: 'ELIF ', type: 'prefix' },
        { text: 'ELSE', type: 'prefix' },
        { text: 'END', type: 'prefix' },
        { text: 'REPEAT ', type: 'prefix' },
        { text: 'WHILE ', type: 'prefix' },
        { text: 'BREAK', type: 'prefix' },
        { text: 'CardMirror:', type: 'prefix' },
        { text: 'Insert:', type: 'prefix' },
        { text: '# ', type: 'prefix' },
      ],
    };
  }

  const lowerValue = value.toLowerCase();

  // Handle IF/ELIF conditions
  if (lowerValue.startsWith('if ') || lowerValue.startsWith('elif ')) {
    const isIf = lowerValue.startsWith('if ');
    const keyword = isIf ? 'IF ' : 'ELIF ';
    const partial = value.slice(keyword.length);
    const lowerPartial = partial.toLowerCase();

    // If empty or no dot yet, offer element names and Nearby
    if (partial === '' || (!partial.includes('.') && !partial.startsWith('!'))) {
      const matchingElems = VALID_ELEMENTS.filter(e => e.toLowerCase().startsWith(lowerPartial));
      const items = matchingElems.map(elem => ({ text: elem, type: 'element', accepted: keyword + elem }));
      if ('nearby.'.startsWith(lowerPartial)) {
        items.push({ text: 'Nearby.', type: 'element', accepted: keyword + 'Nearby.' });
      }
      if ('!'.startsWith(lowerPartial)) {
        items.push({ text: '!', type: 'element', accepted: keyword + '!' });
      }
      return { phase: 'if-element', items };
    }

    // After Nearby., offer element names
    if (lowerPartial.startsWith('nearby.') && !lowerPartial.slice(7).includes('.')) {
      const afterNearby = partial.slice(7);
      const matchingElems = VALID_ELEMENTS.filter(e => e.toLowerCase().startsWith(afterNearby.toLowerCase()));
      const items = matchingElems.map(elem => ({ text: elem, type: 'element', accepted: keyword + 'Nearby.' + elem }));
      return { phase: 'if-element', items };
    }

    // If ends with element name but no dot, offer .contains
    if (VALID_ELEMENTS.some(e => lowerPartial === e.toLowerCase() || lowerPartial === 'nearby.' + e.toLowerCase())) {
      return { phase: 'free', items: [{ text: '.contains("', type: 'set-hint', accepted: value + '.contains("' }] };
    }

    return { phase: 'free', items: [] };
  }

  // Handle SET
  if (lowerValue.startsWith('set !')) {
    const rest = value.slice(5);
    if (!rest.includes('=')) {
      return { phase: 'free', items: [] };
    }
    const eqPos = rest.indexOf('=');
    const afterEq = rest.slice(eqPos + 1).trim();
    if (afterEq === '') {
      const prefix = value.slice(0, value.indexOf('=') + 1) + ' ';
      const definedVars = getDefinedVariables();
      const items = [
        { text: '"', type: 'set-hint', accepted: prefix + '"' },
        { text: 'COUNT(', type: 'set-hint', accepted: prefix + 'COUNT(' },
      ];
      for (const varname of definedVars) {
        items.push({ text: '!' + varname, type: 'set-hint', accepted: prefix + '!' + varname });
      }
      return { phase: 'free', items };
    }
    return { phase: 'free', items: [] };
  }

  // Prefix matching (before any colon is typed)
  if (!value.includes(':') && !value.startsWith('#')) {
    const prefixes = [
      { text: 'SET ', match: 'set' },
      { text: 'IF ', match: 'if' },
      { text: 'ELIF ', match: 'elif' },
      { text: 'ELSE', match: 'else' },
      { text: 'END', match: 'end' },
      { text: 'REPEAT ', match: 'repeat' },
      { text: 'WHILE ', match: 'while' },
      { text: 'BREAK', match: 'break' },
      { text: 'CardMirror:', match: 'cardmirror' },
      { text: 'Insert:', match: 'insert' },
    ];
    const matching = prefixes.filter(p => p.match.startsWith(lowerValue));
    if (matching.length > 0) {
      return {
        phase: 'prefix',
        items: matching.map(m => ({ text: m.text, type: 'prefix' })),
      };
    }
  }

  // CardMirror command phase
  if (lowerValue.startsWith('cardmirror:')) {
    const partial = value.slice(11);
    const lowerPartial = partial.toLowerCase();
    const matches = ALL_COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(lowerPartial)
    );
    matches.sort((a, b) => {
      const aPrefix = a.label.toLowerCase().startsWith(lowerPartial);
      const bPrefix = b.label.toLowerCase().startsWith(lowerPartial);
      if (aPrefix !== bPrefix) return bPrefix ? 1 : -1;
      return 0;
    });
    return {
      phase: 'cardmirror',
      items: matches.map(cmd => ({
        text: cmd.label,
        keybind: cmd.defaultKey,
        type: 'command',
      })),
    };
  }

  // Insert phase
  if (lowerValue.startsWith('insert:')) {
    const partial = value.slice(7);
    const lowerPartial = partial.toLowerCase();

    // Show subtype options
    if (partial === '') {
      return {
        phase: 'insert-subtype',
        items: [
          { text: 'Text:', type: 'subtype' },
          { text: 'Date:', type: 'subtype' },
          { text: 'Newline', type: 'subtype' },
          { text: '!', type: 'subtype' },
          { text: 'Clipboard:', type: 'subtype' },
          { text: 'Prompt:', type: 'subtype' },
          { text: 'Counter:', type: 'subtype' },
        ],
      };
    }

    // Insert:! — variable names
    if (lowerPartial.startsWith('!')) {
      const definedVars = getDefinedVariables();
      const varPartial = partial.slice(1).toLowerCase();
      const matching = definedVars.filter(v => v.toLowerCase().startsWith(varPartial));
      return {
        phase: 'free',
        items: matching.map(v => ({ text: v, type: 'variable' })),
      };
    }

    // Partial subtype matching
    if (!partial.includes(':') && lowerPartial !== 'newline') {
      const subtypes = [
        { text: 'Text:', match: 'text' },
        { text: 'Date:', match: 'date' },
        { text: 'Newline', match: 'newline' },
        { text: 'Clipboard:', match: 'clipboard' },
        { text: 'Prompt:', match: 'prompt' },
        { text: 'Counter:', match: 'counter' },
      ];
      const matching = subtypes.filter(s => s.match.startsWith(lowerPartial));
      if (matching.length > 0) {
        return {
          phase: 'insert-subtype',
          items: matching.map(m => ({ text: m.text, type: 'subtype' })),
        };
      }
    }

    // Insert:Text: — free text, no autocomplete
    if (lowerPartial.startsWith('text:')) {
      return { phase: 'free', items: [] };
    }

    // Insert:Date: — preset suggestions
    if (lowerPartial.startsWith('date:')) {
      const datePartial = partial.slice(5);
      const lowerDatePartial = datePartial.toLowerCase();
      const matches = PRESET_FORMATS.filter(p =>
        p.format.toLowerCase().startsWith(lowerDatePartial) ||
        p.label.toLowerCase().includes(lowerDatePartial)
      );
      matches.sort((a, b) => {
        const aPrefix = a.format.toLowerCase().startsWith(lowerDatePartial);
        const bPrefix = b.format.toLowerCase().startsWith(lowerDatePartial);
        if (aPrefix !== bPrefix) return bPrefix ? 1 : -1;
        return 0;
      });
      return {
        phase: 'insert-date-preset',
        items: matches.map(preset => ({
          text: preset.label,
          example: preset.example,
          format: preset.format,
          type: 'preset',
        })),
      };
    }

    // Insert:Newline — no further autocomplete needed
    if (lowerPartial === 'newline' || lowerPartial === 'newline:') {
      return { phase: 'free', items: [] };
    }

    // Insert:Clipboard: — no further autocomplete needed
    if (lowerPartial.startsWith('clipboard:') || lowerPartial === 'clipboard') {
      return { phase: 'free', items: [] };
    }

    // Insert:Prompt: — free text for the message
    if (lowerPartial.startsWith('prompt:')) {
      return { phase: 'free', items: [] };
    }

    // Insert:Counter: — free text for the name
    if (lowerPartial.startsWith('counter:')) {
      return { phase: 'free', items: [] };
    }
  }

  // Handle WHILE conditions (same as IF)
  if (lowerValue.startsWith('while ')) {
    const partial = value.slice(6);
    const lowerPartial = partial.toLowerCase();

    if (partial === '' || (!partial.includes('.') && !partial.startsWith('!'))) {
      const matchingElems = VALID_ELEMENTS.filter(e => e.toLowerCase().startsWith(lowerPartial));
      const items = matchingElems.map(elem => ({ text: elem, type: 'element', accepted: 'WHILE ' + elem }));
      if ('nearby.'.startsWith(lowerPartial)) {
        items.push({ text: 'Nearby.', type: 'element', accepted: 'WHILE Nearby.' });
      }
      if ('!'.startsWith(lowerPartial)) {
        items.push({ text: '!', type: 'element', accepted: 'WHILE !' });
      }
      return { phase: 'if-element', items };
    }

    if (lowerPartial.startsWith('nearby.') && !lowerPartial.slice(7).includes('.')) {
      const afterNearby = partial.slice(7);
      const matchingElems = VALID_ELEMENTS.filter(e => e.toLowerCase().startsWith(afterNearby.toLowerCase()));
      const items = matchingElems.map(elem => ({ text: elem, type: 'element', accepted: 'WHILE Nearby.' + elem }));
      return { phase: 'if-element', items };
    }

    if (VALID_ELEMENTS.some(e => lowerPartial === e.toLowerCase() || lowerPartial === 'nearby.' + e.toLowerCase())) {
      return { phase: 'free', items: [{ text: '.contains("', type: 'set-hint', accepted: value + '.contains("' }] };
    }

    return { phase: 'free', items: [] };
  }

  // Handle REPEAT expressions
  if (lowerValue.startsWith('repeat ')) {
    const partial = value.slice(7);
    if (partial === '') {
      const definedVars = getDefinedVariables();
      const items = definedVars.map(v => ({ text: '!' + v, type: 'set-hint', accepted: 'REPEAT !' + v }));
      return { phase: 'free', items };
    }
    return { phase: 'free', items: [] };
  }

  // Comment — free text
  if (value.startsWith('#')) {
    return { phase: 'free', items: [] };
  }

  return { phase: 'unknown', items: [] };
}

function ghostForItem(inputValue, item) {
  if (!item) return '';
  if (item.type === 'prefix') {
    if (item.text.toLowerCase().startsWith(inputValue.toLowerCase())) {
      return item.text.slice(inputValue.length);
    }
    return '';
  }
  if (item.type === 'element') {
    // For IF/ELIF/WHILE element suggestions
    const lv = inputValue.toLowerCase();
    const keywordLen = lv.startsWith('while ') ? 6 : lv.startsWith('elif ') ? 5 : 3;
    const partial = inputValue.slice(keywordLen);
    if (item.text.toLowerCase().startsWith(partial.toLowerCase())) {
      return item.text.slice(partial.length);
    }
    return '';
  }
  if (item.type === 'subtype') {
    const partial = inputValue.slice(7);
    if (item.text.toLowerCase().startsWith(partial.toLowerCase())) {
      return item.text.slice(partial.length);
    }
    return '';
  }
  if (item.type === 'command') {
    const partial = inputValue.slice(11);
    if (item.text.toLowerCase().startsWith(partial.toLowerCase())) {
      return item.text.slice(partial.length);
    }
    return '';
  }
  if (item.type === 'preset') {
    const partial = inputValue.slice(12);
    if (item.format.toLowerCase().startsWith(partial.toLowerCase())) {
      return item.format.slice(partial.length);
    }
    return '';
  }
  if (item.type === 'set-hint') {
    return '';
  }
  if (item.type === 'variable') {
    return '';
  }
  return '';
}

function acceptedValue(item) {
  if (item.accepted) return item.accepted;
  if (item.type === 'prefix') return item.text;
  if (item.type === 'subtype') {
    if (item.text === '!') return 'Insert:!';
    if (item.text === 'Newline') return 'Insert:Newline';
    return `Insert:${item.text}`;
  }
  if (item.type === 'command') return `CardMirror:${item.text}`;
  if (item.type === 'preset') return `Insert:Date:${item.format}`;
  if (item.type === 'variable') return `Insert:!${item.text}`;
  return '';
}

function renderSteps() {
  stepsListEl.innerHTML = '';
  let stepNum = 1;
  let depth = 0;

  currentMacro.steps.forEach((step, index) => {
    const row = document.createElement('div');
    row.className = 'step-row';

    // Compute display depth
    let displayDepth = depth;
    if (step.type === 'elif' || step.type === 'else') {
      displayDepth = Math.max(0, depth - 1);
    } else if (step.type === 'end') {
      depth = Math.max(0, depth - 1);
      displayDepth = depth;
    }

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

    // Autocomplete wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'step-ac-wrapper';

    const backdrop = document.createElement('div');
    backdrop.className = 'step-ac-backdrop';

    const measure = document.createElement('span');
    measure.className = 'ac-measure';
    backdrop.appendChild(measure);

    const ghost = document.createElement('span');
    ghost.className = 'ac-ghost';
    backdrop.appendChild(ghost);

    wrapper.appendChild(backdrop);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'step-ac-input';
    input.spellcheck = false;
    input.value = stepToText(step);
    wrapper.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.className = 'step-ac-dropdown hidden';
    wrapper.appendChild(dropdown);

    row.appendChild(wrapper);

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

    // Apply indentation
    row.style.paddingLeft = (8 + displayDepth * 20) + 'px';

    // Control flow styling
    if (step.type === 'if' || step.type === 'elif' || step.type === 'else' || step.type === 'end' ||
        step.type === 'repeat' || step.type === 'while' || step.type === 'break') {
      row.classList.add('step-row-control');
    }

    stepsListEl.appendChild(row);

    // Attach event listeners
    attachAutocompleteListeners(input, dropdown, measure, ghost, index);

    // After row is complete, update depth
    if (step.type === 'if' || step.type === 'repeat' || step.type === 'while') depth++;
  });
}

function attachAutocompleteListeners(input, dropdown, measure, ghost, stepIndex) {
  let lastContext = null;

  function renderDropdown(context) {
    dropdown.innerHTML = '';
    context.items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'ac-item' + (i === dropdownSelectedIndex ? ' ac-active' : '');

      if (item.type === 'prefix' || item.type === 'subtype') {
        el.textContent = item.text;
      } else if (item.type === 'command') {
        const label = document.createElement('span');
        label.textContent = item.text;
        el.appendChild(label);
        if (item.keybind) {
          const key = document.createElement('span');
          key.className = 'cmd-key';
          key.textContent = formatKeybind(item.keybind);
          el.appendChild(key);
        } else {
          const warn = document.createElement('span');
          warn.className = 'ac-unbound';
          warn.textContent = 'no keybind';
          el.appendChild(warn);
        }
      } else if (item.type === 'preset') {
        const label = document.createElement('span');
        label.textContent = `${item.format} → ${item.example}`;
        el.appendChild(label);
      } else if (item.type === 'variable') {
        el.textContent = '!' + item.text;
      } else if (item.type === 'element') {
        el.textContent = item.text;
      } else if (item.type === 'set-hint') {
        el.textContent = item.text;
      } else {
        el.textContent = item.text;
      }

      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        accept(item);
      });
      el.addEventListener('mouseenter', () => {
        dropdownSelectedIndex = i;
        syncSelection();
      });
      dropdown.appendChild(el);
    });
  }

  function syncSelection() {
    dropdown.querySelectorAll('.ac-item').forEach((el, i) => {
      el.classList.toggle('ac-active', i === dropdownSelectedIndex);
    });
    if (lastContext && lastContext.items[dropdownSelectedIndex]) {
      ghost.textContent = ghostForItem(input.value, lastContext.items[dropdownSelectedIndex]);
    }
  }

  function updateAutocomplete() {
    const value = input.value;

    // Sync step data on every keystroke
    const step = textToStep(value);
    if (step) {
      currentMacro.steps[stepIndex] = step;
      markDirty();
    }

    lastContext = getAutocompleteContext(value);
    measure.textContent = value;

    if (lastContext.items.length === 0) {
      dropdown.classList.add('hidden');
      ghost.textContent = '';
      activeDropdownIndex = -1;
      return;
    }

    dropdownSelectedIndex = 0;
    activeDropdownIndex = stepIndex;
    ghost.textContent = ghostForItem(value, lastContext.items[0]);
    dropdown.classList.remove('hidden');
    renderDropdown(lastContext);
  }

  function accept(item) {
    const newValue = acceptedValue(item);
    input.value = newValue;
    measure.textContent = newValue;
    const step = textToStep(newValue);
    if (step) {
      currentMacro.steps[stepIndex] = step;
      markDirty();
    }
    dropdownSelectedIndex = 0;
    updateAutocomplete();
    input.focus();
  }

  function createStepAfter() {
    currentMacro.steps.splice(stepIndex + 1, 0, { type: 'incomplete', raw: '' });
    markDirty();
    const focusIdx = stepIndex + 1;
    renderSteps();
    setTimeout(() => {
      const inputs = stepsListEl.querySelectorAll('.step-ac-input');
      if (inputs[focusIdx]) inputs[focusIdx].focus();
    }, 0);
  }

  input.addEventListener('input', updateAutocomplete);

  input.addEventListener('keydown', (e) => {
    const dropdownOpen = !dropdown.classList.contains('hidden');
    const items = lastContext ? lastContext.items : [];

    if (e.key === 'ArrowDown' && dropdownOpen && items.length > 0) {
      e.preventDefault();
      dropdownSelectedIndex = (dropdownSelectedIndex + 1) % items.length;
      syncSelection();
      return;
    }
    if (e.key === 'ArrowUp' && dropdownOpen && items.length > 0) {
      e.preventDefault();
      dropdownSelectedIndex = (dropdownSelectedIndex - 1 + items.length) % items.length;
      syncSelection();
      return;
    }
    if (e.key === 'Escape' && dropdownOpen) {
      e.preventDefault();
      dropdown.classList.add('hidden');
      ghost.textContent = '';
      activeDropdownIndex = -1;
      return;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      if (dropdownOpen && items.length > 0) {
        const item = items[dropdownSelectedIndex];
        const newVal = acceptedValue(item);
        if (newVal !== input.value) {
          e.preventDefault();
          accept(item);
          return;
        }
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        createStepAfter();
      }
      return;
    }

    if (e.key === 'Backspace' && input.value === '' && currentMacro.steps.length > 1) {
      e.preventDefault();
      const focusIdx = Math.max(0, stepIndex - 1);
      currentMacro.steps.splice(stepIndex, 1);
      markDirty();
      renderSteps();
      setTimeout(() => {
        const inputs = stepsListEl.querySelectorAll('.step-ac-input');
        if (inputs[focusIdx]) inputs[focusIdx].focus();
      }, 0);
    }
  });

  input.addEventListener('focus', () => {
    stepsListEl.querySelectorAll('.step-ac-dropdown').forEach(dd => {
      if (dd !== dropdown) dd.classList.add('hidden');
    });
    updateAutocomplete();
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      dropdown.classList.add('hidden');
      ghost.textContent = '';
      activeDropdownIndex = -1;
    }, 150);
  });
}


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

  // Check for incomplete steps
  const incompleteSteps = currentMacro.steps.filter(step => {
    if (step.type === 'incomplete') return true;
    if (step.type === 'insert-text' && !step.content) return true;
    if (step.type === 'insert-date' && !step.format) return true;
    if (step.type === 'cardmirror' && !step.label) return true;
    if (step.type === 'comment' && !step.text) return true;
    if (step.type === 'insert-prompt' && !step.message) return true;
    if (step.type === 'insert-counter' && !step.name) return true;
    return false;
  });

  if (incompleteSteps.length > 0) {
    alert('Please complete all steps before saving. All steps must have content.');
    return;
  }

  // Filter out incomplete steps
  const completeSteps = currentMacro.steps.filter(step => step.type !== 'incomplete');

  // Validate control flow nesting
  try {
    validateSteps(completeSteps);
  } catch (err) {
    alert(`Control flow validation error: ${err.message}`);
    return;
  }

  const filename = currentMacro.filename || `${sanitizeFilename(name)}.cmcm`;

  try {
    const content = serializeCmcm({
      name: currentMacro.name,
      steps: completeSteps,
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

btnSyntax.addEventListener('click', toggleSyntax);
btnSyntaxClose.addEventListener('click', toggleSyntax);
btnNew.addEventListener('click', newMacro);
document.getElementById('btn-new-empty').addEventListener('click', newMacro);
btnAddStep.addEventListener('click', () => {
  if (!currentMacro) return;
  currentMacro.steps.push({ type: 'incomplete', raw: '' });
  markDirty();
  renderSteps();
  // Focus the new step input
  setTimeout(() => {
    const inputs = stepsListEl.querySelectorAll('.step-ac-input');
    if (inputs[inputs.length - 1]) {
      inputs[inputs.length - 1].focus();
      // scroll to bottom
      inputs[inputs.length - 1].scrollIntoView({ behavior: 'smooth' });
    }
  }, 0);
});
btnSave.addEventListener('click', saveMacro);
btnRename.addEventListener('click', renameMacro);
btnDelete.addEventListener('click', deleteMacro);

macroNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (currentMacro) {
      if (currentMacro.steps.length === 0) {
        currentMacro.steps.push({ type: 'incomplete', raw: '' });
        markDirty();
        renderSteps();
      }
      setTimeout(() => {
        const inputs = stepsListEl.querySelectorAll('.step-ac-input');
        if (inputs[0]) inputs[0].focus();
      }, 0);
    }
  }
});

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
