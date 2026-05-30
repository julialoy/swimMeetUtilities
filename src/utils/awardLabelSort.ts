import type { AwardLabel } from '../types';

export type SortKey = 'name' | 'event' | 'week';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Splits an event number like "7B" into [7, "b"] for numeric-then-alpha sorting. */
function parseEventNumber(s: string): [number, string] {
  const m = s.match(/^(\d+)([A-Za-z]*)$/);
  return m ? [parseInt(m[1], 10), m[2].toLowerCase()] : [0, s.toLowerCase()];
}

/** Parses the label's date string (e.g. "Jun 25, 2025") to ms since epoch. */
function parseDateMs(dateStr: string): number {
  return new Date(dateStr).getTime() || 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a new sorted copy of `labels` without mutating the input.
 *
 * Sort keys:
 * - `'name'`  — lastName → firstName
 * - `'event'` — event number (numeric, then letter suffix) → place
 * - `'week'`  — date (chronological) → event number → place
 */
export function sortAwardLabels(labels: AwardLabel[], by: SortKey): AwardLabel[] {
  return [...labels].sort((a, b) => {
    if (by === 'name') {
      return (
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName)
      );
    }

    const [an, al] = parseEventNumber(a.eventNumber);
    const [bn, bl] = parseEventNumber(b.eventNumber);
    const eventCmp = (an - bn) || al.localeCompare(bl);
    const placeCmp = a.place - b.place;

    if (by === 'event') {
      return eventCmp || placeCmp;
    }

    // 'week': date → event → place
    return (parseDateMs(a.date) - parseDateMs(b.date)) || eventCmp || placeCmp;
  });
}
