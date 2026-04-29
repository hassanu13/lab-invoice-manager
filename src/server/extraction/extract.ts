/**
 * Public extraction entry point — HTTP client for the Python microservice.
 *
 *   const result = await extractInvoice(pdfBuffer, "Hall Dental Studio.pdf");
 *
 * Why a Python service?
 *   The production-tested extract_invoice.py uses pdfplumber, which has no
 *   reliable Node equivalent (we tried pdfjs-dist; the font-loading and table
 *   reconstruction proved fragile). Wrapping the Python in FastAPI keeps three
 *   months of validated parsing logic intact while letting the rest of the
 *   stack stay TypeScript.
 *
 *   See extractor/ for the service. It's part of the same docker-compose so
 *   `npm run infra:up` brings it up alongside Postgres + MinIO.
 *
 * AI fallback:
 *   If the deterministic parsers return no rows, optionally route the raw
 *   text to Claude (claudeFallback). Off by default — caller opts in.
 */
import { claudeFallback } from './claude';
import type { ExtractedInvoiceRow, ExtractionResult, ParserName } from './types';

const DEFAULT_EXTRACTOR_URL = 'http://localhost:8000';

export interface ExtractInvoiceOptions {
  /** Original filename — included in the result for logs/audit. */
  filename?: string;
  /**
   * If deterministic parsers return zero rows, fall back to Anthropic Claude.
   * Off by default; the upload route turns it on.
   */
  enableClaudeFallback?: boolean;
  /**
   * Override the extractor service URL. Defaults to EXTRACTOR_URL env var
   * or http://localhost:8000 in dev / http://lim-extractor:8000 inside Docker.
   */
  extractorUrl?: string;
}

interface PythonExtractResponse {
  rows: ExtractedInvoiceRow[];
  detectedLab: string | null;
  detectedFormat: ExtractionResult['detectedFormat'];
  parserUsed: ParserName;
  sourceFilename: string;
  rawText: string;
}

export async function extractInvoice(
  pdf: Buffer | Uint8Array,
  filename = 'unknown.pdf',
  opts: ExtractInvoiceOptions = {},
): Promise<ExtractionResult> {
  const url = (opts.extractorUrl ?? process.env.EXTRACTOR_URL ?? DEFAULT_EXTRACTOR_URL).replace(
    /\/$/,
    '',
  );

  // FormData is the universal multipart shape; Node 18+ has it built in.
  // Wrap the PDF in a Blob so Node's fetch sets the right multipart headers.
  // Copy the bytes into a fresh ArrayBuffer (not SharedArrayBuffer) so the
  // Blob constructor's strict typing accepts it.
  const form = new FormData();
  const bytes = new Uint8Array(pdf.byteLength);
  bytes.set(new Uint8Array(pdf.buffer as ArrayBuffer, pdf.byteOffset, pdf.byteLength));
  const blob = new Blob([bytes], { type: 'application/pdf' });
  form.append('file', blob, filename);

  let payload: PythonExtractResponse;
  try {
    const res = await fetch(`${url}/extract`, { method: 'POST', body: form });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`extractor returned ${res.status}: ${detail.slice(0, 200)}`);
    }
    payload = (await res.json()) as PythonExtractResponse;
  } catch (e) {
    throw new Error(
      `Could not reach extractor service at ${url}/extract — is it running? (${(e as Error).message})`,
    );
  }

  let rows = payload.rows;
  let parserUsed: ParserName = payload.parserUsed;

  // AI fallback: if no parser produced rows, hand the raw text to Claude.
  if (rows.length === 0 && opts.enableClaudeFallback) {
    try {
      rows = await claudeFallback({ text: payload.rawText, filename });
      parserUsed = 'claude_fallback';
    } catch (e) {
      console.error('claude_fallback_failed', { filename, error: (e as Error).message });
    }
  }

  return {
    rows,
    detectedLab: payload.detectedLab,
    detectedFormat: payload.detectedFormat,
    parserUsed,
    sourceFilename: payload.sourceFilename,
    rawText: payload.rawText,
  };
}
