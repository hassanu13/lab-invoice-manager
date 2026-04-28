/**
 * S4S statement parser.
 *
 * Uses the structured table:
 *   Date | Type | Method | Ref | Details | Credit | Original Total | Unapplied Credit | Amount Outstanding | Total
 * "Advice" rows are invoices; "Payment" rows accumulate into payment_total.
 *
 * Direct port of parse_s4s() in extract_invoice.py.
 */
import { cleanAmount, toTitleCase } from '../helpers';
import { makeRow } from '../confidence';
import { registerParser } from '../parser';
import type { LabParser } from '../parser';
import type { ExtractedInvoiceRow, PdfExtractionContext } from '../types';

const s4sParser: LabParser = {
  format: 's4s',
  parse(ctx: PdfExtractionContext, lab: string | null): ExtractedInvoiceRow[] {
    const text = ctx.text;
    const stmtDate = text.match(/Date[:\s]+(\d{2}\s+\w+\s+\d{4})/i)?.[1] ?? null;
    const refNo = text.match(/Reference\s+No[:\s]+(\d+)/i)?.[1] ?? null;
    const balanceDue = cleanAmount(
      text.match(/Balance\s+Due\s+[£$]?\s*([\d,]+\.?\d*)/i)?.[1] ?? null,
    );

    let paymentTotal = 0;
    const rows: ExtractedInvoiceRow[] = [];

    for (const table of ctx.tables) {
      if (!table || table.length < 2) continue;
      const header = (table[0] ?? []).map((c) => (c ?? '').toLowerCase().replace(/\n/g, ' ').trim());
      const headerJoined = header.join(' ');
      if (!headerJoined.includes('type') || !headerJoined.includes('details')) continue;

      const col: {
        date?: number;
        type?: number;
        ref?: number;
        details?: number;
        credit?: number;
        orig?: number;
      } = {};
      header.forEach((h, i) => {
        if (h === 'date') col.date = i;
        else if (h === 'type') col.type = i;
        else if (h === 'ref') col.ref = i;
        else if (h === 'details') col.details = i;
        else if (h.includes('credit') && !h.includes('unapplied') && !h.includes('original')) col.credit = i;
        else if (h.includes('original')) col.orig = i;
      });

      for (const row of table.slice(1)) {
        if (!row || row.every((c) => c === null || String(c).trim() === '')) continue;
        const typeVal = String(row[col.type ?? 1] ?? '').trim().toLowerCase();
        const details = String(row[col.details ?? 4] ?? '').trim();
        const date = String(row[col.date ?? 0] ?? '').trim();
        const ref = String(row[col.ref ?? 3] ?? '').trim();
        const orig = col.orig !== undefined ? cleanAmount(row[col.orig] ?? null) : null;
        const credit = col.credit !== undefined ? cleanAmount(row[col.credit] ?? null) : null;

        if (typeVal === 'advice') {
          // Patient name: "Smith, J (CODE123)" → "Smith, J"
          const patientMatch = details.match(/(.+?)\s*\([\w\d]+\)/);
          const patient = patientMatch?.[1]?.trim() ?? details;
          rows.push(
            makeRow({
              invoiceDate: date || stmtDate,
              invoiceNumber: ref || null,
              jobReference: refNo,
              patientName: patient ? toTitleCase(patient) : null,
              laboratoryName: lab,
              invoicedAmount: orig ?? credit,
              paymentsMade: null,
              balance: null,
            }),
          );
        } else if (typeVal === 'payment' && credit !== null) {
          paymentTotal = Math.round((paymentTotal + credit) * 100) / 100;
        }
      }
    }

    if (rows.length > 0) {
      rows.push(
        makeRow(
          {
            invoiceDate: stmtDate,
            invoiceNumber: 'STATEMENT TOTAL',
            jobReference: refNo,
            patientName: `(${rows.length} items)`,
            laboratoryName: lab,
            invoicedAmount: null,
            paymentsMade: paymentTotal > 0 ? paymentTotal : null,
            balance: balanceDue,
          },
          { invoicedAmount: 'low' },
        ),
      );
    }
    return rows;
  },
};

registerParser(s4sParser);
export {};
