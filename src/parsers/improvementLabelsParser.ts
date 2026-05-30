import { parseLabelsPdf } from './pdfLabelUtils';
import { parseLabelLines } from './improvementLabelLineParser';
import type { ImprovementLabelsResult } from '../types';

const EVENT_START_RE = /^#\w+\s+/;

export async function parseImprovementLabelsPdf(file: File): Promise<ImprovementLabelsResult> {
  return parseLabelsPdf(file, col => EVENT_START_RE.test(col), parseLabelLines);
}
