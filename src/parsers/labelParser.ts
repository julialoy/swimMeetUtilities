import * as pdfjsLib from 'pdfjs-dist';
import { isTextItem, toPhysicalLines, toBlocks, type RawItem, type PhysicalLine } from './pdfLabelUtils';
import { parseLabelLines as parseAwardLines } from './awardLabelLineParser';
import { parseLabelLines as parseImprovLines } from './improvementLabelLineParser';
import type { Label } from '../types';

const AWARD_RE = /\b\w+\s+Place\s+Time:/i;
const IMPROV_RE = /^#\w+\s+/;

type LabelType = 'award' | 'improvement';

/**
 * Scans physical lines top-to-bottom for the first column that matches a known
 * label boundary, returning the label type. Returns null if no boundary is found
 * (e.g. a blank or unrecognised page).
 */
function detectType(lines: PhysicalLine[]): LabelType | null {
  for (const line of lines) {
    for (const col of line) {
      if (AWARD_RE.test(col))  return 'award';
      if (IMPROV_RE.test(col)) return 'improvement';
    }
  }
  return null;
}

/**
 * Parses one label block's three columns with the appropriate line parser.
 * Award labels: uses `parseAwardLines`.
 * Improvement labels: uses `parseImprovLines`.
 */
function parseBlock(
  block: PhysicalLine[],
  type: LabelType,
  pageNum: number,
  errors: string[],
): Label[] {
  const labels: Label[] = [];
  for (const col of [0, 1, 2] as const) {
    const colLines = block.map(line => line[col]);
    if (colLines.every(l => !l)) continue;

    const label = type === 'award' ? parseAwardLines(colLines) : parseImprovLines(colLines);
    if (label) {
      labels.push(label);
    } else {
      errors.push(
        `Page ${pageNum}, col ${col + 1}: could not parse label: "${colLines.slice(0, 2).join(' | ')}"`
      );
    }
  }
  return labels;
}

/**
 * Parses any Avery 8160 label PDF in a single pdfjs-dist pass.
 *
 * On the first page that contains labels, the type (award vs improvement) is
 * inferred from which boundary line appears first. That type is then used for
 * the remainder of the file. Using a single detected type — rather than a
 * combined boundary predicate — is necessary because award labels contain a
 * `#event` line as their *second* line, which would otherwise be
 * misidentified as an improvement-label boundary.
 */
export async function parseAnyLabelsPdf(file: File): Promise<{ labels: Label[]; errors: string[] }> {
  const errors: string[] = [];
  const labels: Label[] = [];

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

  let labelType: LabelType | null = null;

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

      // Detect type once from the first page that contains label content.
      // physicalLines are already computed, so detection adds no extra PDF work.
      if (labelType === null) {
        labelType = detectType(physicalLines);
        if (labelType === null) continue;
      }

      const isBoundary = labelType === 'award'
        ? (col: string) => AWARD_RE.test(col)
        : (col: string) => IMPROV_RE.test(col);

      const blocks = toBlocks(physicalLines, isBoundary);
      for (const block of blocks) {
        labels.push(...parseBlock(block, labelType, pageNum, errors));
      }
    } catch (err) {
      errors.push(`Page ${pageNum}: ${err instanceof Error ? err.message : 'Parse error'}`);
    }
  }

  return { labels, errors };
}
