import * as pdfjsLib from 'pdfjs-dist';
import type { AwardLabel, AwardLabelsResult } from '../types';
import { isTextItem, toPhysicalLines, toBlocks, type RawItem } from './pdfLabelUtils';
import { parseLabelLines } from './awardLabelLineParser';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

// ── Label block detection ────────────────────────────────────────────────────

/** The first line of every award label matches this pattern. */
const PLACE_LINE_RE = /\b\w+\s+Place\s+Time:/i;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Parses a swim meet award labels PDF formatted for Avery 8160 labels
 * (3 columns × 10 rows per US letter page).
 *
 * The parser re-derives reading order from each text item's x/y position,
 * so it is robust to the order in which pdf.js returns items from the PDF
 * content stream. Each label's 5 lines are extracted per column, then
 * parsed into structured AwardLabel objects.
 *
 * @param file - The PDF file selected or dropped by the user.
 */
export async function parseAwardLabelsPdf(file: File): Promise<AwardLabelsResult> {
  const errors: string[] = [];
  const labels: AwardLabel[] = [];

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
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const rawItems: RawItem[] = content.items
        .filter(isTextItem)
        .map(item => ({
          str: item.str,
          x:   item.transform[4] as number,
          y:   item.transform[5] as number,
        }));

      const physicalLines = toPhysicalLines(rawItems);
      const blocks = toBlocks(physicalLines, col => PLACE_LINE_RE.test(col));

      for (const block of blocks) {
        for (const col of [0, 1, 2] as const) {
          const colLines = block.map(line => line[col]);
          // Skip columns that are entirely empty (e.g. last row has < 3 labels)
          if (colLines.every(l => !l)) continue;

          const label = parseLabelLines(colLines);
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
