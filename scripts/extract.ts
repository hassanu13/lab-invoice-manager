#!/usr/bin/env tsx
/**
 * Ad-hoc CLI: run the extractor against a single PDF and print the result.
 *
 * Usage:
 *   npx tsx scripts/extract.ts samples/pdfs/Hall\ Dental\ Studio.pdf
 *
 * Useful for eyeballing extraction output during parser development. Does
 * not write to the database — purely a print-to-stdout debug tool.
 */
import { readFileSync, existsSync } from 'node:fs';
import { extractInvoice } from '../src/server/extraction/extract';

async function main() {
  const path = process.argv[2];
  if (!path || !existsSync(path)) {
    console.error('Usage: npx tsx scripts/extract.ts <path-to-pdf>');
    process.exit(1);
  }
  const buf = readFileSync(path);
  const result = await extractInvoice(buf, path);
  console.log('Lab:', result.detectedLab);
  console.log('Format:', result.detectedFormat);
  console.log('Parser used:', result.parserUsed);
  console.log('Rows:', result.rows.length);
  console.log();
  for (const r of result.rows) {
    console.log(JSON.stringify(r, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
