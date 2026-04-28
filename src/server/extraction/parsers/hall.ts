/**
 * Hall Dental Studio statement parser.
 *
 * Format: "24/02/26 T61947 - INV68272 U BUKSH 3900.00 3078.50"
 *         date      job    -  invoice  patient  origAmt  balance
 *
 * Direct port of parse_hall() in extract_invoice.py.
 */
import { cleanAmount, toTitleCase } from '../helpers';
import { makeRow } from '../confidence';
import { registerParser } from '../parser';
import type { LabParser } from '../parser';
import type { ExtractedInvoiceRow, PdfExtractionContext } from '../types';

const LINE_PATTERN =
  /(\d{2}\/\d{2}\/\d{2})\s+(T\d+)\s+-\s+(INV\d+)\s+([A-Z][A-Z\s]+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/g;

const hallParser: LabParser = {
  format: 'hall',
  parse(ctx: PdfExtractionContext, lab: string | null): ExtractedInvoiceRow[] {
    const text = ctx.text;
    const stmtDate = text.match(/Unpaid items up to[:\s]+(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? null;
    const totalDue = cleanAmount(text.match(/AMOUNT\s+DUE[:\s]+[£$]?([\d,]+\.?\d*)/i)?.[1] ?? null);

    const rows: ExtractedInvoiceRow[] = [];
    for (const m of text.matchAll(LINE_PATTERN)) {
      const [, date, job, inv, patient, orig, balance] = m;
      rows.push(
        makeRow({
          invoiceDate: date ?? null,
          invoiceNumber: inv ?? null,
          jobReference: job ?? null,
          patientName: patient ? toTitleCase(patient.trim()) : null,
          laboratoryName: lab,
          invoicedAmount: cleanAmount(orig ?? null),
          paymentsMade: null,
          balance: cleanAmount(balance ?? null),
        }),
      );
    }

    if (rows.length > 0) {
      rows.push(
        makeRow(
          {
            invoiceDate: stmtDate,
            invoiceNumber: 'STATEMENT TOTAL',
            jobReference: null,
            patientName: `(${rows.length} invoices)`,
            laboratoryName: lab,
            invoicedAmount: null,
            paymentsMade: null,
            balance: totalDue,
          },
          { jobReference: 'low', patientName: 'high', invoicedAmount: 'low', paymentsMade: 'low' },
        ),
      );
    }
    return rows;
  },
};

registerParser(hallParser);
export {};
