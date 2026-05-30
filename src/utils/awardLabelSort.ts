import type { Label } from '../types';

export type SortKey = 'name' | 'event' | 'week';
export type { Label };

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

/**
 * Returns the sort key used for within-event ordering.
 * Award labels use their finish place (1, 2, 3…).
 * Improvement labels have no place, so they sort after all award labels
 * for the same event via a sentinel value.
 */
function getPlace(label: Label): number {
  return 'place' in label ? label.place : Number.MAX_SAFE_INTEGER;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a new sorted copy of `labels` without mutating the input.
 * Accepts any mix of AwardLabel and ImprovementLabel.
 *
 * Sort keys:
 * - `'name'`  — lastName → firstName
 * - `'event'` — event number (numeric then letter suffix) → place
 *               (award labels by finish place; improvement labels after all
 *               award labels for the same event, then by lastName/firstName)
 * - `'week'`  — date (chronological) → event number → place → lastName/firstName
 */
export function sortLabels<T extends Label>(labels: T[], by: SortKey): T[] {
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
    const placeCmp = getPlace(a) - getPlace(b);
    const nameCmp  = a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

    if (by === 'event') {
      return eventCmp || placeCmp || nameCmp;
    }

    // 'week': date → event number → place/type → name
    return (parseDateMs(a.date) - parseDateMs(b.date)) || eventCmp || placeCmp || nameCmp;
  });
}

