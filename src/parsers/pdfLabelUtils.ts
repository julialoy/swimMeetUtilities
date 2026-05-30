import type { TextItem } from 'pdfjs-dist/types/src/display/api';

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
