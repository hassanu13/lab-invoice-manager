/**
 * Dent8 + Innovate Dental portal statements.
 *
 * Both labs use the same portal export. Per-line format:
 *   date  INV-XXXXXX-X-X  Patient Name  due_date  £amount  £payments  £balance
 *
 * Direct port of parse_dent8_innovate() in extract_invoice.py.
 */
import { cleanAmount, toTitleCase } from '../helpers';
import { makeRow } from '../confidence';
import { registerParser } from '../parser';
import type { LabParser } from '../parser';
import type { ExtractedInvoiceRow, PdfExtractionContext } from '../types';

const LINE_PATTERN =
  /(\d{2}\/\d{2}\/\d{4})\s+(INV-[A-Z0-9-]+)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+[£$]([\d,]+\.\d{2})\s+[£$]([\d,]+\.\d{2})\s+[£$]([\d,]+\.\d{2})/g;

const dent8InnovateParser: LabParser = {
  format: 'dent8_innovate',
  parse(ctx: PdfExtractionContext, lab: string | null): ExtractedInvoiceRow[] {
    const text = ctx.text;
    const stmtDate = text.match(/Date\s+(\d{2}\/\d{2}\/\d{4})/)?.[1] ?? null;
    const totalDue = cleanAmount(
      text.match(/Total\s+Amount\s+Due\s+[£$]?([\d,]+\.?\d*)/i)?.[1] ?? null,
    );

    // Resolve lab if upstream detection didn't manage it (shared portal,
    // need to look at city/lab-specific markers).
    let resolvedLab = lab;
    if (!resolvedLab) {
      const lower = text.toLowerCase();
      if (
        lower.includes('dent8') ||
        lower.includes('blackpool') ||
        lower.includes('garton')
      ) {
        resolvedLab = 'Dent8';
      } else if (
        lower.includes('innovate') ||
        lower.includes('oldham') ||
        lower.includes('langdale')
      ) {
        resolvedLab = 'Innovate Dental';
      } else if (/INV-D\d+/.test(text)) {
        resolvedLab = 'Dent8';
      } else if (/INV-IN\d+/.test(text)) {
        resolvedLab = 'Innovate Dental';
      }
    }

    const rows: ExtractedInvoiceRow[] = [];
    for (const m of text.matchAll(LINE_PATTERN)) {
      const [, date, invNo, patient, , amount, payments, balance] = m;
      rows.push(
        makeRow({
          invoiceDate: date ?? null,
          invoiceNumber: invNo ?? null,
          jobReference: null,
          patientName: patient ? toTitleCase(patient.trim()) : null,
          laboratoryName: resolvedLab,
          invoicedAmount: cleanAmount(amount ?? null),
          paymentsMade: cleanAmount(payments ?? null),
          balance: cleanAmount(balance ?? null),
        }),
      );
    }

    if (rows.length > 0 && totalDue !== null) {
      rows.push(
        makeRow(
          {
            invoiceDate: stmtDate,
            invoiceNumber: 'STATEMENT TOTAL',
            jobReference: null,
            patientName: `(${rows.length} invoices)`,
            laboratoryName: resolvedLab,
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

registerParser(dent8InnovateParser);
export {};
