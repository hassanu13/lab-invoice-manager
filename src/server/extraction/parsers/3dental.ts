/**
 * 3 Dental summary statement.
 *
 * Has a real table (OrderID / Patient / Date / Total). The same OrderID may
 * appear over multiple rows (one per item) — we sum the totals per OrderID.
 *
 * Direct port of parse_3dental() in extract_invoice.py.
 */
import { cleanAmount, toTitleCase } from '../helpers';
import { makeRow } from '../confidence';
import { registerParser } from '../parser';
import type { LabParser } from '../parser';
import type { ExtractedInvoiceRow, PdfExtractionContext } from '../types';

interface OrderAccumulator {
  patient: string;
  total: number;
}

const threeDentalParser: LabParser = {
  format: '3dental',
  parse(ctx: PdfExtractionContext, lab: string | null): ExtractedInvoiceRow[] {
    const text = ctx.text;
    const invoiceNumber = text.match(/summary\s*no[.\s:]*([A-Z0-9]+)/i)?.[1]?.trim() ?? null;

    let invoiceDate: string | null = null;
    for (const pat of [
      /PAYMENT\s+DUE\s+(\d{4}-\d{2}-\d{2})/i,
      /TO\s+(\d{4}-\d{2}-\d{2})/i,
      /FROM\s+(\d{4}-\d{2}-\d{2})/i,
    ]) {
      const m = text.match(pat);
      if (m && m[1]) {
        invoiceDate = m[1];
        break;
      }
    }

    const balance = cleanAmount(
      text.match(/BALANCE\s+DUE\s+[£$]?([\d,]+\.?\d*)/i)?.[1] ?? null,
    );
    const total = cleanAmount(text.match(/\bTOTAL\b\s+[£$]?([\d,]+\.?\d*)/i)?.[1] ?? null);

    const seenOrders = new Map<string, OrderAccumulator>();

    for (const table of ctx.tables) {
      if (!table.length) continue;
      const header = (table[0] ?? []).map((c) => (c ?? '').toLowerCase().trim());
      const headerJoined = header.join(' ');
      if (!headerJoined.includes('orderid')) continue;

      const col: { order?: number; patient?: number; total?: number } = {};
      header.forEach((h, i) => {
        if (h.includes('order')) col.order = i;
        else if (h.includes('patient')) col.patient = i;
        else if (h.includes('total')) col.total = i;
      });

      for (const row of table.slice(1)) {
        if (!row || row.every((c) => c === null)) continue;
        const oid = String(row[col.order ?? 0] ?? '').trim();
        const patient = String(row[col.patient ?? 1] ?? '').trim();
        const amount = cleanAmount(
          col.total !== undefined ? row[col.total] ?? null : null,
        );
        if (!oid || oid.toLowerCase() === 'orderid') continue;

        const existing = seenOrders.get(oid);
        if (!existing) {
          seenOrders.set(oid, { patient, total: amount ?? 0 });
        } else if (amount) {
          existing.total = Math.round((existing.total + amount) * 100) / 100;
        }
      }
    }

    const rows: ExtractedInvoiceRow[] = [];
    for (const [oid, info] of seenOrders) {
      rows.push(
        makeRow({
          invoiceDate,
          invoiceNumber,
          jobReference: oid,
          patientName: info.patient ? toTitleCase(info.patient) : null,
          laboratoryName: lab,
          invoicedAmount: info.total || null,
          paymentsMade: null,
          balance: null,
        }),
      );
    }

    if (rows.length > 0) {
      rows.push(
        makeRow(
          {
            invoiceDate,
            invoiceNumber,
            jobReference: 'SUMMARY TOTAL',
            patientName: `(${seenOrders.size} orders)`,
            laboratoryName: lab,
            invoicedAmount: total ?? balance,
            paymentsMade: null,
            balance,
          },
          { paymentsMade: 'low' },
        ),
      );
    }
    return rows;
  },
};

registerParser(threeDentalParser);
export {};
