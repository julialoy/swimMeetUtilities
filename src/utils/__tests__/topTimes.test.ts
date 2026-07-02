import { describe, it, expect } from 'vitest';
import { eventKey, extractMeetNames, formatEventTitle, formatSwimTime, getTopTimes, olderAgeGroups, sortTopTimes } from '../topTimes';
import type { SwimTopiaAthlete, TopTimeEntry } from '../../types';

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeAthlete(
  id: string,
  lastName: string,
  firstName: string,
  ageGroup: string,
  events: SwimTopiaAthlete['events']
): SwimTopiaAthlete {
  return { athleteId: id, lastName, firstName, ageGroup, age: 10, events };
}

function makeEvent(
  distance: string,
  stroke: string,
  results: Array<{ meetName: string; resultSec: number; result: string; date?: string }>
): SwimTopiaAthlete['events'][number] {
  return {
    eventDistance: distance,
    eventStroke: stroke,
    meetResults: results.map(r => ({
      meetName: r.meetName,
      result: r.result,
      resultSec: r.resultSec,
      improved: false,
      points: 0,
      date: r.date ?? '06/14/25',
    })),
    totalResults: results.filter(r => r.resultSec > 0).length,
    totalImproved: 0,
    totalPoints: 0,
    amountImprovedSec: 0,
    percentImproved: 0,
  };
}

const JEDI_TRIALS = 'Jedi Trials 2025';
const BESPIN_CUP  = 'Bespin Cup 2025';
const CORUSCANT   = 'Coruscant Invitational';

// Three athletes in the same age group: Skywalker (fast), Solo (medium), Organa (slowest).
// All '9-10 boys' so they compete in the same event buckets.
const ATHLETES: SwimTopiaAthlete[] = [
  makeAthlete('1', 'Skywalker', 'Luke', '9-10 boys', [
    makeEvent('50', 'Freestyle', [
      { meetName: JEDI_TRIALS, resultSec: 32.10, result: '32.10S' },
      { meetName: BESPIN_CUP,  resultSec: 31.50, result: '31.50S' }, // personal best
    ]),
    makeEvent('100', 'Backstroke', [
      { meetName: JEDI_TRIALS, resultSec: 75.00, result: '1:15.00S' },
    ]),
  ]),
  makeAthlete('2', 'Solo', 'Han', '9-10 boys', [
    makeEvent('50', 'Freestyle', [
      { meetName: JEDI_TRIALS, resultSec: 33.80, result: '33.80S' },
      { meetName: BESPIN_CUP,  resultSec: 34.20, result: '34.20S' }, // slower second swim
    ]),
    makeEvent('100', 'Backstroke', [
      { meetName: BESPIN_CUP, resultSec: 80.00, result: '1:20.00S' },
    ]),
  ]),
  makeAthlete('3', 'Organa', 'Leia', '9-10 boys', [
    makeEvent('50', 'Freestyle', [
      { meetName: BESPIN_CUP, resultSec: 36.00, result: '36.00S' },
    ]),
  ]),
];

// ── formatEventTitle ──────────────────────────────────────────────────────────

describe('formatEventTitle', () => {
  it('produces "Girls 8 & Under 25 Free" for the canonical young-girls group', () => {
    expect(formatEventTitle('8 & under girls', '25', 'Freestyle')).toBe('Girls 8 & Under 25 Free');
  });

  it('is case-insensitive for the age group string', () => {
    expect(formatEventTitle('9-10 Boys', '50', 'Backstroke')).toBe('Boys 9-10 50 Back');
  });

  it('trims surrounding whitespace from the age group', () => {
    expect(formatEventTitle('  11-12 girls  ', '100', 'Breaststroke')).toBe('Girls 11-12 100 Breast');
  });

  it('abbreviates all standard strokes', () => {
    expect(formatEventTitle('13-14 boys',  '100', 'Butterfly')).toBe('Boys 13-14 100 Fly');
    expect(formatEventTitle('15-18 women', '200', 'Individual Medley')).toBe('Women 15-18 200 IM');
    expect(formatEventTitle('15-18 men',   '100', 'Backstroke')).toBe('Men 15-18 100 Back');
  });

  it('handles combined (genderless) 8 & Under age group', () => {
    expect(formatEventTitle('8 & under', '25', 'Freestyle')).toBe('8 & Under 25 Free');
  });

  it('normalises leading zeros from SwimTopia CSV age group strings', () => {
    expect(formatEventTitle('09-10 Boys', '50', 'Freestyle')).toBe('Boys 9-10 50 Free');
    expect(formatEventTitle('08 & Under', '25', 'Freestyle')).toBe('8 & Under 25 Free');
  });

  it('maps MCSL "07-08" sub-group to "8 & Under"', () => {
    expect(formatEventTitle('07-08', '25', 'Freestyle')).toBe('8 & Under 25 Free');
  });

  it('maps MCSL "6 & Under" sub-group to "8 & Under"', () => {
    expect(formatEventTitle('6 & Under', '25', 'Freestyle')).toBe('8 & Under 25 Free');
    expect(formatEventTitle('06 & Under', '25', 'Freestyle')).toBe('8 & Under 25 Free');
  });

  it('maps gendered MCSL sub-groups to the gendered 8 & Under groups', () => {
    expect(formatEventTitle('07-08 Boys',       '25', 'Freestyle')).toBe('Boys 8 & Under 25 Free');
    expect(formatEventTitle('07-08 Girls',      '25', 'Freestyle')).toBe('Girls 8 & Under 25 Free');
    expect(formatEventTitle('6 & Under Boys',   '25', 'Freestyle')).toBe('Boys 8 & Under 25 Free');
    expect(formatEventTitle('06 & Under Girls', '25', 'Freestyle')).toBe('Girls 8 & Under 25 Free');
  });

  it('falls back to the raw age group string when not in the canonical list', () => {
    expect(formatEventTitle('Unknown Group', '100', 'Freestyle')).toBe('Unknown Group 100 Free');
  });

  it('falls back to the raw stroke when not in the abbreviation map', () => {
    expect(formatEventTitle('9-10 boys', '50', 'Medley Relay')).toBe('Boys 9-10 50 Medley Relay');
  });

  it('accepts SwimTopia abbreviated stroke names directly', () => {
    expect(formatEventTitle('9-10 boys', '50', 'Free')).toBe('Boys 9-10 50 Free');
    expect(formatEventTitle('9-10 boys', '25', 'Back')).toBe('Boys 9-10 25 Back');
    expect(formatEventTitle('11-12 girls', '50', 'Breast')).toBe('Girls 11-12 50 Breast');
    expect(formatEventTitle('11-12 girls', '50', 'Fly')).toBe('Girls 11-12 50 Fly');
    expect(formatEventTitle('11-12 girls', '100', 'IM')).toBe('Girls 11-12 100 IM');
  });
});

// ── eventKey ──────────────────────────────────────────────────────────────────

describe('eventKey', () => {
  it('collapses MCSL 8 & Under aliases into a single key', () => {
    const combined = eventKey('8 & Under', '25', 'Freestyle');
    expect(eventKey('07-08',      '25', 'Freestyle')).toBe(combined);
    expect(eventKey('6 & Under',  '25', 'Freestyle')).toBe(combined);
    expect(eventKey('06 & Under', '25', 'Freestyle')).toBe(combined);
  });

  it('collapses gendered MCSL sub-group aliases within each gender', () => {
    const boys = eventKey('8 & Under Boys', '25', 'Freestyle');
    expect(eventKey('07-08 Boys',      '25', 'Freestyle')).toBe(boys);
    expect(eventKey('6 & Under Boys',  '25', 'Freestyle')).toBe(boys);

    const girls = eventKey('8 & Under Girls', '25', 'Freestyle');
    expect(eventKey('07-08 Girls',      '25', 'Freestyle')).toBe(girls);
    expect(eventKey('06 & Under Girls', '25', 'Freestyle')).toBe(girls);

    expect(boys).not.toBe(girls);
  });

  it('keeps distinct age groups distinct for the same distance and stroke', () => {
    expect(eventKey('9-10 girls', '50', 'Freestyle')).not.toBe(eventKey('9-10 boys', '50', 'Freestyle'));
  });

  it('keeps distinct distances and strokes distinct within one age group', () => {
    expect(eventKey('9-10 boys', '50', 'Freestyle')).not.toBe(eventKey('9-10 boys', '100', 'Freestyle'));
    expect(eventKey('9-10 boys', '50', 'Freestyle')).not.toBe(eventKey('9-10 boys', '50', 'Backstroke'));
  });

  it('falls back to the normalised raw string for unknown age groups', () => {
    expect(eventKey('Unknown Group', '100', 'Freestyle')).toBe(eventKey('unknown group', '100', 'Freestyle'));
  });
});

// ── extractMeetNames ──────────────────────────────────────────────────────────

describe('extractMeetNames', () => {
  it('returns meet names in first-appearance order', () => {
    const names = extractMeetNames(ATHLETES);
    expect(names[0]).toBe(JEDI_TRIALS);
    expect(names[1]).toBe(BESPIN_CUP);
  });

  it('deduplicates across athletes and events', () => {
    const names = extractMeetNames(ATHLETES);
    expect(names.filter(n => n === JEDI_TRIALS)).toHaveLength(1);
    expect(names.filter(n => n === BESPIN_CUP)).toHaveLength(1);
  });

  it('returns empty array for no athletes', () => {
    expect(extractMeetNames([])).toEqual([]);
  });

  it('returns empty array when athletes have no meet results', () => {
    const athlete = makeAthlete('1', 'Fett', 'Boba', '8 & under boys', [
      makeEvent('25', 'Freestyle', []),
    ]);
    expect(extractMeetNames([athlete])).toEqual([]);
  });
});

// ── getTopTimes ───────────────────────────────────────────────────────────────

describe('getTopTimes', () => {
  it('returns all athletes when topN is 0 (uncapped — matches HyTek "top 0" convention)', () => {
    // Skywalker + Solo swam at Jedi Trials; Organa only has Bespin results
    const entries = getTopTimes(ATHLETES, new Set([JEDI_TRIALS]), 0);
    const free = entries.filter(e => e.eventStroke === 'Freestyle');
    const back = entries.filter(e => e.eventStroke === 'Backstroke');
    expect(free).toHaveLength(2);  // Skywalker + Solo
    expect(back).toHaveLength(1);  // Skywalker only
  });

  it('returns empty when no meets selected', () => {
    expect(getTopTimes(ATHLETES, new Set(), 3)).toEqual([]);
  });

  it('returns empty for no athletes', () => {
    expect(getTopTimes([], new Set([JEDI_TRIALS]), 3)).toEqual([]);
  });

  it('uses each athlete\'s best time across selected meets — not their latest', () => {
    const entries = getTopTimes(ATHLETES, new Set([JEDI_TRIALS, BESPIN_CUP]), 3);
    const sky  = entries.find(e => e.lastName === 'Skywalker' && e.eventStroke === 'Freestyle');
    const solo = entries.find(e => e.lastName === 'Solo'      && e.eventStroke === 'Freestyle');
    expect(sky?.resultSec).toBe(31.50);  // best at Bespin, not Jedi Trials
    expect(solo?.resultSec).toBe(33.80); // best at Jedi Trials, not Bespin
  });

  it('assigns rank 1 to fastest and rank 2 to second-fastest within the same event', () => {
    const entries = getTopTimes(ATHLETES, new Set([JEDI_TRIALS, BESPIN_CUP]), 3);
    const free = entries
      .filter(e => e.eventStroke === 'Freestyle')
      .sort((a, b) => a.rank - b.rank);
    expect(free[0].rank).toBe(1); expect(free[0].lastName).toBe('Skywalker'); // 31.50
    expect(free[1].rank).toBe(2); expect(free[1].lastName).toBe('Solo');      // 33.80
    expect(free[2].rank).toBe(3); expect(free[2].lastName).toBe('Organa');    // 36.00
  });

  it('respects topN — only returns the N fastest per event', () => {
    const entries = getTopTimes(ATHLETES, new Set([JEDI_TRIALS, BESPIN_CUP]), 2);
    const free = entries.filter(e => e.eventStroke === 'Freestyle');
    expect(free).toHaveLength(2);
    expect(free.map(e => e.lastName).sort()).toEqual(['Skywalker', 'Solo']);
  });

  it('filters to only selected meets', () => {
    const entries = getTopTimes(ATHLETES, new Set([BESPIN_CUP]), 3);
    const free = entries.filter(e => e.eventStroke === 'Freestyle');
    expect(free.map(e => e.lastName).sort()).toEqual(['Organa', 'Skywalker', 'Solo']);
    free.forEach(e => expect(e.meetName).toBe(BESPIN_CUP));
  });

  it('skips results with resultSec <= 0 (DNS / did not compete)', () => {
    const athletes = [
      makeAthlete('1', 'Tano', 'Ahsoka', '11-12 girls', [
        makeEvent('50', 'Freestyle', [
          { meetName: JEDI_TRIALS, resultSec: 0,     result: '' },
          { meetName: BESPIN_CUP,  resultSec: 35.00, result: '35.00S' },
        ]),
      ]),
    ];
    const entries = getTopTimes(athletes, new Set([JEDI_TRIALS, BESPIN_CUP]), 3);
    expect(entries).toHaveLength(1);
    expect(entries[0].resultSec).toBe(35.00);
  });

  it('each athlete appears at most once per event', () => {
    const entries = getTopTimes(ATHLETES, new Set([JEDI_TRIALS, BESPIN_CUP]), 10);
    const skyFree = entries.filter(e => e.lastName === 'Skywalker' && e.eventStroke === 'Freestyle');
    expect(skyFree).toHaveLength(1);
  });

  it('treats different age groups as separate events even for the same distance and stroke', () => {
    const mixed = [
      makeAthlete('1', 'Skywalker', 'Luke', '9-10 boys', [
        makeEvent('50', 'Freestyle', [{ meetName: JEDI_TRIALS, resultSec: 32.10, result: '32.10S' }]),
      ]),
      makeAthlete('2', 'Organa', 'Leia', '9-10 girls', [
        makeEvent('50', 'Freestyle', [{ meetName: JEDI_TRIALS, resultSec: 31.00, result: '31.00S' }]),
      ]),
    ];
    const entries = getTopTimes(mixed, new Set([JEDI_TRIALS]), 3);
    // Each athlete is in their own event bucket — both appear with rank 1
    const boysFree  = entries.filter(e => e.ageGroup === '9-10 boys');
    const girlsFree = entries.filter(e => e.ageGroup === '9-10 girls');
    expect(boysFree).toHaveLength(1);
    expect(boysFree[0].rank).toBe(1);
    expect(girlsFree).toHaveLength(1);
    expect(girlsFree[0].rank).toBe(1);
  });

  it('merges MCSL "07-08" and "6 & Under" sub-groups into one combined 8 & Under event', () => {
    const mixed = [
      makeAthlete('1', 'Fett',     'Boba',  '07-08', [
        makeEvent('25', 'Freestyle', [{ meetName: JEDI_TRIALS, resultSec: 28.50, result: '28.50S' }]),
      ]),
      makeAthlete('2', 'Bridger',  'Ezra',  '6 & Under', [
        makeEvent('25', 'Freestyle', [{ meetName: JEDI_TRIALS, resultSec: 27.00, result: '27.00S' }]),
      ]),
      makeAthlete('3', 'Wren',     'Sabine', '07-08', [
        makeEvent('25', 'Freestyle', [{ meetName: JEDI_TRIALS, resultSec: 30.00, result: '30.00S' }]),
      ]),
    ];
    // topN = 2 must apply across the COMBINED group: Bridger (27.00) + Fett (28.50)
    const entries = getTopTimes(mixed, new Set([JEDI_TRIALS]), 2);
    expect(entries).toHaveLength(2);
    expect(entries.map(e => [e.rank, e.lastName]).sort()).toEqual([[1, 'Bridger'], [2, 'Fett']]);
  });

  it('merges gendered sub-groups per gender: boys together, girls together, never across', () => {
    const mixed = [
      makeAthlete('1', 'Fett',    'Boba',   '07-08 Boys', [
        makeEvent('25', 'Freestyle', [{ meetName: JEDI_TRIALS, resultSec: 28.50, result: '28.50S' }]),
      ]),
      makeAthlete('2', 'Bridger', 'Ezra',   '6 & Under Boys', [
        makeEvent('25', 'Freestyle', [{ meetName: JEDI_TRIALS, resultSec: 27.00, result: '27.00S' }]),
      ]),
      makeAthlete('3', 'Wren',    'Sabine', '07-08 Girls', [
        makeEvent('25', 'Freestyle', [{ meetName: JEDI_TRIALS, resultSec: 26.00, result: '26.00S' }]),
      ]),
    ];
    const entries = getTopTimes(mixed, new Set([JEDI_TRIALS]), 0);
    expect(entries).toHaveLength(3);
    // Boys merged: Bridger (27.00) ranks 1, Fett (28.50) ranks 2
    expect(entries.find(e => e.lastName === 'Bridger')?.rank).toBe(1);
    expect(entries.find(e => e.lastName === 'Fett')?.rank).toBe(2);
    // Girls are a separate event: Wren ranks 1 despite being fastest overall
    expect(entries.find(e => e.lastName === 'Wren')?.rank).toBe(1);
  });

  it('handles a meet not present in any data without error', () => {
    expect(getTopTimes(ATHLETES, new Set([CORUSCANT]), 3)).toEqual([]);
  });

  it('records the meet where the best time was achieved', () => {
    const entries = getTopTimes(ATHLETES, new Set([JEDI_TRIALS, BESPIN_CUP]), 3);
    const sky = entries.find(e => e.lastName === 'Skywalker' && e.eventStroke === 'Freestyle');
    expect(sky?.meetName).toBe(BESPIN_CUP);
  });
});

// ── formatSwimTime ────────────────────────────────────────────────────────────

describe('formatSwimTime', () => {
  it('adds a space before a trailing course designation', () => {
    expect(formatSwimTime('19.99S')).toBe('19.99 S');
  });

  it('handles times over a minute', () => {
    expect(formatSwimTime('1:07.69S')).toBe('1:07.69 S');
  });

  it('leaves a time without a trailing letter unchanged', () => {
    expect(formatSwimTime('19.99')).toBe('19.99');
  });

  it('is idempotent when a space is already present', () => {
    expect(formatSwimTime('19.99 S')).toBe('19.99 S');
  });
});

// ── olderAgeGroups (swim-up targets) ──────────────────────────────────────────

describe('olderAgeGroups', () => {
  it('returns older same-sex groups for a boys group', () => {
    expect(olderAgeGroups('9-10 boys')).toEqual(['Boys 11-12', 'Boys 13-14', 'Men 15-18']);
  });

  it('returns older same-sex groups for a girls group', () => {
    expect(olderAgeGroups('9-10 girls')).toEqual(['Girls 11-12', 'Girls 13-14', 'Women 15-18']);
  });

  it('treats the gendered 8 & Under alias as the youngest bracket', () => {
    expect(olderAgeGroups('7-8 boys')).toEqual(['Boys 9-10', 'Boys 11-12', 'Boys 13-14', 'Men 15-18']);
  });

  it('normalises leading zeros and case', () => {
    expect(olderAgeGroups('09-10 Girls')).toEqual(['Girls 11-12', 'Girls 13-14', 'Women 15-18']);
  });

  it('returns an empty list for the oldest group', () => {
    expect(olderAgeGroups('15-18 men')).toEqual([]);
    expect(olderAgeGroups('15-18 women')).toEqual([]);
  });

  it('offers every group when the age group is unrecognised', () => {
    expect(olderAgeGroups('Womp Rats')).toHaveLength(10);
  });
});

// ── getTopTimes — swim-ups ────────────────────────────────────────────────────

describe('getTopTimes — swim-ups', () => {
  const MEETS = new Set([JEDI_TRIALS]);
  const SU = [
    makeAthlete('a', 'Young', 'Ann',  '9-10 girls',  [makeEvent('50', 'Freestyle', [{ meetName: JEDI_TRIALS, resultSec: 30.0, result: '30.00S' }])]),
    makeAthlete('b', 'Older', 'Beth', '11-12 girls', [makeEvent('50', 'Freestyle', [{ meetName: JEDI_TRIALS, resultSec: 29.0, result: '29.00S' }])]),
    makeAthlete('c', 'Older', 'Cara', '11-12 girls', [makeEvent('50', 'Freestyle', [{ meetName: JEDI_TRIALS, resultSec: 31.0, result: '31.00S' }])]),
  ];

  it('moves a flagged swimmer into the older event and re-ranks by time', () => {
    const swimUps = new Map([['a|50|Freestyle', 'Girls 11-12']]);
    const entries = getTopTimes(SU, MEETS, 0, swimUps);

    // The athlete's own 9-10 event is now empty (she moved out, no one left).
    expect(entries.filter(e => formatEventTitle(e.ageGroup, e.eventDistance, e.eventStroke) === 'Girls 9-10 50 Free')).toHaveLength(0);

    // She's ranked among the 11-12 swimmers by time: Beth 29, Ann 30, Cara 31.
    const eleven = entries
      .filter(e => formatEventTitle(e.ageGroup, e.eventDistance, e.eventStroke) === 'Girls 11-12 50 Free')
      .sort((x, y) => x.rank - y.rank);
    expect(eleven.map(e => `${e.rank}:${e.firstName}`)).toEqual(['1:Beth', '2:Ann', '3:Cara']);

    const ann = eleven.find(e => e.athleteId === 'a')!;
    expect(ann.swamUpFrom).toBe('Girls 9-10');
  });

  it('keeps a swim-up entry even when it falls outside top N', () => {
    const slow = [
      makeAthlete('a', 'Young', 'Ann', '9-10 girls', [makeEvent('50', 'Freestyle', [{ meetName: JEDI_TRIALS, resultSec: 40.0, result: '40.00S' }])]),
      SU[1], SU[2],
    ];
    const swimUps = new Map([['a|50|Freestyle', 'Girls 11-12']]);
    const entries = getTopTimes(slow, MEETS, 1, swimUps);

    // topN=1 keeps only Beth natively; Cara (rank 2) is cut, but the swim-up Ann (rank 3) stays.
    expect(entries.some(e => e.athleteId === 'b')).toBe(true);
    expect(entries.some(e => e.athleteId === 'c')).toBe(false);
    const ann = entries.find(e => e.athleteId === 'a')!;
    expect(ann.rank).toBe(3);
    expect(ann.swamUpFrom).toBe('Girls 9-10');
  });

  it('leaves entries unflagged when no swim-ups are given', () => {
    const entries = getTopTimes(SU, MEETS, 0);
    expect(entries.every(e => e.swamUpFrom === undefined)).toBe(true);
  });
});

// ── sortTopTimes ──────────────────────────────────────────────────────────────

function entry(overrides: Partial<TopTimeEntry> & Pick<TopTimeEntry, 'eventDistance' | 'eventStroke' | 'lastName' | 'firstName'>): TopTimeEntry {
  return {
    rank: 1, athleteId: 'a1', ageGroup: '9-10 boys', age: 10, result: '30.00S', resultSec: 30, meetName: JEDI_TRIALS, date: '06/14/25',
    ...overrides,
  };
}

describe('sortTopTimes — event distance', () => {
  it('sorts numerically ascending (25 before 50 before 100)', () => {
    const input = [
      entry({ eventDistance: '100', eventStroke: 'Freestyle', lastName: 'Solo', firstName: 'Han' }),
      entry({ eventDistance: '25',  eventStroke: 'Freestyle', lastName: 'Solo', firstName: 'Han' }),
      entry({ eventDistance: '50',  eventStroke: 'Freestyle', lastName: 'Solo', firstName: 'Han' }),
    ];
    expect(sortTopTimes(input).map(e => e.eventDistance)).toEqual(['25', '50', '100']);
  });
});

describe('sortTopTimes — stroke order within same distance', () => {
  it('orders Free → Back → Breast → Fly → IM', () => {
    const strokes = ['Individual Medley', 'Butterfly', 'Breaststroke', 'Backstroke', 'Freestyle'];
    const input = strokes.map(s => entry({ eventDistance: '100', eventStroke: s, lastName: 'Organa', firstName: 'Leia' }));
    expect(sortTopTimes(input).map(e => e.eventStroke))
      .toEqual(['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley']);
  });

  // SwimTopia's CSV uses abbreviated stroke names; these must order identically
  // to the full HyTek names (previously they all tied at the unknown-stroke rank).
  it('orders SwimTopia abbreviated strokes Free → Back → Breast → Fly → IM', () => {
    const strokes = ['IM', 'Fly', 'Breast', 'Back', 'Free'];
    const input = strokes.map(s => entry({ eventDistance: '50', eventStroke: s, lastName: 'Organa', firstName: 'Leia' }));
    expect(sortTopTimes(input).map(e => e.eventStroke))
      .toEqual(['Free', 'Back', 'Breast', 'Fly', 'IM']);
  });
});

describe('sortTopTimes — athlete name within same event', () => {
  it('sorts by last name ascending', () => {
    const input = [
      entry({ eventDistance: '50', eventStroke: 'Freestyle', lastName: 'Vader',     firstName: 'Anakin' }),
      entry({ eventDistance: '50', eventStroke: 'Freestyle', lastName: 'Skywalker', firstName: 'Luke' }),
      entry({ eventDistance: '50', eventStroke: 'Freestyle', lastName: 'Organa',    firstName: 'Leia' }),
    ];
    expect(sortTopTimes(input).map(e => e.lastName)).toEqual(['Organa', 'Skywalker', 'Vader']);
  });

  it('sorts by first name when last names are equal', () => {
    const input = [
      entry({ eventDistance: '50', eventStroke: 'Freestyle', lastName: 'Fett', firstName: 'Zam' }),
      entry({ eventDistance: '50', eventStroke: 'Freestyle', lastName: 'Fett', firstName: 'Boba' }),
    ];
    expect(sortTopTimes(input).map(e => e.firstName)).toEqual(['Boba', 'Zam']);
  });
});

describe('sortTopTimes — custom sort orders', () => {
  it('name → event → age: primary sort is athlete last name', () => {
    const input = [
      entry({ eventDistance: '50',  eventStroke: 'Freestyle',  lastName: 'Vader',     firstName: 'Anakin', ageGroup: '11-12 boys' }),
      entry({ eventDistance: '25',  eventStroke: 'Backstroke', lastName: 'Organa',    firstName: 'Leia',   ageGroup: '9-10 girls' }),
      entry({ eventDistance: '50',  eventStroke: 'Freestyle',  lastName: 'Skywalker', firstName: 'Luke',   ageGroup: '11-12 boys' }),
    ];
    expect(sortTopTimes(input, ['name', 'event', 'age']).map(e => e.lastName))
      .toEqual(['Organa', 'Skywalker', 'Vader']);
  });

  it('age → event → name: groups by age group, then event within each group', () => {
    const input = [
      entry({ eventDistance: '50', eventStroke: 'Freestyle', lastName: 'Fett',      firstName: 'Boba', ageGroup: '11-12 boys' }),
      entry({ eventDistance: '50', eventStroke: 'Freestyle', lastName: 'Skywalker', firstName: 'Luke', ageGroup: '9-10 boys'  }),
      entry({ eventDistance: '25', eventStroke: 'Freestyle', lastName: 'Solo',      firstName: 'Han',  ageGroup: '11-12 boys' }),
    ];
    expect(sortTopTimes(input, ['age', 'event', 'name']).map(e => `${e.ageGroup} ${e.eventDistance} ${e.lastName}`))
      .toEqual([
        '9-10 boys 50 Skywalker',
        '11-12 boys 25 Solo',
        '11-12 boys 50 Fett',
      ]);
  });

  it('age → name → event: groups by age group, then alphabetical within each group', () => {
    const input = [
      entry({ eventDistance: '100', eventStroke: 'Freestyle',  lastName: 'Amidala', firstName: 'Padmé',  ageGroup: '11-12 girls' }),
      entry({ eventDistance: '50',  eventStroke: 'Freestyle',  lastName: 'Tano',    firstName: 'Ahsoka', ageGroup: '9-10 girls'  }),
      entry({ eventDistance: '50',  eventStroke: 'Backstroke', lastName: 'Ackbar',  firstName: 'Gial',   ageGroup: '11-12 girls' }),
    ];
    expect(sortTopTimes(input, ['age', 'name', 'event']).map(e => `${e.ageGroup} ${e.lastName}`))
      .toEqual([
        '9-10 girls Tano',
        '11-12 girls Ackbar',
        '11-12 girls Amidala',
      ]);
  });

  it('age groups sort in full canonical order (8 & under → 9-10 → 11-12 → 13-14 → 15-18)', () => {
    const input = [
      entry({ eventDistance: '25', eventStroke: 'Freestyle', lastName: 'Djarin',  firstName: 'Din',     ageGroup: '15-18 men'       }),
      entry({ eventDistance: '25', eventStroke: 'Freestyle', lastName: 'Kenobi',  firstName: 'Obi-Wan', ageGroup: '11-12 boys'      }),
      entry({ eventDistance: '25', eventStroke: 'Freestyle', lastName: 'Kryze',   firstName: 'Bo',      ageGroup: '9-10 girls'      }),
      entry({ eventDistance: '25', eventStroke: 'Freestyle', lastName: 'Tano',    firstName: 'Ahsoka',  ageGroup: '13-14 girls'     }),
      entry({ eventDistance: '25', eventStroke: 'Freestyle', lastName: 'Fett',    firstName: 'Boba',    ageGroup: '8 & under boys'  }),
    ];
    expect(sortTopTimes(input, ['age', 'name', 'event']).map(e => e.ageGroup))
      .toEqual(['8 & under boys', '9-10 girls', '11-12 boys', '13-14 girls', '15-18 men']);
  });

  it('girls sort before boys within the same age range', () => {
    const input = [
      entry({ eventDistance: '50', eventStroke: 'Freestyle', lastName: 'Solo',  firstName: 'Han',  ageGroup: '9-10 boys'  }),
      entry({ eventDistance: '50', eventStroke: 'Freestyle', lastName: 'Tano',  firstName: 'Ahsoka', ageGroup: '9-10 girls' }),
    ];
    expect(sortTopTimes(input, ['age', 'name', 'event']).map(e => e.ageGroup))
      .toEqual(['9-10 girls', '9-10 boys']);
  });

  it('event → rank: groups by event, fastest first within each event', () => {
    const input = [
      entry({ eventDistance: '50', eventStroke: 'Freestyle',  rank: 2, lastName: 'Solo',      firstName: 'Han' }),
      entry({ eventDistance: '50', eventStroke: 'Backstroke', rank: 1, lastName: 'Organa',    firstName: 'Leia' }),
      entry({ eventDistance: '50', eventStroke: 'Freestyle',  rank: 1, lastName: 'Skywalker', firstName: 'Luke' }),
      entry({ eventDistance: '50', eventStroke: 'Backstroke', rank: 2, lastName: 'Fett',      firstName: 'Boba' }),
    ];
    expect(sortTopTimes(input, ['event', 'rank', 'name']).map(e => `${e.eventStroke} ${e.rank}`))
      .toEqual(['Freestyle 1', 'Freestyle 2', 'Backstroke 1', 'Backstroke 2']);
  });

  it("event → rank keeps same-distance/stroke age groups separate (no interleave)", () => {
    // Without the age-group term in the 'event' comparator these would interleave
    // by rank and fragment the grouped PDF.
    const input = [
      entry({ eventDistance: '50', eventStroke: 'Freestyle', rank: 1, lastName: 'Solo',  firstName: 'Han',    ageGroup: '9-10 boys'  }),
      entry({ eventDistance: '50', eventStroke: 'Freestyle', rank: 1, lastName: 'Tano',  firstName: 'Ahsoka', ageGroup: '9-10 girls' }),
      entry({ eventDistance: '50', eventStroke: 'Freestyle', rank: 2, lastName: 'Kryze', firstName: 'Bo',     ageGroup: '9-10 girls' }),
      entry({ eventDistance: '50', eventStroke: 'Freestyle', rank: 2, lastName: 'Vader', firstName: 'Anakin', ageGroup: '9-10 boys'  }),
    ];
    expect(sortTopTimes(input, ['event', 'rank', 'name']).map(e => `${e.ageGroup} ${e.rank}`))
      .toEqual(['9-10 girls 1', '9-10 girls 2', '9-10 boys 1', '9-10 boys 2']);
  });
});

describe('sortTopTimes — combined ordering (default: event → name → age)', () => {
  it('groups by event before applying name sort', () => {
    const input = [
      entry({ eventDistance: '100', eventStroke: 'Freestyle',  lastName: 'Ackbar', firstName: 'Gial' }),
      entry({ eventDistance: '50',  eventStroke: 'Backstroke', lastName: 'Solo',   firstName: 'Han' }),
      entry({ eventDistance: '50',  eventStroke: 'Freestyle',  lastName: 'Vader',  firstName: 'Anakin' }),
      entry({ eventDistance: '50',  eventStroke: 'Freestyle',  lastName: 'Fett',   firstName: 'Boba' }),
    ];
    expect(sortTopTimes(input).map(e => `${e.eventDistance} ${e.eventStroke} ${e.lastName}`))
      .toEqual([
        '50 Freestyle Fett',
        '50 Freestyle Vader',
        '50 Backstroke Solo',
        '100 Freestyle Ackbar',
      ]);
  });
});
