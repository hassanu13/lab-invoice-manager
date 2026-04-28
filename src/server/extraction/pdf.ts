/**
 * PDF reader — text + reconstructed tables, using pdfjs-dist.
 *
 * pdfplumber (the Python library) gives us text plus extracted tables for
 * free. pdfjs-dist gives us only individual text items with x/y coordinates.
 * We have to reconstruct rows and columns ourselves.
 *
 * Approach
 * --------
 * For each page:
 *   1. Pull every text item with its transform matrix → (x, y, str, width).
 *   2. Sort by descending y (PDF coordinates origin is bottom-left).
 *   3. Group items into "lines" by y-bucket (within ROW_TOL of each other).
 *   4. Within each line, sort by x and join with a space.
 *      This gives us the text content (mirrors pdfplumber's text output).
 *   5. For table reconstruction, find the page's column anchors:
 *        - cluster the x-coordinates of all items
 *        - any x within COL_TOL of an existing cluster joins it
 *      Then, for each line, snap each item to its nearest column anchor.
 *      Lines with ≥2 items in distinct columns become candidate table rows.
 *      Consecutive candidate rows form a table.
 *
 * Limitations: this is good enough for the structured statements we deal with
 * (Digital Prosthetics, S4S, 3 Dental). It's not as smart as pdfplumber for
 * pixel-perfect cell detection, but the format-specific parsers are robust
 * to slight column-merge oddities — if `parser.parse()` finds nothing in the
 * tables, it falls back to text regex.
 */
import type { PdfExtractionContext } from './types';

// pdfjs ships separate "legacy" build for Node — that's the one we use.
// The .mjs build does proper ESM and works under Next 16 / Node 20+.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Tolerances tuned for typical 12pt text in lab invoices.
// Y-coordinates within this many points are considered the same row.
const ROW_TOL = 3;
// X-coordinates within this many points snap to the same column.
const COL_TOL = 5;

interface TextItem {
  x: number;
  y: number;
  str: string;
  width: number;
}

export async function extractPdfTextAndTables(
  pdf: Buffer | Uint8Array,
): Promise<PdfExtractionContext> {
  // pdfjs wants a plain Uint8Array; Buffer satisfies that interface but
  // copying via .from(pdf) avoids any Buffer-vs-ArrayBuffer surprises.
  const data = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);

  const loadingTask = pdfjsLib.getDocument({
    data,
    // Suppress font/cmap warnings — we only need text positions, not glyphs.
    disableFontFace: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;

  const pageTexts: string[] = [];
  const tables: (string | null)[][][] = [];

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();

      const items: TextItem[] = [];
      for (const it of content.items as Array<{
        str: string;
        transform: number[];
        width: number;
      }>) {
        if (!it.str || it.str === '') continue;
        // transform = [a, b, c, d, e, f] — e is x, f is y in PDF user space.
        const x = it.transform[4] ?? 0;
        const y = it.transform[5] ?? 0;
        items.push({ x, y, str: it.str, width: it.width ?? 0 });
      }
      if (items.length === 0) {
        pageTexts.push('');
        continue;
      }

      // ── Group items into rows by y ────────────────────────────────
      // Sort high-to-low (top-to-bottom on the page).
      items.sort((a, b) => b.y - a.y);
      const rows: TextItem[][] = [];
      for (const it of items) {
        const lastRow = rows[rows.length - 1];
        if (lastRow && Math.abs((lastRow[0]?.y ?? 0) - it.y) <= ROW_TOL) {
          lastRow.push(it);
        } else {
          rows.push([it]);
        }
      }
      // Within each row, sort by x ascending (left-to-right).
      for (const row of rows) row.sort((a, b) => a.x - b.x);

      // ── Plain text per page ───────────────────────────────────────
      const lineStrings = rows.map((row) => row.map((it) => it.str).join(' '));
      pageTexts.push(lineStrings.join('\n'));

      // ── Reconstruct columns ───────────────────────────────────────
      const columnAnchors = clusterColumnAnchors(items);

      if (columnAnchors.length >= 2) {
        const tableRows: (string | null)[][] = [];
        for (const row of rows) {
          // Group by nearest column anchor.
          const cells: string[][] = columnAnchors.map(() => []);
          for (const it of row) {
            const idx = nearestColumnIndex(it.x, columnAnchors);
            cells[idx]?.push(it.str);
          }
          const rowCells = cells.map((c) =>
            c.length === 0 ? null : c.join(' ').trim() || null,
          );
          // Only keep rows with ≥2 non-null columns — single-cell rows are
          // headers/footnotes and would pollute the table.
          if (rowCells.filter((c) => c).length >= 2) {
            tableRows.push(rowCells);
          }
        }
        if (tableRows.length >= 2) tables.push(tableRows);
      }
    }
  } finally {
    // pdfjs holds onto worker resources; release them.
    await doc.destroy();
  }

  return {
    text: pageTexts.join('\n'),
    tables,
    pageTexts,
  };
}

/**
 * Cluster the x-coordinates of all text items into "column anchors".
 * Two items whose x are within COL_TOL of each other share a column.
 * Returns the anchors sorted left-to-right.
 */
function clusterColumnAnchors(items: TextItem[]): number[] {
  const xs = items.map((it) => it.x).sort((a, b) => a - b);
  const anchors: number[] = [];
  for (const x of xs) {
    const last = anchors[anchors.length - 1];
    if (last === undefined || x - last > COL_TOL) {
      anchors.push(x);
    }
    // else: x joins the existing rightmost cluster; we don't recompute the
    // anchor as a mean, because anchors are stable enough at the leftmost x.
  }
  return anchors;
}

function nearestColumnIndex(x: number, anchors: number[]): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i] ?? 0;
    const d = Math.abs(a - x);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}
