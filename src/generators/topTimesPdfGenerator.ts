import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { TopTimeEntry } from '../types';
import { eventKey, formatEventTitle, formatImprovement, formatSwimTime, groupByAthlete } from '../utils/topTimes';

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
// Name  : 189 pts  →  handles hyphenated names (e.g. "Fett-Wren, Paz")
// Time  : 105 pts  →  handles "1:30.72 S (-12.34)" (time + improvement delta)
// Meet  : 221 pts  →  remaining width

const COL_RANK = MARGIN_X;        //  36
const COL_NAME = MARGIN_X + 25;   //  61
const COL_TIME = MARGIN_X + 214;  // 250
const COL_MEET = MARGIN_X + 319;  // 355

/** Time with its improvement delta appended when present, e.g. "31.50 S (-2.60)". */
function timeText(e: TopTimeEntry): string {
  return `${formatSwimTime(e.result)}${e.improvementSec != null ? ` (${formatImprovement(e.improvementSec)})` : ''}`;
}

/** Formats a rank as an English ordinal: 1 → "1st", 2 → "2nd", 11 → "11th". */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:  return `${n}st`;
    case 2:  return `${n}nd`;
    case 3:  return `${n}rd`;
    default: return `${n}th`;
  }
}

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Generates a top-times report PDF from a sorted list of `TopTimeEntry` values.
 *
 * `groupBy` controls the layout:
 * - `'event'` (default): a bold event heading per event, then its rows
 *   `rank · "Last, First" · time · meet`. Entries should arrive pre-sorted with
 *   `event` as the primary key so each event's rows are contiguous.
 * - `'athlete'`: a bold athlete-name heading per athlete, then their events
 *   `event title — <rank> · time · meet`, ordered IM → Free → Back → Breast →
 *   Fly. Used when the report is sorted primarily by athlete name.
 *
 * Pages are US Letter (612 × 792 pts) with 36 pt margins. A new page is opened
 * whenever the next heading + at least one row, or a lone row, would fall below
 * the bottom margin.
 */
export async function generateTopTimesPdf(
  entries: TopTimeEntry[],
  groupBy: 'event' | 'athlete' = 'event',
): Promise<Uint8Array> {
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

  function heading(text: string, isFirst: boolean) {
    if (!isFirst) y -= GROUP_GAP;
    ensureSpace(HEADER_LEADING + ROW_LEADING);
    page.drawText(text, { x: MARGIN_X, y, font: boldFont, size: HEADER_SIZE, color: rgb(0, 0, 0) });
    y -= HEADER_LEADING;
  }

  function cell(text: string, x: number, color = rgb(0, 0, 0)) {
    page.drawText(text, { x, y, font: regularFont, size: ROW_SIZE, color });
  }

  if (groupBy === 'athlete') {
    // Bold athlete name, then their events (IM → Free → Back → Breast → Fly).
    let first = true;
    for (const group of groupByAthlete(entries)) {
      heading(`${group.lastName}, ${group.firstName}`, first);
      first = false;
      for (const entry of group.entries) {
        ensureSpace(ROW_LEADING);
        // Event title, then the swimmer's placing in that event, then swim-up mark.
        const title = formatEventTitle(entry.ageGroup, entry.eventDistance, entry.eventStroke);
        cell(`${title} — ${ordinal(entry.rank)}${entry.swamUpFrom ? ' (swim up)' : ''}`, COL_NAME);
        cell(timeText(entry), COL_TIME);
        cell(entry.meetName, COL_MEET);
        y -= ROW_LEADING;
      }
    }
    return doc.save({ addDefaultPage: false });
  }

  // Default: bold event heading, then its ranked swimmer rows.
  let currentEventKey = '';
  for (const entry of entries) {
    const key = eventKey(entry.ageGroup, entry.eventDistance, entry.eventStroke);
    if (key !== currentEventKey) {
      heading(formatEventTitle(entry.ageGroup, entry.eventDistance, entry.eventStroke), currentEventKey === '');
      currentEventKey = key;
    }

    ensureSpace(ROW_LEADING);
    cell(`${entry.rank}.`, COL_RANK, rgb(0.45, 0.45, 0.45));
    // A swim-up entry has been moved into the older group's event; mark it "(swim up)".
    cell(`${entry.lastName}, ${entry.firstName}${entry.swamUpFrom ? ' (swim up)' : ''}`, COL_NAME);
    cell(timeText(entry), COL_TIME);
    cell(entry.meetName, COL_MEET);
    y -= ROW_LEADING;
  }

  return doc.save({ addDefaultPage: false });
}
