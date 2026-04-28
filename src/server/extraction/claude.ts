/**
 * AI fallback extractor — Anthropic Claude.
 *
 * When detectFormat() returns "standard" AND parseStandard returns no rows,
 * we hand the raw text to Claude with a structured-output prompt that
 * mirrors our ExtractedInvoiceRow shape. The dispatcher can then proceed as
 * normal — same row shape, same confidence convention.
 *
 * Cost discipline:
 *   - Only fires when deterministic parsers fail.
 *   - Caps text at 30k characters (most lab statements are <8k); anything
 *     longer is truncated. We log a warning when truncation kicks in.
 *   - Uses Haiku-class pricing where possible. For ~5–10 fallback calls per
 *     month at MVP volumes, monthly spend is <£1.
 *
 * Confidence: every field comes back as 'medium'. The model is competent at
 * structured extraction but doesn't have the lab-specific anchors a hand-
 * written parser does. The confirmation screen flags every field for review.
 */
import Anthropic from '@anthropic-ai/sdk';
import { cleanAmount, detectLab } from './helpers';
import { makeRow } from './confidence';
import type { ExtractedInvoiceRow } from './types';

const MAX_INPUT_CHARS = 30_000;
const MODEL = 'claude-haiku-4-5-20251001';

interface ClaudeRowOutput {
  invoice_date: string | null;
  invoice_number: string | null;
  job_reference: string | null;
  patient_name: string | null;
  invoiced_amount: number | string | null;
  payments_made: number | string | null;
  balance: number | string | null;
}

const SYSTEM_PROMPT = `You are an invoice extraction engine for a UK dental practice's lab invoice manager.
You receive the raw text of a lab invoice or statement PDF and return a JSON array of rows, one per invoice line.

Each row has these exact keys (use null for any field you cannot find):
  invoice_date     : string, prefer dd/mm/yyyy, but pass through whatever format the source uses
  invoice_number   : string
  job_reference    : string, lab's internal job/order reference if any (else null)
  patient_name     : string, title-cased, surname format as written
  invoiced_amount  : number, GBP, 2dp (no currency symbol or commas)
  payments_made    : number, GBP, 2dp
  balance          : number, GBP, 2dp

Rules:
- Output ONLY a JSON array. No prose, no markdown fences.
- For statement-style PDFs (multiple invoices), return one row per invoice line.
- For single-invoice PDFs, return one row.
- Never invent fields not present in the source.
- Currency is always GBP.`;

interface ClaudeFallbackArgs {
  text: string;
  filename: string;
  apiKey?: string;
}

export async function claudeFallback(args: ClaudeFallbackArgs): Promise<ExtractedInvoiceRow[]> {
  const apiKey = args.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set — cannot run AI fallback extractor.');
  }

  let text = args.text;
  if (text.length > MAX_INPUT_CHARS) {
    console.warn(
      `claudeFallback: truncating ${args.filename} from ${text.length} to ${MAX_INPUT_CHARS} chars`,
    );
    text = text.slice(0, MAX_INPUT_CHARS);
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `File: ${args.filename}\n\n--- INVOICE TEXT START ---\n${text}\n--- INVOICE TEXT END ---\n\nReturn the JSON array now.`,
      },
    ],
  });

  // Concatenate all text blocks; the model is instructed to emit JSON only,
  // but we still trim whitespace and strip stray ```json fences just in case.
  const raw = response.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('')
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/\s*```$/, '');

  let parsed: ClaudeRowOutput[];
  try {
    parsed = JSON.parse(raw) as ClaudeRowOutput[];
  } catch (e) {
    throw new Error(
      `claudeFallback: could not parse model output as JSON.\nRaw: ${raw.slice(0, 500)}\nError: ${(e as Error).message}`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error('claudeFallback: model output was not a JSON array.');
  }

  const lab = detectLab(text);
  return parsed.map((row) =>
    makeRow(
      {
        invoiceDate: row.invoice_date ?? null,
        invoiceNumber: row.invoice_number ?? null,
        jobReference: row.job_reference ?? null,
        patientName: row.patient_name ?? null,
        laboratoryName: lab,
        invoicedAmount: cleanAmount(row.invoiced_amount ?? null),
        paymentsMade: cleanAmount(row.payments_made ?? null),
        balance: cleanAmount(row.balance ?? null),
      },
      {
        // Across the board: medium. The model is good but doesn't have
        // lab-specific anchors. Confirmation screen flags everything.
        invoiceDate: 'medium',
        invoiceNumber: 'medium',
        jobReference: row.job_reference ? 'medium' : 'low',
        patientName: 'medium',
        laboratoryName: lab ? 'medium' : 'low',
        invoicedAmount: row.invoiced_amount !== null ? 'medium' : 'low',
        paymentsMade: row.payments_made !== null ? 'medium' : 'low',
        balance: row.balance !== null ? 'medium' : 'low',
      },
    ),
  );
}
