/**
 * Confidence helpers. Each parser tags its output rows with per-field
 * confidence so the Week 3 confirmation screen can highlight wobbly fields.
 *
 * Convention used by the parsers:
 *   - Field came from a strong, lab-specific regex anchor → 'high'
 *   - Field came from a generic regex / single-line table cell → 'medium'
 *   - Field is a heuristic guess or fallback only → 'low'
 *   - Field wasn't found → null value, confidence 'low'
 */
import type {
  ConfidenceLevel,
  ExtractionConfidence,
  ExtractedInvoiceRow,
} from './types';

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Build an all-`high` confidence object — caller overrides per field. */
export function highConfidence(): ExtractionConfidence {
  return {
    invoiceDate: 'high',
    invoiceNumber: 'high',
    jobReference: 'high',
    patientName: 'high',
    laboratoryName: 'high',
    invoicedAmount: 'high',
    paymentsMade: 'high',
    balance: 'high',
    overall: 'high',
  };
}

/** Build an all-`low` confidence object — sensible default for parseStandard. */
export function lowConfidence(): ExtractionConfidence {
  return {
    invoiceDate: 'low',
    invoiceNumber: 'low',
    jobReference: 'low',
    patientName: 'low',
    laboratoryName: 'low',
    invoicedAmount: 'low',
    paymentsMade: 'low',
    balance: 'low',
    overall: 'low',
  };
}

/** Compute the overall confidence as the minimum of the per-field levels. */
export function rollupConfidence(c: Omit<ExtractionConfidence, 'overall'>): ConfidenceLevel {
  const levels: ConfidenceLevel[] = [
    c.invoiceDate,
    c.invoiceNumber,
    c.jobReference,
    c.patientName,
    c.laboratoryName,
    c.invoicedAmount,
    c.paymentsMade,
    c.balance,
  ];
  // Skip 'low' for fields that aren't expected to be filled (jobReference is
  // legitimately null on many parsers). To keep this simple and honest, we
  // just take the lowest-ranked level present — the parser is responsible for
  // setting confidence sensibly.
  let lowest: ConfidenceLevel = 'high';
  let lowestRank = CONFIDENCE_RANK.high;
  for (const l of levels) {
    const r = CONFIDENCE_RANK[l];
    if (r < lowestRank) {
      lowestRank = r;
      lowest = l;
    }
  }
  return lowest;
}

/** Convenience: build a row with an all-high confidence baseline. */
export function makeRow(
  partial: Omit<ExtractedInvoiceRow, 'confidence'>,
  confidence?: Partial<Omit<ExtractionConfidence, 'overall'>>,
): ExtractedInvoiceRow {
  const full = { ...highConfidence(), ...confidence };
  return {
    ...partial,
    confidence: { ...full, overall: rollupConfidence(full) },
  };
}
