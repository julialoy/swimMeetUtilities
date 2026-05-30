import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

// ── Shared constants ──────────────────────────────────────────────────────────

/** x-coordinate boundaries (PDF points) separating the 3 label columns on a
 *  US letter page (612 pts wide). Splits the page into thirds. */
export const COL_X_BOUNDARIES = [204, 408] as const;

/** Items whose y-coordinates are within this many points are on the same line. */
export const Y_TOLERANCE = 3;

// ── Shared types ──────────────────────────────────────────────────────────────

export interface RawItem { str: string; x: number; y: number; }

/** One physical text line: text bucketed into [col0, col1, col2]. */
export type PhysicalLine = [string, string, string];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isTextItem(item: unknown): item is TextItem {
  return typeof item === 'object' && item !== null && 'str' in item;
}

export function getColumn(x: number): 0 | 1 | 2 {
  if (x < COL_X_BOUNDARIES[0]) return 0;
  if (x < COL_X_BOUNDARIES[1]) return 1;
  return 2;
}

/**
 * Groups raw text items into physical lines sorted top-to-bottom.
 * Within each line, items are split into 3 column buckets and concatenated
 * in left-to-right order.
 *
 * PDF y-coordinates are bottom-relative, so sorting by y descending gives
 * top-to-bottom reading order.
 */
export function toPhysicalLines(items: RawItem[]): PhysicalLine[] {
  const sorted = [...items]
    .filter(i => i.str.trim())
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const groups: Array<{ y: number; byCol: [string[], string[], string[]] }> = [];

  for (const item of sorted) {
    const existing = groups.find(g => Math.abs(g.y - item.y) <= Y_TOLERANCE);
    if (existing) {
      existing.byCol[getColumn(item.x)].push(item.str);
    } else {
      const byCol: [string[], string[], string[]] = [[], [], []];
      byCol[getColumn(item.x)].push(item.str);
      groups.push({ y: item.y, byCol });
    }
  }

  return groups.map(g => [
    g.byCol[0].join(' ').trim(),
    g.byCol[1].join(' ').trim(),
    g.byCol[2].join(' ').trim(),
  ]);
}

/**
 * Splits physical lines into label-row blocks. A new block begins whenever
 * any column on a line satisfies `isBoundary`.
 */
export function toBlocks(lines: PhysicalLine[], isBoundary: (col: string) => boolean): PhysicalLine[][] {
  const blocks: PhysicalLine[][] = [];
  let current: PhysicalLine[] | null = null;

  for (const line of lines) {
    if (line.some(isBoundary)) {
      if (current) blocks.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }

  if (current) blocks.push(current);
  return blocks;
}

// ── Generic label PDF parser ──────────────────────────────────────────────────

/**
 * Shared parsing pipeline for Avery 8160 label PDFs (3 columns × 10 rows).
 *
 * Runs a single pdfjs-dist pass over the file, reconstructs column layout via
 * x/y position data, splits into label blocks, and calls `parseLines` on each
 * column's 5-line slice to produce a typed label.
 *
 * @param file        - The PDF file to parse.
 * @param isBoundary  - Returns true for the first line of each label block.
 * @param parseLines  - Converts a 5-element string array into a label or null.
 */
export async function parseLabelsPdf<T>(
  file: File,
  isBoundary: (col: string) => boolean,
  parseLines: (lines: string[]) => T | null,
): Promise<{ labels: T[]; errors: string[] }> {
  const errors: string[] = [];
  const labels: T[] = [];

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    return { labels: [], errors: ['Failed to read file'] };
  }

  let pdf: pdfjsLib.PDFDocumentProxy;
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (err) {
    return { labels: [], errors: [err instanceof Error ? err.message : 'Failed to load PDF'] };
  }

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    try {
      const page    = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const rawItems: RawItem[] = content.items
        .filter(isTextItem)
        .map(item => ({
          str: item.str,
          x:   item.transform[4] as number,
          y:   item.transform[5] as number,
        }));

      const physicalLines = toPhysicalLines(rawItems);
      const blocks        = toBlocks(physicalLines, isBoundary);

      for (const block of blocks) {
        for (const col of [0, 1, 2] as const) {
          const colLines = block.map(line => line[col]);
          if (colLines.every(l => !l)) continue;

          const label = parseLines(colLines);
          if (label) {
            labels.push(label);
          } else {
            errors.push(
              `Page ${pageNum}, col ${col + 1}: could not parse label: "${colLines.slice(0, 2).join(' | ')}"`
            );
          }
        }
      }
    } catch (err) {
      errors.push(`Page ${pageNum}: ${err instanceof Error ? err.message : 'Parse error'}`);
    }
  }

  return { labels, errors };
}
