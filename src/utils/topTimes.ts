import type { SwimTopiaAthlete, TopTimeEntry } from '../types';

export type TopTimesSortKey = 'event' | 'rank' | 'name' | 'age';

/**
 * Ordered triple of sort keys; first = highest precedence, ties fall through.
 * Keys need not be distinct (a repeated key simply never breaks a further tie).
 */
export type TopTimesSortOrder = [TopTimesSortKey, TopTimesSortKey, TopTimesSortKey];

// ── Age group definitions ─────────────────────────────────────────────────────
// Keyed by the lowercase-trimmed string that appears in the SwimTopia CSV
// AgeGroup column. Each entry carries display-ready gender and age-range
// strings plus a sort order that matches swim-league convention.

const AGE_GROUP_INFO: Readonly<Record<string, { display: string; order: number }>> = {
  '8 & under':       { display: '8 & Under',       order: 0 },
  // MCSL exports the 8 & Under bracket as two sub-groups — "07-08" and
  // "6 & Under" — each optionally gender-suffixed (e.g. "07-08 Boys").
  // All variants alias into the matching 8 & Under group.
  '7-8':             { display: '8 & Under',       order: 0 },
  '6 & under':       { display: '8 & Under',       order: 0 },
  '8 & under girls': { display: 'Girls 8 & Under',  order: 1 },
  '7-8 girls':       { display: 'Girls 8 & Under',  order: 1 },
  '6 & under girls': { display: 'Girls 8 & Under',  order: 1 },
  '8 & under boys':  { display: 'Boys 8 & Under',   order: 2 },
  '7-8 boys':        { display: 'Boys 8 & Under',   order: 2 },
  '6 & under boys':  { display: 'Boys 8 & Under',   order: 2 },
  '9-10 girls':      { display: 'Girls 9-10',       order: 3 },
  '9-10 boys':       { display: 'Boys 9-10',        order: 4 },
  '11-12 girls':     { display: 'Girls 11-12',      order: 5 },
  '11-12 boys':      { display: 'Boys 11-12',       order: 6 },
  '13-14 girls':     { display: 'Girls 13-14',      order: 7 },
  '13-14 boys':      { display: 'Boys 13-14',       order: 8 },
  '15-18 women':     { display: 'Women 15-18',      order: 9 },
  '15-18 men':       { display: 'Men 15-18',        order: 10 },
};

// Standard abbreviated stroke names used in swim-meet programs.
// Both full names (HyTek "Freestyle") and SwimTopia's already-abbreviated
// names ("Free") are accepted as keys so either source maps to the same label.
const STROKE_DISPLAY: Readonly<Record<string, string>> = {
  Freestyle:          'Free',
  Backstroke:         'Back',
  Breaststroke:       'Breast',
  Butterfly:          'Fly',
  'Individual Medley': 'IM',
  Free:   'Free',
  Back:   'Back',
  Breast: 'Breast',
  Fly:    'Fly',
  IM:     'IM',
};

// Standard individual stroke ordering used in most swim league programs.
// Keyed by both full and SwimTopia-abbreviated stroke names (see STROKE_DISPLAY)
// so the event sort orders strokes regardless of source format.
const STROKE_ORDER: Readonly<Record<string, number>> = {
  Freestyle: 0,
  Backstroke: 1,
  Breaststroke: 2,
  Butterfly: 3,
  'Individual Medley': 4,
  Free:   0,
  Back:   1,
  Breast: 2,
  Fly:    3,
  IM:     4,
};

/** Strips leading zeros from numeric parts and lowercases, so "09-10 Boys" → "9-10 boys". */
function normalizeAgeGroup(s: string): string {
  return s.toLowerCase().trim().replace(/\b0+(\d)/g, '$1');
}

/**
 * Canonical grouping key for an event. Age-group aliases collapse into their
 * display group — e.g. the MCSL sub-groups "07-08" and "6 & Under" both map
 * to "8 & Under" — so athletes from aliased sub-groups rank together as one
 * event. Unknown age groups fall back to the normalised raw string.
 *
 * Used by `getTopTimes` for ranking groups and by the top-times PDF generator
 * for heading boundaries; both must agree or a merged event's heading would
 * reprint at every sub-group alternation.
 */
export function eventKey(ageGroup: string, distance: string, stroke: string): string {
  const norm = normalizeAgeGroup(ageGroup);
  const info = AGE_GROUP_INFO[norm];
  return `${info ? info.display.toLowerCase() : norm}|${distance}|${stroke}`;
}

/**
 * Builds the display title for an event: "Gender AgeRange Distance Stroke".
 * Example: formatEventTitle('9-10 boys', '50', 'Freestyle') → "Boys 9-10 50 Free"
 *
 * The ageGroup lookup is case-insensitive and tolerates leading zeros in numerics
 * (e.g. "09-10 Boys" from the SwimTopia CSV normalises to the same key as "9-10 boys").
 */
export function formatEventTitle(ageGroup: string, distance: string, stroke: string): string {
  const info = AGE_GROUP_INFO[normalizeAgeGroup(ageGroup)];
  const prefix = info ? info.display : ageGroup.trim();
  const strokeDisplay = STROKE_DISPLAY[stroke] ?? stroke;
  return `${prefix} ${distance} ${strokeDisplay}`;
}

/**
 * Returns all unique meet names in the order they first appear across the
 * parsed athletes. Preserves the column order from the source CSV (Meet1…Meet17).
 */
export function extractMeetNames(athletes: SwimTopiaAthlete[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const athlete of athletes) {
    for (const event of athlete.events) {
      for (const mr of event.meetResults) {
        if (mr.meetName && !seen.has(mr.meetName)) {
          seen.add(mr.meetName);
          names.push(mr.meetName);
        }
      }
    }
  }
  return names;
}

/**
 * For each event (age group + distance + stroke), finds each athlete's single
 * best time across the selected meets, then returns the top N fastest per event.
 *
 * Age group is included in the event key so that, e.g., "Boys 9-10 50 Free"
 * and "Girls 9-10 50 Free" are treated as separate events.
 *
 * Each athlete appears at most once per event regardless of how many selected
 * meets they swam it in — only their best result is kept.
 *
 * `topN = 0` is uncapped: every athlete with a result is included, matching
 * HyTek Team Manager's "top 0" convention in the Best Times report.
 */
export function getTopTimes(
  athletes: SwimTopiaAthlete[],
  selectedMeets: ReadonlySet<string>,
  topN: number
): TopTimeEntry[] {
  if (selectedMeets.size === 0) return [];

  type Candidate = Omit<TopTimeEntry, 'eventDistance' | 'eventStroke' | 'rank'>;

  // eventKey → { distance, stroke, athleteId → best Candidate }
  const byEvent = new Map<string, { distance: string; stroke: string; best: Map<string, Candidate> }>();

  for (const athlete of athletes) {
    for (const event of athlete.events) {
      const key = eventKey(athlete.ageGroup, event.eventDistance, event.eventStroke);
      if (!byEvent.has(key)) {
        byEvent.set(key, { distance: event.eventDistance, stroke: event.eventStroke, best: new Map() });
      }
      const slot = byEvent.get(key)!;

      for (const mr of event.meetResults) {
        if (!selectedMeets.has(mr.meetName) || mr.resultSec <= 0) continue;
        const existing = slot.best.get(athlete.athleteId);
        if (!existing || mr.resultSec < existing.resultSec) {
          slot.best.set(athlete.athleteId, {
            lastName: athlete.lastName,
            firstName: athlete.firstName,
            ageGroup: athlete.ageGroup,
            age: athlete.age,
            result: mr.result,
            resultSec: mr.resultSec,
            meetName: mr.meetName,
            date: mr.date,
          });
        }
      }
    }
  }

  const entries: TopTimeEntry[] = [];

  for (const [, { distance, stroke, best }] of byEvent) {
    const sorted = [...best.values()].sort((a, b) => a.resultSec - b.resultSec);
    const ranked = topN === 0 ? sorted : sorted.slice(0, topN);
    ranked.forEach((c, i) => {
      entries.push({ eventDistance: distance, eventStroke: stroke, rank: i + 1, ...c });
    });
  }

  return entries;
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

function ageGroupSortKey(ageGroup: string): number {
  const info = AGE_GROUP_INFO[normalizeAgeGroup(ageGroup)];
  return info ? info.order : 999;
}

function compareBy(a: TopTimeEntry, b: TopTimeEntry, key: TopTimesSortKey): number {
  switch (key) {
    case 'event': {
      // Order by the full program event (age group → distance → stroke) so that
      // sorting "by event" keeps each event — as displayed and as keyed by
      // `eventKey` — contiguous. Without the age-group term, e.g. "Girls 9-10
      // 50 Free" and "Boys 9-10 50 Free" would interleave and fragment the PDF.
      const ageCmp = ageGroupSortKey(a.ageGroup) - ageGroupSortKey(b.ageGroup);
      if (ageCmp !== 0) return ageCmp;
      const da = parseInt(a.eventDistance, 10) || 0;
      const db = parseInt(b.eventDistance, 10) || 0;
      if (da !== db) return da - db;
      return (STROKE_ORDER[a.eventStroke] ?? 99) - (STROKE_ORDER[b.eventStroke] ?? 99);
    }
    case 'rank':
      return a.rank - b.rank;
    case 'name': {
      const last = a.lastName.localeCompare(b.lastName);
      return last !== 0 ? last : a.firstName.localeCompare(b.firstName);
    }
    case 'age':
      return ageGroupSortKey(a.ageGroup) - ageGroupSortKey(b.ageGroup);
  }
}

/**
 * Sorts top-time entries by up to three user-specified keys in precedence order.
 *
 * Each key is one of `'event'` (age group → distance → stroke), `'rank'`
 * (fastest first within an event), `'name'` (last then first), or `'age'`
 * (age-group order). The first key has highest precedence; ties fall through
 * to the second, then third. Keys may repeat (a repeat is just a no-op tie).
 *
 * For a conventional grouped top-times report use `['event', 'rank', 'name']`:
 * events appear in program order, each listing swimmers fastest-first.
 *
 * Default `['event', 'name', 'age']` preserves the original library behaviour.
 */
export function sortTopTimes(
  entries: TopTimeEntry[],
  order: TopTimesSortOrder = ['event', 'name', 'age'],
): TopTimeEntry[] {
  return [...entries].sort((a, b) => {
    for (const key of order) {
      const cmp = compareBy(a, b, key);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}
