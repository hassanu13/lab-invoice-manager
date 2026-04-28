/**
 * Shared helpers. TypeScript port of the Python utilities in extract_invoice.py.
 *
 * Implementations land in Task 2 (port shared helpers). Until then these are
 * intentionally trivial so the rest of the module compiles.
 */
import type { ExtractionFormat } from './types';

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

export function cleanAmount(_raw: string | number | null | undefined): number | null {
  // TODO(week2): port from Python clean_amount()
  return null;
}

export function detectLab(_text: string): string | null {
  // TODO(week2): port from Python detect_lab()
  return null;
}

export function detectFormat(_text: string): ExtractionFormat {
  // TODO(week2): port from Python detect_format()
  return 'standard';
}
