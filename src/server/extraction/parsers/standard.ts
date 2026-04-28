/**
 * Standard parser — the fallback when no lab-specific format is detected.
 *
 * Direct port of parse_standard() in extract_invoice.py. Pulls the most
 * common field names with generic regexes. All fields default to "medium"
 * confidence because we don't have lab-specific anchors to be sure of any
 * single match.
 */
import type { LabParser } from '../parser';
import { cleanAmount } from '../helpers';
import { makeRow } from '../confidence';
import { registerParser } from '../parser';
import type { ExtractedInvoiceRow, PdfExtractionContext } from '../types';

const standardParser: LabParser = {
  format: 'standard',
  parse(ctx: PdfExtractionContext, lab: string | null): ExtractedInvoiceRow[] {
    const text = ctx.text;
    let invoiceDate: string | null = null;
    for (const pat of [
      /(?:invoice\s*date|date)[:\s]+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
      /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\b/,
      /\b(\d{4}-\d{2}-\d{2})\b/,
    ]) {
      const m = text.match(pat);
      if (m && m[1]) {
        invoiceDate = m[1].trim();
        break;
      }
    }

    let invoiceNumber: string | null = null;
    for (const pat of [
      /(?:invoice\s*(?:no|number|#))[:\s#]*([A-Z0-9\-/]+)/i,
      /(?:invoice)[:\s]+([A-Z]{0,3}\d{3,10})/i,
    ]) {
      const m = text.match(pat);
      if (m && m[1]) {
        invoiceNumber = m[1].trim();
        break;
      }
    }

    let jobReference: string | null = null;
    const jm = text.match(/(?:job\s*ref|work\s*order|job\s*no)[:\s#]+([A-Z0-9\-/]+)/i);
    if (jm && jm[1]) jobReference = jm[1].trim();

    let patientName: string | null = null;
    for (const pat of [
      /(?:patient)[:\s]+([A-Za-z\s\-']{3,40}?)(?:\n|\d)/i,
      /(?:client)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    ]) {
      const m = text.match(pat);
      if (m && m[1]) {
        const name = m[1].trim();
        if (name.length > 3) {
          patientName = name;
          break;
        }
      }
    }

    let invoicedAmount: number | null = null;
    const am = text.match(/(?:total\s*due|invoice\s*total|total)[:\s]+[£$]?\s*([\d,]+\.?\d*)/i);
    if (am && am[1]) invoicedAmount = cleanAmount(am[1]);

    let paymentsMade: number | null = null;
    const pm = text.match(/(?:payments?\s*made|amount\s*paid)[:\s]+[£$]?\s*([\d,]+\.?\d*)/i);
    if (pm && pm[1]) paymentsMade = cleanAmount(pm[1]);

    let balance: number | null = null;
    const bm = text.match(/(?:balance\s*due|balance)[:\s]+[£$]?\s*([\d,]+\.?\d*)/i);
    if (bm && bm[1]) balance = cleanAmount(bm[1]);

    return [
      makeRow(
        {
          invoiceDate,
          invoiceNumber,
          jobReference,
          patientName,
          laboratoryName: lab,
          invoicedAmount,
          paymentsMade,
          balance,
        },
        {
          // Generic regex matches → medium confidence. Caller may want to
          // run AI fallback as a cross-check.
          invoiceDate: invoiceDate ? 'medium' : 'low',
          invoiceNumber: invoiceNumber ? 'medium' : 'low',
          jobReference: jobReference ? 'medium' : 'low',
          patientName: patientName ? 'medium' : 'low',
          laboratoryName: lab ? 'medium' : 'low',
          invoicedAmount: invoicedAmount !== null ? 'medium' : 'low',
          paymentsMade: paymentsMade !== null ? 'medium' : 'low',
          balance: balance !== null ? 'medium' : 'low',
        },
      ),
    ];
  },
};

registerParser(standardParser);
export {};
