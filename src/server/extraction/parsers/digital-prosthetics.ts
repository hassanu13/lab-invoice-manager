/**
 * Digital Prosthetics monthly statement.
 *
 * Table columns: Date | Type | Provider | Patient | Amount | Balance
 *   - Invoice rows have type "Invoice INVxxxxx".
 *   - Payment rows have type "Payment" with negative amount.
 *
 * Direct port of parse_digitalprothetics() in extract_invoice.py.
 * (Yes, the Python file misspells "prothetics"; we keep the format key
 * matching it exactly so detectFormat continues to dispatch correctly.)
 */
import { cleanAmount, toTitleCase } from '../helpers';
import { makeRow } from '../confidence';
import { registerParser } from '../parser';
import type { LabParser } from '../parser';
import type { ExtractedInvoiceRow, PdfExtractionContext } from '../types';

const digitalProstheticsParser: LabParser = {
  format: 'digitalprothetics',
  parse(ctx: PdfExtractionContext, lab: string | null): ExtractedInvoiceRow[] {
    const text = ctx.text;
    const stmtDate = text.match(/Statement\s+Date\s+(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? null;
    const totalDue = cleanAmount(text.match(/Total\s+Due\s+([\d,]+\.?\d*)/i)?.[1] ?? null);

    let paymentTotal: number | null = null;
    const rows: ExtractedInvoiceRow[] = [];

    for (const table of ctx.tables) {
      if (!table.length) continue;
      const header = (table[0] ?? []).map((c) => (c ?? '').toLowerCase().trim());
      const headerJoined = header.join(' ');
      if (!headerJoined.includes('type') && !headerJoined.includes('invoice')) continue;

      const col: {
        date?: number;
        type?: number;
        provider?: number;
        patient?: number;
        amount?: number;
        balance?: number;
      } = {};
      header.forEach((h, i) => {
        if (h === 'date') col.date = i;
        else if (h === 'type') col.type = i;
        else if (h.includes('provider')) col.provider = i;
        else if (h.includes('patient')) col.patient = i;
        else if (h.includes('amount')) col.amount = i;
        else if (h.includes('balance')) col.balance = i;
      });

      for (const row of table.slice(1)) {
        if (!row || row.every((c) => c === null || String(c).trim() === '')) continue;
        const typeVal = String(row[col.type ?? 1] ?? '').trim();
        const invMatch = typeVal.match(/Invoice\s+(INV\d+)/i);
        if (invMatch) {
          const invNo = invMatch[1] ?? null;
          const date =
            (col.date !== undefined ? String(row[col.date] ?? '') : '').trim() || stmtDate;
          const patientRaw = String(row[col.patient ?? 3] ?? '').trim();
          const patient = patientRaw ? toTitleCase(patientRaw) : null;
          const amount = col.amount !== undefined ? cleanAmount(row[col.amount] ?? null) : null;
          const balance = col.balance !== undefined ? cleanAmount(row[col.balance] ?? null) : null;
          rows.push(
            makeRow({
              invoiceDate: date,
              invoiceNumber: invNo,
              jobReference: null,
              patientName: patient,
              laboratoryName: lab,
              invoicedAmount: amount,
              paymentsMade: null,
              balance,
            }),
          );
        } else if (typeVal.toLowerCase().includes('payment')) {
          const amt = col.amount !== undefined ? (row[col.amount] ?? null) : null;
          if (amt !== null) {
            paymentTotal = cleanAmount(String(amt).replace(/-/g, ''));
          }
        }
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
            invoicedAmount: null,
            paymentsMade: paymentTotal,
            balance: totalDue,
          },
          { jobReference: 'low', invoicedAmount: 'low' },
        ),
      );
    }
    return rows;
  },
};

registerParser(digitalProstheticsParser);
export {};
