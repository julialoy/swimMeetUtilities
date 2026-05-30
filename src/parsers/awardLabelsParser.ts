import { parseLabelsPdf } from './pdfLabelUtils';
import { parseLabelLines } from './awardLabelLineParser';
import type { AwardLabelsResult } from '../types';

const PLACE_LINE_RE = /\b\w+\s+Place\s+Time:/i;

export async function parseAwardLabelsPdf(file: File): Promise<AwardLabelsResult> {
  return parseLabelsPdf(file, col => PLACE_LINE_RE.test(col), parseLabelLines);
}
