// Number and date formatting shared by every view. Negative numbers use a real
// minus sign (U+2212) so they line up with plus signs in tabular figures.

const MINUS = '−';

// A word joiner (U+2060) keeps a sign on the same line as its number.
const signed = (text, x) => (x > 0 ? `+\u2060${text}` : x < 0 ? `${MINUS}\u2060${text}` : text);

/** Round to the nearest half point, as betting lines are quoted. */
export const half = x => Math.round(x * 2) / 2;

/** A spread: +4.5, −4.5, or "Pick" for zero. */
export const spread = x => (x == null ? '–' : x === 0 ? 'Pick' : signed(String(Math.abs(x)), x));

/** American odds: +147, −167. */
export const odds = x => (x == null ? '–' : signed(String(Math.abs(Math.round(x))), x));

/** Whole dollars with a sign: +$5,128, −$320. */
export const money = x => (x == null ? '–' : signed(`$${Math.abs(Math.round(x)).toLocaleString('en-US')}`, Math.round(x)));

/** Dollars and cents with a sign: +$12.21. */
export const cents = x => (x == null ? '–' : signed(`$${Math.abs(x).toFixed(2)}`, Number(x.toFixed(2))));

export const pct = (x, digits = 1) => (x == null ? '–' : `${(x * 100).toFixed(digits)}%`);

/** A signed percentage: +4.5%, −2.1%. */
export const signedPct = (x, digits = 1) => (x == null ? '–' : signed(`${Math.abs(x * 100).toFixed(digits)}%`, Number((x * 100).toFixed(digits))));

export const dec = (x, digits = 1) => (x == null ? '–' : Number(x).toFixed(digits));

export const int = x => (x == null ? '–' : Math.round(x).toLocaleString('en-US'));

/** Signed number, e.g. plus/minus: +12, −3, 0 (or +5.0 with digits). */
export const plusMinus = (x, digits = 0) => {
  if (x == null) return '–';
  const r = Number(x.toFixed(digits));
  return signed(Math.abs(r).toFixed(digits), r);
};

/** 2017 -> "2017–18" (a season is named by the year it starts). */
export const season = year => `${year}–${String((year + 1) % 100).padStart(2, '0')}`;

const parseDate = s => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** "Friday 8 June 2018" */
export const longDate = s =>
  parseDate(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "8 Jun 2018" */
export const shortDate = s =>
  parseDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Decimal minutes (40.567) as 40:34. */
export const minutes = m => {
  const seconds = Math.round(m * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** Height from feet and inches: 6′9″ */
export const height = (feet, inches) => (feet != null && inches != null ? `${feet}′${inches}″` : null);

/** Break-even cover rate for a spread bet at −110: 110 / 210. */
export const BREAK_EVEN = 110 / 210;
