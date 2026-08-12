// .cmcm (CardMirror Custom Macro) parser and serializer

export const VALID_ELEMENTS = [
  'Pocket', 'Hat', 'Block', 'Tag', 'Analytic', 'Cite', 'CiteParagraph',
  'CardBody', 'Text', 'Underlined', 'Highlighted', 'Emphasized', 'DocumentName'
];

export class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ParseError';
  }
}

// Expression parsing: "text", 42, !varname, !var + 1, COUNT(Nearby.Blocks)
export function parseExpression(str) {
  str = str.trim();

  // String literal
  if (str.startsWith('"') && str.endsWith('"')) {
    return { type: 'string', value: str.slice(1, -1) };
  }

  // Number
  if (/^\d+$/.test(str)) {
    return { type: 'number', value: parseInt(str, 10) };
  }

  // Variable
  if (str.startsWith('!') && /^![a-zA-Z_]\w*$/.test(str)) {
    return { type: 'variable', name: str.slice(1) };
  }

  // Binary: !var + 1, !var - 1
  const binaryMatch = str.match(/^(.+?)\s*([+\-])\s*(.+)$/);
  if (binaryMatch) {
    try {
      const left = parseExpression(binaryMatch[1]);
      const right = parseExpression(binaryMatch[3]);
      return { type: 'binary', operator: binaryMatch[2], left, right };
    } catch (e) {
      // Fall through to COUNT check
    }
  }

  // COUNT(Nearby.Blocks) or COUNT(Blocks.containing(!var))
  const countMatch = str.match(/^COUNT\((.+)\)$/);
  if (countMatch) {
    const inner = countMatch[1].trim();
    // Simple: Nearby.Blocks, Blocks
    if (/^Nearby\.[A-Z]\w*$/.test(inner)) {
      const elem = inner.split('.')[1];
      return { type: 'count', element: elem, nearby: true, filter: null };
    }
    if (/^[A-Z]\w*$/.test(inner)) {
      return { type: 'count', element: inner, nearby: false, filter: null };
    }
    // With filter: Blocks.containing(!var) or Blocks.containing("text")
    const filterMatch = inner.match(/^(Nearby\.)?([A-Z]\w*)\.containing\((.+)\)$/);
    if (filterMatch) {
      const nearby = !!filterMatch[1];
      const elem = filterMatch[2];
      const filterStr = filterMatch[3].trim();
      let filter;
      try {
        if (filterStr.startsWith('"') && filterStr.endsWith('"')) {
          filter = { type: 'string', value: filterStr.slice(1, -1) };
        } else if (filterStr.startsWith('!')) {
          filter = { type: 'variable', name: filterStr.slice(1) };
        } else {
          throw new ParseError('COUNT filter must be string or variable');
        }
      } catch (e) {
        throw new ParseError('COUNT filter parse error');
      }
      return { type: 'count', element: elem, nearby, filter };
    }
  }

  throw new ParseError(`Cannot parse expression: "${str}"`);
}

// Condition parsing: Pocket.contains("2AC") AND !var = "text" OR Nearby.Block.contains(!speech)
// Returns array of AND-groups: [[atom1, atom2], [atom3]] means (A1 AND A2) OR A3
export function parseCondition(str) {
  // Extract quoted strings first to protect from OR/AND splitting
  const placeholders = [];
  let escaped = str;
  const quoteMatch = /"([^"\\]|\\.)*"/g;
  let match;
  while ((match = quoteMatch.exec(str)) !== null) {
    const idx = placeholders.length;
    placeholders.push(match[0]);
    escaped = escaped.replace(match[0], `__Q${idx}__`);
  }

  // Split on OR (disjunction)
  const orGroups = escaped.split(/\s+OR\s+/i).map(g => g.trim());

  // For each group, split on AND (conjunction)
  const result = orGroups.map(group => {
    const andAtoms = group.split(/\s+AND\s+/i).map(a => a.trim());
    return andAtoms.map(atomStr => {
      // Restore quotes
      for (let i = 0; i < placeholders.length; i++) {
        atomStr = atomStr.replace(`__Q${i}__`, placeholders[i]);
      }
      return parseAtomicCondition(atomStr);
    });
  });

  return result;
}

// Parse a single condition atom
function parseAtomicCondition(str) {
  str = str.trim();

  // Element.contains("text") or Nearby.Element.contains(value)
  const containsMatch = str.match(/^(Nearby\.)?([A-Z]\w*)\.contains\((.+)\)$/);
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
      throw new ParseError(`contains() argument must be string or variable`);
    }
    return { type: 'contains', element, nearby, value };
  }

  // !var = "text" or !var > 5 or !var < 10
  const compareMatch = str.match(/^!([a-zA-Z_]\w*)\s*(=|>|<)\s*(.+)$/);
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
      throw new ParseError(`comparison value must be string or number`);
    }
    return { type: 'compare', variable, operator, value };
  }

  throw new ParseError(`Cannot parse condition atom: "${str}"`);
}

// Serialize expression AST back to text
export function serializeExpression(expr) {
  if (expr.type === 'string') {
    return `"${expr.value}"`;
  }
  if (expr.type === 'number') {
    return String(expr.value);
  }
  if (expr.type === 'variable') {
    return `!${expr.name}`;
  }
  if (expr.type === 'binary') {
    const left = serializeExpression(expr.left);
    const right = serializeExpression(expr.right);
    return `${left} ${expr.operator} ${right}`;
  }
  if (expr.type === 'count') {
    const elemPart = expr.nearby ? `Nearby.${expr.element}` : expr.element;
    if (!expr.filter) {
      return `COUNT(${elemPart})`;
    }
    const filterStr = expr.filter.type === 'string'
      ? `"${expr.filter.value}"`
      : `!${expr.filter.name}`;
    return `COUNT(${elemPart}.containing(${filterStr}))`;
  }
  throw new ParseError(`Cannot serialize expression of type: ${expr.type}`);
}

// Serialize condition AST back to text
export function serializeCondition(ast) {
  // ast is array of AND-groups: [[atom1, atom2], [atom3]]
  const orParts = ast.map(group => {
    const andParts = group.map(atom => {
      if (atom.type === 'contains') {
        const elemPart = atom.nearby ? `Nearby.${atom.element}` : atom.element;
        const valueStr = atom.value.type === 'string'
          ? `"${atom.value.value}"`
          : `!${atom.value.name}`;
        return `${elemPart}.contains(${valueStr})`;
      }
      if (atom.type === 'compare') {
        const valueStr = atom.value.type === 'string'
          ? `"${atom.value.value}"`
          : String(atom.value.value);
        return `!${atom.variable} ${atom.operator} ${valueStr}`;
      }
      throw new ParseError(`Cannot serialize condition atom of type: ${atom.type}`);
    });
    return andParts.join(' AND ');
  });
  return orParts.join(' OR ');
}

// Validate IF/ELIF/ELSE/END nesting and REPEAT/WHILE/END nesting
export function validateSteps(steps) {
  const stack = [];
  for (const step of steps) {
    if (step.type === 'if') {
      stack.push('if');
    } else if (step.type === 'elif') {
      if (stack.length === 0 || (stack[stack.length - 1] !== 'if' && stack[stack.length - 1] !== 'elif')) {
        throw new ParseError('ELIF without matching IF');
      }
      stack[stack.length - 1] = 'elif';
    } else if (step.type === 'else') {
      if (stack.length === 0 || (stack[stack.length - 1] !== 'if' && stack[stack.length - 1] !== 'elif')) {
        throw new ParseError('ELSE without matching IF');
      }
      stack[stack.length - 1] = 'else';
    } else if (step.type === 'repeat') {
      stack.push('repeat');
    } else if (step.type === 'while') {
      stack.push('while');
    } else if (step.type === 'end') {
      if (stack.length === 0) {
        throw new ParseError('END without matching IF, REPEAT, or WHILE');
      }
      stack.pop();
    } else if (step.type === 'break') {
      const hasLoop = stack.some(s => s === 'repeat' || s === 'while');
      if (!hasLoop) {
        throw new ParseError('BREAK outside of REPEAT or WHILE loop');
      }
    }
  }
  if (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (top === 'repeat' || top === 'while') {
      throw new ParseError('Unclosed ' + top.toUpperCase() + ' block');
    }
    throw new ParseError('Unclosed IF block');
  }
}

export function parseCmcm(text) {
  const lines = text.split('\n');
  let name = null;
  const steps = [];
  let foundName = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed === '') continue;

    if (!foundName) {
      const nameMatch = trimmed.match(/^NAME:\s*(.+)$/i);
      if (!nameMatch) {
        throw new ParseError(`Line ${i + 1}: expected "NAME: <macro name>" but got "${trimmed}"`);
      }
      name = nameMatch[1].trim();
      if (!name) {
        throw new ParseError(`Line ${i + 1}: macro name cannot be empty`);
      }
      foundName = true;
      continue;
    }

    if (trimmed.startsWith('#')) {
      steps.push({ type: 'comment', text: trimmed.slice(1).trim() });
      continue;
    }

    // Use trimStart to preserve trailing whitespace (matters for Insert:Text:)
    const stepContent = raw.trimStart().replace(/^\d+\.\s*/, '');

    // Handle new step types first
    if (stepContent === 'ELSE') {
      steps.push({ type: 'else' });
    } else if (stepContent === 'END') {
      steps.push({ type: 'end' });
    } else if (stepContent === 'BREAK') {
      steps.push({ type: 'break' });
    } else if (stepContent.startsWith('IF ')) {
      const condition = parseCondition(stepContent.slice(3));
      steps.push({ type: 'if', condition });
    } else if (stepContent.startsWith('ELIF ')) {
      const condition = parseCondition(stepContent.slice(5));
      steps.push({ type: 'elif', condition });
    } else if (stepContent.startsWith('REPEAT ')) {
      const countExpr = parseExpression(stepContent.slice(7));
      steps.push({ type: 'repeat', count: countExpr });
    } else if (stepContent.startsWith('WHILE ')) {
      const condition = parseCondition(stepContent.slice(6));
      steps.push({ type: 'while', condition });
    } else if (stepContent.startsWith('SET !')) {
      const rest = stepContent.slice(5); // Remove 'SET !'
      const eqIdx = rest.indexOf('=');
      if (eqIdx === -1) {
        throw new ParseError(`Line ${i + 1}: SET must have format "SET !varname = expression"`);
      }
      const varname = rest.slice(0, eqIdx).trim();
      if (!/^[a-zA-Z_]\w*$/.test(varname)) {
        throw new ParseError(`Line ${i + 1}: invalid variable name "${varname}"`);
      }
      const exprStr = rest.slice(eqIdx + 1).trim();
      const expression = parseExpression(exprStr);
      steps.push({ type: 'set', variable: varname, expression });
    } else if (stepContent.startsWith('Insert:!')) {
      const varname = stepContent.slice('Insert:!'.length);
      if (!/^[a-zA-Z_]\w*$/.test(varname)) {
        throw new ParseError(`Line ${i + 1}: invalid variable name "${varname}"`);
      }
      steps.push({ type: 'insert-var', variable: varname });
    } else if (stepContent === 'Insert:Newline' || stepContent === 'Insert:Newline:') {
      steps.push({ type: 'insert-newline' });
    } else if (stepContent.startsWith('Insert:Clipboard:') || stepContent === 'Insert:Clipboard') {
      steps.push({ type: 'insert-clipboard' });
    } else if (stepContent.startsWith('Insert:Prompt:')) {
      const message = stepContent.slice('Insert:Prompt:'.length);
      if (!message) {
        throw new ParseError(`Line ${i + 1}: prompt message cannot be empty`);
      }
      steps.push({ type: 'insert-prompt', message });
    } else if (stepContent.startsWith('Insert:Counter:')) {
      const name = stepContent.slice('Insert:Counter:'.length).trim();
      if (!name) {
        throw new ParseError(`Line ${i + 1}: counter name cannot be empty`);
      }
      steps.push({ type: 'insert-counter', name });
    } else if (stepContent.startsWith('Insert:Text:')) {
      const content = stepContent.slice('Insert:Text:'.length);
      steps.push({ type: 'insert-text', content });
    } else if (stepContent.startsWith('Insert:Date:')) {
      const format = stepContent.slice('Insert:Date:'.length);
      if (!format) {
        throw new ParseError(`Line ${i + 1}: date format cannot be empty`);
      }
      steps.push({ type: 'insert-date', format });
    } else if (stepContent.startsWith('CardMirror:')) {
      const label = stepContent.slice('CardMirror:'.length).trim();
      if (!label) {
        throw new ParseError(`Line ${i + 1}: CardMirror command label cannot be empty`);
      }
      steps.push({ type: 'cardmirror', label });
    } else {
      throw new ParseError(`Line ${i + 1}: unrecognized step "${stepContent}"`);
    }
  }

  if (!foundName) {
    throw new ParseError('Missing "NAME:" line');
  }

  validateSteps(steps);
  return { name, steps };
}

export function serializeCmcm({ name, steps }) {
  const lines = [`NAME: ${name}`];
  let stepNum = 1;
  let depth = 0;

  for (const step of steps) {
    const indent = ' '.repeat(depth * 2);

    if (step.type === 'comment') {
      lines.push(`# ${step.text}`);
    } else if (step.type === 'if') {
      lines.push(`${stepNum}. ${indent}IF ${serializeCondition(step.condition)}`);
      stepNum++;
      depth++;
    } else if (step.type === 'elif') {
      const elifIndent = ' '.repeat(Math.max(0, depth - 1) * 2);
      lines.push(`${stepNum}. ${elifIndent}ELIF ${serializeCondition(step.condition)}`);
      stepNum++;
    } else if (step.type === 'else') {
      const elseIndent = ' '.repeat(Math.max(0, depth - 1) * 2);
      lines.push(`${stepNum}. ${elseIndent}ELSE`);
      stepNum++;
    } else if (step.type === 'end') {
      depth = Math.max(0, depth - 1);
      const endIndent = ' '.repeat(depth * 2);
      lines.push(`${stepNum}. ${endIndent}END`);
      stepNum++;
    } else if (step.type === 'break') {
      lines.push(`${stepNum}. ${indent}BREAK`);
      stepNum++;
    } else if (step.type === 'repeat') {
      lines.push(`${stepNum}. ${indent}REPEAT ${serializeExpression(step.count)}`);
      stepNum++;
      depth++;
    } else if (step.type === 'while') {
      lines.push(`${stepNum}. ${indent}WHILE ${serializeCondition(step.condition)}`);
      stepNum++;
      depth++;
    } else if (step.type === 'insert-newline') {
      lines.push(`${stepNum}. ${indent}Insert:Newline`);
      stepNum++;
    } else if (step.type === 'insert-clipboard') {
      lines.push(`${stepNum}. ${indent}Insert:Clipboard:`);
      stepNum++;
    } else if (step.type === 'insert-prompt') {
      lines.push(`${stepNum}. ${indent}Insert:Prompt:${step.message}`);
      stepNum++;
    } else if (step.type === 'insert-counter') {
      lines.push(`${stepNum}. ${indent}Insert:Counter:${step.name}`);
      stepNum++;
    } else if (step.type === 'set') {
      lines.push(`${stepNum}. ${indent}SET !${step.variable} = ${serializeExpression(step.expression)}`);
      stepNum++;
    } else if (step.type === 'insert-var') {
      lines.push(`${stepNum}. ${indent}Insert:!${step.variable}`);
      stepNum++;
    } else if (step.type === 'insert-text') {
      lines.push(`${stepNum}. ${indent}Insert:Text:${step.content}`);
      stepNum++;
    } else if (step.type === 'insert-date') {
      lines.push(`${stepNum}. ${indent}Insert:Date:${step.format}`);
      stepNum++;
    } else if (step.type === 'cardmirror') {
      lines.push(`${stepNum}. ${indent}CardMirror:${step.label}`);
      stepNum++;
    }
  }

  return lines.join('\n') + '\n';
}
