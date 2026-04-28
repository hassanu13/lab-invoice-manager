/**
 * PDF reader — text + reconstructed tables.
 *
 * Strategy:
 *   1. pdfjs-dist gives us text items with x/y coordinates per page.
 *   2. We sort items into rows by y-coordinate (within a tolerance).
 *   3. We cluster items per page into columns by x-coordinate.
 *   4. The result mirrors what pdfplumber's page.extract_tables() produces.
 *
 * Implementation lands alongside the parsers themselves. Until then the stub
 * returns empty data so the rest of the module type-checks.
 */
import type { PdfExtractionContext } from './types';

export async function extractPdfTextAndTables(
  _pdf: Buffer | Uint8Array,
): Promise<PdfExtractionContext> {
  // TODO(week2): implement using pdfjs-dist
  return {
    text: '',
    tables: [],
    pageTexts: [],
  };
}
