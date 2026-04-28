/**
 * Parser registry. Each lab format has a parser implementing this interface.
 * The dispatcher (./extract.ts) picks one based on detectFormat() output.
 */
import type {
  ExtractionFormat,
  ExtractedInvoiceRow,
  PdfExtractionContext,
} from './types';

export interface LabParser {
  /** Format key this parser handles. Matches detectFormat() output. */
  format: ExtractionFormat;
  /**
   * Parse the PDF context into one-or-many rows.
   * The `lab` argument is the resolved lab name from detectLab(); pass null if unknown.
   */
  parse(ctx: PdfExtractionContext, lab: string | null): ExtractedInvoiceRow[];
}

/**
 * Internal registry of parsers. Populated by parsers/index.ts at module load.
 * Kept private so callers go through getParser().
 */
const registry = new Map<ExtractionFormat, LabParser>();

export function registerParser(parser: LabParser): void {
  if (registry.has(parser.format)) {
    throw new Error(`Parser for format "${parser.format}" already registered.`);
  }
  registry.set(parser.format, parser);
}

export function getParser(format: ExtractionFormat): LabParser | undefined {
  return registry.get(format);
}

/** For tests + debug only. */
export function listRegisteredParsers(): ExtractionFormat[] {
  return Array.from(registry.keys());
}
