import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { TopTimeEntry } from '../types';
import { eventKey, formatEventTitle } from '../utils/topTimes';

// ── Page constants (US Letter) ────────────────────────────────────────────────

const PAGE_W = 612;  // 8.5"
const PAGE_H = 792;  // 11"

const MARGIN_X      = 36;
const MARGIN_TOP    = 36;
const MARGIN_BOTTOM = 36;

// ── Typography ────────────────────────────────────────────────────────────────

const HEADER_SIZE    = 11;
const ROW_SIZE       = 9;
const HEADER_LEADING = 18;  // vertical space consumed by an event heading
const ROW_LEADING    = 13;  // vertical space per athlete row
const GROUP_GAP      = 10;  // extra gap inserted between event groups

// ── Column x-positions (content width = 612 − 72 = 540 pts) ─────────────────
// Rank  :  25 pts  →  handles "1." – "50."
// Name  : 200 pts  →  handles hyphenated names (e.g. "Fett-Wren, Paz")
// Time  :  70 pts  →  handles "1:30.72S"
// Meet  : 245 pts  →  remaining width

const COL_RANK = MARGIN_X;        //  36
const COL_NAME = MARGIN_X + 25;   //  61
const COL_TIME = MARGIN_X + 225;  // 261
const COL_MEET = MARGIN_X + 295;  // 331

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Generates a top-times report PDF from a sorted list of `TopTimeEntry` values.
 *
 * Entries should arrive pre-sorted with `event` as the primary key (e.g. via
 * `sortTopTimes(entries, ['event', 'rank', 'name'])`) so that each event's rows
 * are contiguous and ordered fastest-first. Event boundaries are detected from
 * `eventKey`; a bold heading is written at each boundary.
 *
 * Each athlete row contains: rank · "Last, First" · time · meet name.
 *
 * Pages are US Letter (612 × 792 pts) with 36 pt margins. A new page is
 * opened whenever the next heading + at least one row, or a lone row, would
 * fall below the bottom margin.
 */
export async function generateTopTimesPdf(entries: TopTimeEntry[]): Promise<Uint8Array> {
  const doc         = await PDFDocument.create();
  const boldFont    = await doc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);

  if (entries.length === 0) return doc.save({ addDefaultPage: false });

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y    = PAGE_H - MARGIN_TOP;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN_BOTTOM) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y    = PAGE_H - MARGIN_TOP;
    }
  }

  let currentEventKey = '';

  for (const entry of entries) {
    const key = eventKey(entry.ageGroup, entry.eventDistance, entry.eventStroke);

    if (key !== currentEventKey) {
      if (currentEventKey !== '') y -= GROUP_GAP;
      ensureSpace(HEADER_LEADING + ROW_LEADING);

      page.drawText(formatEventTitle(entry.ageGroup, entry.eventDistance, entry.eventStroke), {
        x:    MARGIN_X,
        y,
        font: boldFont,
        size: HEADER_SIZE,
        color: rgb(0, 0, 0),
      });
      y -= HEADER_LEADING;
      currentEventKey = key;
    }

    ensureSpace(ROW_LEADING);

    page.drawText(`${entry.rank}.`, {
      x:    COL_RANK,
      y,
      font: regularFont,
      size: ROW_SIZE,
      color: rgb(0.45, 0.45, 0.45),
    });

    page.drawText(`${entry.lastName}, ${entry.firstName}`, {
      x:    COL_NAME,
      y,
      font: regularFont,
      size: ROW_SIZE,
      color: rgb(0, 0, 0),
    });

    page.drawText(entry.result, {
      x:    COL_TIME,
      y,
      font: regularFont,
      size: ROW_SIZE,
      color: rgb(0, 0, 0),
    });

    page.drawText(entry.meetName, {
      x:    COL_MEET,
      y,
      font: regularFont,
      size: ROW_SIZE,
      color: rgb(0, 0, 0),
    });

    y -= ROW_LEADING;
  }

  return doc.save({ addDefaultPage: false });
}
