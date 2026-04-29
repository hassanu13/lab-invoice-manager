/**
 * Extraction types — TypeScript mirror of the Python extractor's row dict.
 *
 * Keeping field names identical makes diffing TS vs Python output mechanical:
 *   pythonRow.invoice_number === tsRow.invoiceNumber  (camelCase only difference)
 *
 * One ExtractedInvoiceRow corresponds to one line on a lab statement, or one
 * invoice in a single-invoice PDF. A statement-style PDF therefore returns
 * many rows + a STATEMENT TOTAL summary row at the end.
 */

/** A single extracted invoice line / row. */
export interface ExtractedInvoiceRow {
  invoiceDate: string | null; // dd/mm/yyyy, dd/mm/yy, or yyyy-mm-dd as in source
  invoiceNumber: string | null;
  jobReference: string | null;
  patientName: string | null;
  laboratoryName: string | null;
  invoicedAmount: number | null; // GBP, 2dp
  paymentsMade: number | null;
  balance: number | null;

  /** Per-field confidence — populated by the parser. */
  confidence: ExtractionConfidence;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Per-field confidence for the confirmation screen. */
export interface ExtractionConfidence {
  invoiceDate: ConfidenceLevel;
  invoiceNumber: ConfidenceLevel;
  jobReference: ConfidenceLevel;
  patientName: ConfidenceLevel;
  laboratoryName: ConfidenceLevel;
  invoicedAmount: ConfidenceLevel;
  paymentsMade: ConfidenceLevel;
  balance: ConfidenceLevel;
  /** Overall — usually min() of the per-field levels. */
  overall: ConfidenceLevel;
}

/** What the dispatcher returns. */
export interface ExtractionResult {
  rows: ExtractedInvoiceRow[];
  detectedLab: string | null;
  detectedFormat: ExtractionFormat;
  /** Which extractor actually produced these rows (for audit/debug). */
  parserUsed: ParserName;
  /** Source file name, useful for logs. */
  sourceFilename: string;
  /** Raw page texts joined — kept for debugging and the AI fallback. */
  rawText: string;
}

/** Format detected by detectFormat(). Mirrors the Python tag values exactly. */
export type ExtractionFormat =
  | '3dental'
  | 'dent8_innovate'
  | 'hall'
  | 'carlkearney'
  | 'aestheticworld'
  | 'digitalprothetics'
  | 's4s'
  | 'standard';

/** All parser names — same set as ExtractionFormat plus the AI fallback. */
export type ParserName = ExtractionFormat | 'claude_fallback';
