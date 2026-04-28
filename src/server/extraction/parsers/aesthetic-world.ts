/**
 * Aesthetic World statement parser.
 *
 * Quirk: invoice numbers like "INV-AW30282-W-\n1" wrap across lines and
 * need normalising back to "INV-AW30282-W-1" before pattern matching.
 *
 * Direct port of parse_aestheticworld() in extract_invoice.py.
 */
import { cleanAmount, toTitleCase } from '../helpers';
import { makeRow } from '../confidence';
import { registerParser } from '../parser';
import type { LabParser } from '../parser';
import type { ExtractedInvoiceRow, PdfExtractionContext } from '../types';

const PRIMARY =
  /(\d{2}\/\d{2}\/\d{4})\s+(INV-[\w-]+)\s+([A-Z][A-Z\s]{2,40}?)\s{2,}.+?\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/gi;

const FALLBACK = /(\d{2}\/\d{2}\/\d{4})\s+(INV-[\w-]+)\s+(.+?)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$/gm;

const aestheticWorldParser: LabParser = {
  format: 'aestheticworld',
  parse(ctx: PdfExtractionContext, lab: string | null): ExtractedInvoiceRow[] {
    const stmtDate = ctx.text.match(/Date\s+(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? null;
    const totalDue = cleanAmount(
      ctx.text.match(/Total\s+Due\s+[£$\s]*([\d,]+\.\d{2})/i)?.[1] ?? null,
    );

    // Normalise wrap: "INV-AW30282-W-\n1" -> "INV-AW30282-W-1"
    const normalised = ctx.text.replace(/(INV-[\w-]+)-\s*\n(\d+)/g, '$1-$2');

    const rows: ExtractedInvoiceRow[] = [];
    for (const m of normalised.matchAll(PRIMARY)) {
      const [, date, invNo, patient, , , gross] = m;
      rows.push(
        makeRow({
          invoiceDate: date ?? null,
          invoiceNumber: invNo?.trim() ?? null,
          jobReference: null,
          patientName: patient ? toTitleCase(patient.trim()) : null,
          laboratoryName: lab,
          invoicedAmount: cleanAmount(gross ?? null),
          paymentsMade: null,
          balance: cleanAmount(gross ?? null),
        }),
      );
    }

    // Fallback: if primary didn't catch any, try the looser pattern.
    if (rows.length === 0) {
      for (const m of normalised.matchAll(FALLBACK)) {
        const [, date, invNo, rest, , , gross] = m;
        const patientMatch = (rest ?? '').match(/^([A-Z][A-Z\s]+?)(?:\s{2,}|\d)/);
        const patient = patientMatch?.[1]?.trim() ?? rest?.trim() ?? '';
        rows.push(
          makeRow(
            {
              invoiceDate: date ?? null,
              invoiceNumber: invNo?.trim() ?? null,
              jobReference: null,
              patientName: patient ? toTitleCase(patient) : null,
              laboratoryName: lab,
              invoicedAmount: cleanAmount(gross ?? null),
              paymentsMade: null,
              balance: cleanAmount(gross ?? null),
            },
            { patientName: 'medium' },
          ),
        );
      }
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
            invoicedAmount: totalDue,
            paymentsMade: null,
            balance: totalDue,
          },
          { jobReference: 'low', paymentsMade: 'low' },
        ),
      );
    }
    return rows;
  },
};

registerParser(aestheticWorldParser);
export {};
