/**
 * Public extraction entry point.
 *
 *   const result = await extractInvoice(pdfBuffer, "Hall Dental Studio.pdf");
 *
 * Pipeline:
 *   1. Read text + tables from the PDF (./pdf.ts).
 *   2. Detect the lab name from the text (./helpers.ts).
 *   3. Detect the format flavour (one of ExtractionFormat).
 *   4. Look up the matching parser; fall back to "standard" or claude_fallback.
 *   5. Return a normalised ExtractionResult.
 *
 * Design: parsers are pure functions registered in a map. We never reach for
 * the network here — the AI fallback is wired through but only fires if the
 * format detector returns "standard" AND parseStandard returns no rows.
 */
import { extractPdfTextAndTables } from './pdf';
import { detectLab, detectFormat } from './helpers';
import { getParser } from './parser';
import type { ExtractionResult, ParserName } from './types';

// Side-effect import: registers all built-in parsers.
import './parsers';

export interface ExtractInvoiceOptions {
  /** Original filename — included in the result for logs/audit. */
  filename?: string;
  /** Disable the Claude fallback even if standard returns no rows. Defaults true until wired. */
  enableClaudeFallback?: boolean;
}

export async function extractInvoice(
  pdf: Buffer | Uint8Array,
  filename = 'unknown.pdf',
  opts: ExtractInvoiceOptions = {},
): Promise<ExtractionResult> {
  const ctx = await extractPdfTextAndTables(pdf);
  const detectedLab = detectLab(ctx.text);
  const detectedFormat = detectFormat(ctx.text);

  let parserUsed: ParserName = detectedFormat;
  const parser = getParser(detectedFormat);
  let rows = parser ? parser.parse(ctx, detectedLab) : [];

  // Fall back to "standard" if the dedicated parser came back empty.
  if (!rows.length && detectedFormat !== 'standard') {
    const std = getParser('standard');
    if (std) {
      rows = std.parse(ctx, detectedLab);
      parserUsed = 'standard';
    }
  }

  // Future: if rows.length === 0 && opts.enableClaudeFallback, route to Claude.
  // Will land in the dedicated AI-fallback task once the API key is in place.
  if (!rows.length && opts.enableClaudeFallback) {
    parserUsed = 'claude_fallback';
    // TODO: implement in src/server/extraction/claude.ts
  }

  return {
    rows,
    detectedLab,
    detectedFormat,
    parserUsed,
    sourceFilename: filename,
    rawText: ctx.text,
  };
}
