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

// Reverse map: display name → a canonical AGE_GROUP_INFO key. Lets a swim-up
// target (chosen as a display name, e.g. "Boys 11-12") be turned back into a
// canonical age group so it groups/sorts/titles identically to native swimmers.
const DISPLAY_TO_KEY: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(AGE_GROUP_INFO).map(([key, info]) => [info.display, key])
);

/** Display name for an age group ("9-10 Boys" → "Boys 9-10"); raw trimmed if unknown. */
export function ageGroupDisplay(ageGroup: string): string {
  const info = AGE_GROUP_INFO[normalizeAgeGroup(ageGroup)];
  return info ? info.display : ageGroup.trim();
}

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
 * Inserts a space before a trailing course designation on a result time, e.g.
 * "19.99S" → "19.99 S" and "1:07.69S" → "1:07.69 S". Leaves times without a
 * trailing letter unchanged. Display-only; does not affect the parsed seconds.
 */
export function formatSwimTime(result: string): string {
  return result.replace(/(\d)([A-Za-z]+)$/, '$1 $2');
}

// Stroke order for the per-athlete PDF view: IM first, then Free/Back/Breast/Fly.
// Keyed by both full and abbreviated stroke names (like STROKE_ORDER).
const ATHLETE_STROKE_ORDER: Readonly<Record<string, number>> = {
  'Individual Medley': 0, IM: 0,
  Freestyle: 1,          Free: 1,
  Backstroke: 2,         Back: 2,
  Breaststroke: 3,       Breast: 3,
  Butterfly: 4,          Fly: 4,
};

/** One athlete and their top-time entries, for the per-athlete PDF layout. */
export interface AthleteGroup {
  athleteId: string;
  lastName: string;
  firstName: string;
  entries: TopTimeEntry[];
}

/**
 * Groups top-time entries by athlete, preserving the order athletes first appear
 * in `entries` (so an already name-sorted list yields alphabetical athletes).
 * Each athlete's events are ordered IM → Free → Back → Breast → Fly, then by
 * ascending distance. Used by the per-athlete PDF layout.
 */
export function groupByAthlete(entries: TopTimeEntry[]): AthleteGroup[] {
  const groups = new Map<string, AthleteGroup>();
  for (const e of entries) {
    let g = groups.get(e.athleteId);
    if (!g) {
      g = { athleteId: e.athleteId, lastName: e.lastName, firstName: e.firstName, entries: [] };
      groups.set(e.athleteId, g);
    }
    g.entries.push(e);
  }
  for (const g of groups.values()) {
    g.entries.sort((a, b) => {
      const sa = ATHLETE_STROKE_ORDER[a.eventStroke] ?? 99;
      const sb = ATHLETE_STROKE_ORDER[b.eventStroke] ?? 99;
      if (sa !== sb) return sa - sb;
      return (parseInt(a.eventDistance, 10) || 0) - (parseInt(b.eventDistance, 10) || 0);
    });
  }
  return [...groups.values()];
}

// Age-group ladder per sex, using the display names from AGE_GROUP_INFO, ordered
// youngest → oldest. Drives the valid "swim up" targets for an athlete.
const AGE_LADDER: ReadonlyArray<{ display: string; sex: 'F' | 'M'; rank: number }> = [
  { display: 'Girls 8 & Under', sex: 'F', rank: 0 },
  { display: 'Girls 9-10',      sex: 'F', rank: 1 },
  { display: 'Girls 11-12',     sex: 'F', rank: 2 },
  { display: 'Girls 13-14',     sex: 'F', rank: 3 },
  { display: 'Women 15-18',     sex: 'F', rank: 4 },
  { display: 'Boys 8 & Under',  sex: 'M', rank: 0 },
  { display: 'Boys 9-10',       sex: 'M', rank: 1 },
  { display: 'Boys 11-12',      sex: 'M', rank: 2 },
  { display: 'Boys 13-14',      sex: 'M', rank: 3 },
  { display: 'Men 15-18',       sex: 'M', rank: 4 },
];

/**
 * Returns the display names of age groups an athlete could "swim up" into:
 * same sex, older bracket than their own. Populates the swim-up target selector.
 * If the athlete's group can't be resolved (unknown/genderless), offers every
 * ladder group so the user can still choose.
 */
export function olderAgeGroups(ageGroup: string): string[] {
  const info = AGE_GROUP_INFO[normalizeAgeGroup(ageGroup)];
  const display = info ? info.display : ageGroup.trim();
  const current = AGE_LADDER.find(g => g.display === display);
  if (!current) return AGE_LADDER.map(g => g.display);
  return AGE_LADDER.filter(g => g.sex === current.sex && g.rank > current.rank).map(g => g.display);
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
 *
 * `swimUps` maps an entry key (`athleteId|distance|stroke`, see `topTimeKey`) to
 * the display name of an OLDER age group the athlete manually swam up into. Such
 * an athlete's result is moved into that older group's event, ranked among its
 * swimmers, tagged with `swamUpFrom` (their own group), and always kept even if
 * it falls outside the top N (so a manual flag never silently drops a swimmer).
 */
export function getTopTimes(
  athletes: SwimTopiaAthlete[],
  selectedMeets: ReadonlySet<string>,
  topN: number,
  swimUps: ReadonlyMap<string, string> = new Map(),
): TopTimeEntry[] {
  if (selectedMeets.size === 0) return [];

  type Candidate = Omit<TopTimeEntry, 'eventDistance' | 'eventStroke' | 'rank'>;

  // eventKey → { distance, stroke, athleteId → best Candidate }
  const byEvent = new Map<string, { distance: string; stroke: string; best: Map<string, Candidate> }>();

  for (const athlete of athletes) {
    for (const event of athlete.events) {
      // A swim-up moves this swim into the older group's event; convert the
      // chosen display name back to a canonical age group so it groups, sorts,
      // and titles exactly like native swimmers of that group.
      const target = swimUps.get(`${athlete.athleteId}|${event.eventDistance}|${event.eventStroke}`);
      const effectiveAgeGroup = target ? (DISPLAY_TO_KEY[target] ?? target) : athlete.ageGroup;
      const swamUpFrom = target ? ageGroupDisplay(athlete.ageGroup) : undefined;

      const key = eventKey(effectiveAgeGroup, event.eventDistance, event.eventStroke);
      if (!byEvent.has(key)) {
        byEvent.set(key, { distance: event.eventDistance, stroke: event.eventStroke, best: new Map() });
      }
      const slot = byEvent.get(key)!;

      for (const mr of event.meetResults) {
        if (!selectedMeets.has(mr.meetName) || mr.resultSec <= 0) continue;
        const existing = slot.best.get(athlete.athleteId);
        if (!existing || mr.resultSec < existing.resultSec) {
          slot.best.set(athlete.athleteId, {
            athleteId: athlete.athleteId,
            lastName: athlete.lastName,
            firstName: athlete.firstName,
            ageGroup: effectiveAgeGroup,
            age: athlete.age,
            result: mr.result,
            resultSec: mr.resultSec,
            meetName: mr.meetName,
            date: mr.date,
            swamUpFrom,
          });
        }
      }
    }
  }

  const entries: TopTimeEntry[] = [];

  for (const [, { distance, stroke, best }] of byEvent) {
    const sorted = [...best.values()].sort((a, b) => a.resultSec - b.resultSec);
    sorted.forEach((c, i) => {
      const rank = i + 1;
      // Keep the top N, plus any swim-up (manually flagged) beyond the cutoff.
      if (topN !== 0 && rank > topN && !c.swamUpFrom) return;
      entries.push({ eventDistance: distance, eventStroke: stroke, rank, ...c });
    });
  }

  return entries;
}

/** Stable per-entry key (athlete + event) for hanging swim-up flags on. */
export function topTimeKey(e: { athleteId: string; eventDistance: string; eventStroke: string }): string {
  return `${e.athleteId}|${e.eventDistance}|${e.eventStroke}`;
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
