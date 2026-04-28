/**
 * Carl Kearney statement parser.
 *
 * Format (two lines per invoice):
 *   12/02/2026 Invoice No.I001694: Due 1,940.00 1,940.00
 *   28/02/2026. ANDY TARBURTON
 *
 * Direct port of parse_carlkearney() in extract_invoice.py.
 */
import { cleanAmount, toTitleCase } from '../helpers';
import { makeRow } from '../confidence';
import { registerParser } from '../parser';
import type { LabParser } from '../parser';
import type { ExtractedInvoiceRow, PdfExtractionContext } from '../types';

// Single regex covers the two-line invoice block.
// `m` flag isn't needed because we already use \n explicitly.
const LINE_PATTERN =
  /(\d{2}\/\d{2}\/\d{4})\s+Invoice\s+No\.(I\d+)[^\n]+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*\n[\d/.]*\s*([A-Z][A-Z\s]+?)(?:\n|$)/gi;

const carlKearneyParser: LabParser = {
  format: 'carlkearney',
  parse(ctx: PdfExtractionContext, lab: string | null): ExtractedInvoiceRow[] {
    const text = ctx.text;
    const stmtNo = text.match(/STATEMENT\s+NO[.\s:]*(\d+)/i)?.[1] ?? null;
    const stmtDate = text.match(/DATE\s+(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? null;
    const totalDue = cleanAmount(text.match(/TOTAL\s+DUE\s+[£$]([\d,]+\.?\d*)/i)?.[1] ?? null);

    const rows: ExtractedInvoiceRow[] = [];
    for (const m of text.matchAll(LINE_PATTERN)) {
      const [, date, invNo, amount, openAmt, patient] = m;
      rows.push(
        makeRow({
          invoiceDate: date ?? null,
          invoiceNumber: invNo ?? null,
          jobReference: stmtNo ? `STMT-${stmtNo}` : null,
          patientName: patient ? toTitleCase(patient.trim()) : null,
          laboratoryName: lab,
          invoicedAmount: cleanAmount(amount ?? null),
          paymentsMade: null,
          balance: cleanAmount(openAmt ?? null),
        }),
      );
    }

    if (rows.length > 0) {
      rows.push(
        makeRow(
          {
            invoiceDate: stmtDate,
            invoiceNumber: stmtNo ? `STMT-${stmtNo}` : 'STATEMENT TOTAL',
            jobReference: null,
            patientName: `(${rows.length} invoices)`,
            laboratoryName: lab,
            invoicedAmount: null,
            paymentsMade: null,
            balance: totalDue,
          },
          { jobReference: 'low', invoicedAmount: 'low', paymentsMade: 'low' },
        ),
      );
    }
    return rows;
  },
};

registerParser(carlKearneyParser);
export {};
