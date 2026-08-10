const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const TOKENS = [
  { pattern: 'MONTH', fn: (d) => MONTH_NAMES[d.getMonth()].toUpperCase() },
  { pattern: 'Month', fn: (d) => MONTH_NAMES[d.getMonth()] },
  { pattern: 'month', fn: (d) => MONTH_NAMES[d.getMonth()].toLowerCase() },
  { pattern: 'MON',   fn: (d) => MONTH_ABBR[d.getMonth()].toUpperCase() },
  { pattern: 'Mon',   fn: (d) => MONTH_ABBR[d.getMonth()] },
  { pattern: 'mon',   fn: (d) => MONTH_ABBR[d.getMonth()].toLowerCase() },
  { pattern: 'yyyy',  fn: (d) => String(d.getFullYear()) },
  { pattern: 'yy',    fn: (d) => String(d.getFullYear()).slice(-2) },
  { pattern: 'mm',    fn: (d) => String(d.getMonth() + 1).padStart(2, '0') },
  { pattern: 'dd',    fn: (d) => String(d.getDate()).padStart(2, '0') },
  { pattern: 'm',     fn: (d) => String(d.getMonth() + 1) },
  { pattern: 'd',     fn: (d) => String(d.getDate()) },
];

export function formatDate(formatString, date) {
  date = date || new Date();
  let result = '';
  let i = 0;

  while (i < formatString.length) {
    let matched = false;

    for (const token of TOKENS) {
      if (formatString.startsWith(token.pattern, i)) {
        result += token.fn(date);
        i += token.pattern.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result += formatString[i];
      i++;
    }
  }

  return result;
}

export const PRESET_FORMATS = [
  { label: 'm.dd.yy',        format: 'm.dd.yy',        example: '' },
  { label: 'mm/dd/yyyy',     format: 'mm/dd/yyyy',     example: '' },
  { label: 'yyyy-mm-dd',     format: 'yyyy-mm-dd',     example: '' },
  { label: 'MON DD, YYYY',   format: 'MON dd, yyyy',   example: '' },
  { label: 'Month DD, YYYY', format: 'Month dd, yyyy', example: '' },
  { label: 'mm-dd-yyyy',     format: 'mm-dd-yyyy',     example: '' },
  { label: 'dd/mm/yyyy',     format: 'dd/mm/yyyy',     example: '' },
];

// Fill in live examples
for (const preset of PRESET_FORMATS) {
  preset.example = formatDate(preset.format, new Date());
}
