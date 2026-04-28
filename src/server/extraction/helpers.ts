/**
 * Shared helpers — direct ports of the Python utilities in extract_invoice.py.
 *
 * Behaviour is intentionally identical: same regex patterns, same edge-case
 * handling. If a discrepancy turns up between TS and Python output during
 * validation, *fix the TS port to match the Python*, not the other way around.
 * Three months of production usage have already validated the Python.
 */
import type { ExtractionFormat } from './types';

/**
 * Master list of known labs. Used by detectLab() and as the seed in the DB
 * (one row per lab in the `lab` table). Order matters: labs are checked in
 * sequence and first hit wins, so list specific names before generic.
 */
export const KNOWN_LABS = [
  'Hall Dental Studio',
  'Innovate Dental',
  'Dent8',
  'Invisalign',
  'Carl Kearney',
  'Digital Prosthetics',
  'S4S',
  'Aesthetic World',
  '3 Dental',
  'Avant Garde',
  'Boutique Whitening',
] as const;

/**
 * Strip currency symbols, commas, whitespace from a raw amount string and
 * parse to a number rounded to 2 dp. Returns null for unparseable values
 * AND for zero — matching the Python which treats 0 as "no value found".
 */
export function cleanAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/[£$,\s]/g, '');
  const val = parseFloat(cleaned);
  if (Number.isNaN(val) || val === 0) return null;
  return Math.round(val * 100) / 100;
}

/**
 * Identify the lab name from the document's text content.
 *
 * 1. Check each known lab name for a case-insensitive substring match.
 * 2. If no name matched, fall back to invoice-number-prefix heuristics
 *    (Dent8 uses INV-D…, Innovate uses INV-IN…).
 *
 * Returns the canonical lab name (e.g. "Hall Dental Studio") so it matches
 * the seeded `lab.name` column exactly.
 */
export function detectLab(text: string): string | null {
  const lowered = text.toLowerCase();
  for (const lab of KNOWN_LABS) {
    if (lowered.includes(lab.toLowerCase())) return lab;
  }
  // Invoice-number-prefix fallbacks — same as Python.
  if (/INV-D[0-9]/.test(text)) return 'Dent8';
  if (/INV-IN[0-9]/.test(text)) return 'Innovate Dental';
  return null;
}

/**
 * Decide which parser to use, based on cues in the text.
 *
 * Mirrors detect_format() from Python exactly. The order is significant:
 * earlier checks take precedence, so the most specific patterns come first.
 */
export function detectFormat(text: string): ExtractionFormat {
  const t = text.toLowerCase();

  if (/summary\s*no/.test(t) || /orderid\s+patient/.test(t)) return '3dental';
  if (t.includes('hall dental') || t.includes('halldentalstudio')) return 'hall';
  if (t.includes('carl kearney')) return 'carlkearney';
  if (t.includes('aesthetic world')) return 'aestheticworld';
  if (t.includes('digital prosthetics')) return 'digitalprothetics';
  if (t.includes('s4s') && t.includes('advice')) return 's4s';

  // Dent8 + Innovate share a portal format. Match an INV- prefix and the
  // typical headings — the \x00 / "pa\x00ent" check is a real artefact of
  // some PDF text layers, kept verbatim from the Python.
  if (
    /inv-[a-z0-9]+/.test(t) &&
    (t.includes('invoice amount') || t.includes('pa\x00ent') || t.includes('pa ent'))
  ) {
    return 'dent8_innovate';
  }

  return 'standard';
}

/**
 * Title-case a name in a forgiving way: same behaviour as Python's str.title()
 * but with apostrophes preserved (so "O'Brien" stays "O'Brien", not "O'brien").
 */
export function toTitleCase(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase())
      // Restore capital after an apostrophe inside a word: "o'brien" -> "O'Brien".
      .replace(/([A-Za-z])'([a-z])/g, (_, a: string, b: string) => `${a}'${b.toUpperCase()}`)
  );
}

/**
 * Strip control characters before writing to spreadsheet/DB columns —
 * mirrors clean_str() in Python. Some lab PDFs contain stray U+0000 etc.
 */
export function cleanStr<T>(v: T): T | string {
  if (typeof v === 'string') {
    // eslint-disable-next-line no-control-regex
    return v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim();
  }
  return v;
}
