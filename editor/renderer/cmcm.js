// .cmcm (CardMirror Custom Macro) parser and serializer

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

    const stepContent = trimmed.replace(/^\d+\.\s*/, '');

    if (stepContent.startsWith('Insert:Text:')) {
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

  return { name, steps };
}

export function serializeCmcm({ name, steps }) {
  const lines = [`NAME: ${name}`];
  let stepNum = 1;

  for (const step of steps) {
    if (step.type === 'comment') {
      lines.push(`# ${step.text}`);
    } else if (step.type === 'insert-text') {
      lines.push(`${stepNum}. Insert:Text:${step.content}`);
      stepNum++;
    } else if (step.type === 'insert-date') {
      lines.push(`${stepNum}. Insert:Date:${step.format}`);
      stepNum++;
    } else if (step.type === 'cardmirror') {
      lines.push(`${stepNum}. CardMirror:${step.label}`);
      stepNum++;
    }
  }

  return lines.join('\n') + '\n';
}

export class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ParseError';
  }
}
