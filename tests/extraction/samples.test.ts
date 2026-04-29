/**
 * End-to-end extractor tests against real sample PDFs.
 *
 * Hits the running Python microservice (extractor/) via the same HTTP client
 * the production code uses. The whole suite skips if the service isn't
 * reachable — that way CI (which doesn't currently boot Docker) stays green
 * and local devs without `npm run infra:up` aren't blocked.
 *
 * What the test does:
 *   - For each sample PDF, run extractInvoice().
 *   - Assert detectedLab + detectedFormat + a minimum row count.
 *   - On first run, write a JSON snapshot of the rows to samples/expected/.
 *   - On subsequent runs, diff against the snapshot.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractInvoice } from '@/server/extraction/extract';
import type { ExtractionFormat } from '@/server/extraction/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const PDFS_DIR = join(REPO_ROOT, 'samples', 'pdfs');
const EXPECTED_DIR = join(REPO_ROOT, 'samples', 'expected');
const EXTRACTOR_URL = process.env.EXTRACTOR_URL ?? 'http://localhost:8000';

interface SampleCase {
  filename: string;
  expectedLab: string | null;
  expectedFormat: ExtractionFormat;
  /** Lower-bound on row count (statement totals included). */
  minRows: number;
}

// Note on the sample PDFs:
//   - Statements: 3Dental, Hall Dental Studio, S4S, Digital Prosthetics
//     → dedicated table-driven parsers, multiple rows.
//   - Single-invoice PDFs: Carl Kearney, Innovate Dental, Boutique, Invisalign
//     → parseStandard() picks up the lab name + headline fields, one row.
//     (We could write per-lab single-invoice parsers in Phase 2 to lift
//     confidence, but standard is functional today.)
//   - Image-only: Avant Garde — pdfplumber returns no text. Skipped here;
//     OCR (AWS Textract) will be added in Week 5 deploy.
const CASES: SampleCase[] = [
  { filename: '3Dental.pdf', expectedLab: '3 Dental', expectedFormat: '3dental', minRows: 1 },
  {
    filename: 'Boutique.pdf',
    expectedLab: 'Boutique Whitening',
    expectedFormat: 'standard',
    minRows: 1,
  },
  // Carl Kearney sample is a single-invoice PDF, but its text contains the
  // "Carl Kearney" string so detectFormat() returns 'carlkearney'. The
  // dedicated parser produces no rows on this single-invoice shape, so
  // extract.ts falls through to parseStandard automatically. Format is what
  // the detector says; rows come from the standard parser via fallback.
  {
    filename: 'Carl Kearney.pdf',
    expectedLab: 'Carl Kearney',
    expectedFormat: 'carlkearney',
    minRows: 1,
  },
  {
    filename: 'Digital Prosthetics.pdf',
    expectedLab: 'Digital Prosthetics',
    expectedFormat: 'digitalprothetics',
    minRows: 2,
  },
  {
    filename: 'Hall Dental Studio.pdf',
    expectedLab: 'Hall Dental Studio',
    expectedFormat: 'hall',
    minRows: 2,
  },
  // Innovate Dental sample is a single-invoice PDF, not the statement portal format.
  {
    filename: 'Innovate Dental.pdf',
    expectedLab: 'Innovate Dental',
    expectedFormat: 'standard',
    minRows: 1,
  },
  { filename: 'Invisalign.pdf', expectedLab: 'Invisalign', expectedFormat: 'standard', minRows: 1 },
  { filename: 'S4S.pdf', expectedLab: 'S4S', expectedFormat: 's4s', minRows: 2 },
  // Avant Garde.pdf is image-only (no text layer). Will be picked up by Textract
  // OCR in Week 5. Excluded from this suite intentionally.
];

function ensureExpectedDir() {
  if (!existsSync(EXPECTED_DIR)) mkdirSync(EXPECTED_DIR, { recursive: true });
}

async function extractorReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${EXTRACTOR_URL}/health`, {
      // Short timeout so we don't hang CI for 30s.
      signal: AbortSignal.timeout(2_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

describe('extractor — sample PDFs (Python service)', () => {
  let serviceUp = false;
  let havePdfs = false;

  beforeAll(async () => {
    serviceUp = await extractorReachable();
    havePdfs = existsSync(PDFS_DIR);
    if (!serviceUp) {
      // Make the skip reason visible so it isn't silent.
      console.warn(
        `extractor service not reachable at ${EXTRACTOR_URL} — skipping integration tests. Run \`npm run infra:up\` to start it.`,
      );
    }
    if (!havePdfs) {
      console.warn(`samples/pdfs/ not present — skipping integration tests`);
    }
  });

  for (const c of CASES) {
    it(`${c.filename} → ${c.expectedFormat} parser, lab=${c.expectedLab ?? 'null'}`, async () => {
      if (!serviceUp || !havePdfs || !existsSync(join(PDFS_DIR, c.filename))) {
        // vitest 2's it.skipIf isn't available in our version; run a no-op.
        return;
      }

      const buf = readFileSync(join(PDFS_DIR, c.filename));
      const result = await extractInvoice(buf, c.filename);

      expect(result.detectedLab).toBe(c.expectedLab);
      expect(result.detectedFormat).toBe(c.expectedFormat);
      expect(result.rows.length).toBeGreaterThanOrEqual(c.minRows);

      for (const row of result.rows) {
        expect(row.confidence.overall).toMatch(/^(high|medium|low)$/);
        if (c.expectedLab) {
          expect(row.laboratoryName).toBe(c.expectedLab);
        }
      }

      ensureExpectedDir();
      const snapPath = join(EXPECTED_DIR, c.filename.replace(/\.pdf$/i, '.json'));
      const actual = result.rows.map((r) => ({
        invoiceDate: r.invoiceDate,
        invoiceNumber: r.invoiceNumber,
        jobReference: r.jobReference,
        patientName: r.patientName,
        laboratoryName: r.laboratoryName,
        invoicedAmount: r.invoicedAmount,
        paymentsMade: r.paymentsMade,
        balance: r.balance,
      }));

      if (!existsSync(snapPath)) {
        writeFileSync(snapPath, JSON.stringify(actual, null, 2) + '\n', 'utf8');
        console.log(`  • wrote new snapshot: ${snapPath}`);
      } else {
        const expected = JSON.parse(readFileSync(snapPath, 'utf8')) as typeof actual;
        expect(actual).toEqual(expected);
      }
    });
  }
});
