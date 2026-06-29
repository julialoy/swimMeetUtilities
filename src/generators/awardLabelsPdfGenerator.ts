import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Label } from '../types';

// ── Avery 18260 / 8160 layout constants (US Letter, PDF points: 1" = 72 pts) ──
// Official Avery 18260 grid: 3 cols × 10 rows, label 2.625" × 1.0",
// top margin 0.5", left margin 0.1875", column pitch 2.75", row pitch 1.0".

const PAGE_W = 612;  // 8.5"
const PAGE_H = 792;  // 11"

const MARGIN_TOP  = 36;   // 0.5" from top of page to top of first label row
const MARGIN_LEFT = 13.5; // 0.1875" from left edge to first column

const LABEL_W = 189; // 2.625"
const LABEL_H = 72;  // 1.0" (row pitch — no vertical gap between rows)
const H_GAP   = 9;   // 0.125" between columns → column pitch 198 (2.75") per Avery 18260 spec

const COLS            = 3;
const ROWS            = 10;
const LABELS_PER_PAGE = COLS * ROWS; // 30

// Left x of each column
const COL_X: readonly number[] = [
  MARGIN_LEFT,
  MARGIN_LEFT + LABEL_W + H_GAP,
  MARGIN_LEFT + 2 * (LABEL_W + H_GAP),
];

// ── Text layout within a label ────────────────────────────────────────────────

const FONT_SIZE    = 9;     // readable at label size
const LINE_SPACING = 10.35; // baseline-to-baseline (5 lines centered in the 72pt label)
const PAD_TOP      = 9;     // pts from label top to first text baseline → first baseline at labelTop−18
const PAD_LEFT     = 9;     // pts from label left edge to text

// ── Helpers ───────────────────────────────────────────────────────────────────

function labelLines(label: Label): string[] {
  if ('place' in label) {
    return [
      `${label.placeOrdinal} Place  Time: ${label.finishTime}`,
      `#${label.eventNumber} ${label.eventDescription}`,
      `${label.lastName}, ${label.firstName} (${label.age})`,
      `${label.team} – ${label.date}`,
      label.meetName,
    ];
  }
  return [
    `#${label.eventNumber} ${label.eventDescription}`,
    `${label.lastName}, ${label.firstName} (${label.age})`,
    `Personal Best: ${label.personalBestTime} (${label.improvement.toFixed(2)})`,
    `${label.team} – ${label.date}`,
    label.meetName,
  ];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates a PDF containing award and/or improvement labels laid out for
 * Avery 18260 / 8160 sheets (3 columns × 10 rows, 30 labels per US letter page).
 *
 * Labels are placed left-to-right, top-to-bottom (row-major order), matching
 * the layout produced by SwimTopia / HyTek. Each label is rendered in its own
 * format: award labels show place and finish time; improvement labels show
 * personal best time and improvement amount.
 *
 * @param labels - Ordered list of Label objects to print.
 * @returns Raw PDF bytes suitable for saving or triggering a browser download.
 */
export async function generateLabelsPdf(labels: Label[]): Promise<Uint8Array> {
  const doc  = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let pageStart = 0; pageStart < labels.length; pageStart += LABELS_PER_PAGE) {
    const page       = doc.addPage([PAGE_W, PAGE_H]);
    const pageLabels = labels.slice(pageStart, pageStart + LABELS_PER_PAGE);

    for (let li = 0; li < pageLabels.length; li++) {
      const col = li % COLS;
      const row = Math.floor(li / COLS);

      const labelLeft = COL_X[col];
      // PDF y-origin is bottom-left; compute the label's top edge from bottom.
      const labelTop  = PAGE_H - MARGIN_TOP - row * LABEL_H;

      const lines = labelLines(pageLabels[li]);
      for (let ln = 0; ln < lines.length; ln++) {
        page.drawText(lines[ln], {
          x:    labelLeft + PAD_LEFT,
          y:    labelTop - PAD_TOP - FONT_SIZE - ln * LINE_SPACING,
          font,
          size: FONT_SIZE,
          color: rgb(0, 0, 0),
        });
      }
    }
  }

  // addDefaultPage: false — don't insert a blank page when labels is empty.
  return doc.save({ addDefaultPage: false });
}

