import { describe, it, expect } from 'vitest';
import { sortLabels } from '../awardLabelSort';
import type { AwardLabel, ImprovementLabel } from '../../types';

// ── Fixture helpers ───────────────────────────────────────────────────────────

function award(overrides: Partial<AwardLabel> & Pick<AwardLabel, 'place' | 'eventNumber' | 'lastName' | 'firstName' | 'date'>): AwardLabel {
  return {
    placeOrdinal:     `${overrides.place}th`,
    finishTime:       '1:00.00',
    eventDescription: 'Test Event',
    age:              12,
    team:             'Jedi',
    meetName:         'Bespin Meet',
    ...overrides,
  };
}

function improvement(overrides: Partial<ImprovementLabel> & Pick<ImprovementLabel, 'eventNumber' | 'lastName' | 'firstName' | 'date'>): ImprovementLabel {
  return {
    eventDescription: 'Test Event',
    age:              12,
    personalBestTime: '1:00.00',
    improvement:      -5.00,
    team:             'Jedi',
    meetName:         'Bespin Meet',
    ...overrides,
  };
}

describe('sortLabels — name', () => {
  it('sorts by lastName then firstName', () => {
    const labels = [
      award({ place: 1, eventNumber: '1', lastName: 'Vader',  firstName: 'Zam', date: 'Jun 25, 2025' }),
      award({ place: 2, eventNumber: '1', lastName: 'Ackbar', firstName: 'Bib', date: 'Jun 25, 2025' }),
      award({ place: 3, eventNumber: '1', lastName: 'Ackbar', firstName: 'Adi', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'name');
    expect(sorted.map(l => `${l.lastName},${l.firstName}`)).toEqual([
      'Ackbar,Adi',
      'Ackbar,Bib',
      'Vader,Zam',
    ]);
  });

  it('does not mutate the original array', () => {
    const labels = [
      award({ place: 2, eventNumber: '1', lastName: 'Vader',  firstName: 'A', date: 'Jun 25, 2025' }),
      award({ place: 1, eventNumber: '1', lastName: 'Ackbar', firstName: 'B', date: 'Jun 25, 2025' }),
    ];
    const original = [...labels];
    sortLabels(labels, 'name');
    expect(labels[0].lastName).toBe(original[0].lastName);
  });

  it('returns empty array for empty input', () => {
    expect(sortLabels([], 'name')).toEqual([]);
  });
});

describe('sortLabels — event', () => {
  it('sorts numeric event numbers in ascending order', () => {
    const labels = [
      award({ place: 1, eventNumber: '10', lastName: 'Calrissian', firstName: 'Lando', date: 'Jun 25, 2025' }),
      award({ place: 1, eventNumber: '2',  lastName: 'Antilles',   firstName: 'Wedge', date: 'Jun 25, 2025' }),
      award({ place: 1, eventNumber: '1',  lastName: 'Bridger',    firstName: 'Ezra',  date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'event');
    expect(sorted.map(l => l.eventNumber)).toEqual(['1', '2', '10']);
  });

  it('sorts letter suffixes alphabetically within the same base number', () => {
    const labels = [
      award({ place: 1, eventNumber: '7B', lastName: 'Bridger',    firstName: 'Ezra',  date: 'Jun 25, 2025' }),
      award({ place: 1, eventNumber: '7A', lastName: 'Antilles',   firstName: 'Wedge', date: 'Jun 25, 2025' }),
      award({ place: 1, eventNumber: '7C', lastName: 'Calrissian', firstName: 'Lando', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'event');
    expect(sorted.map(l => l.eventNumber)).toEqual(['7A', '7B', '7C']);
  });

  it('sorts plain numbers before suffixed numbers of the same value', () => {
    const labels = [
      award({ place: 1, eventNumber: '7B', lastName: 'Bridger',  firstName: 'Ezra',  date: 'Jun 25, 2025' }),
      award({ place: 1, eventNumber: '7',  lastName: 'Antilles', firstName: 'Wedge', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'event');
    expect(sorted.map(l => l.eventNumber)).toEqual(['7', '7B']);
  });

  it('sorts by place as secondary key within the same event', () => {
    const labels = [
      award({ place: 3, eventNumber: '1', lastName: 'Calrissian', firstName: 'Lando', date: 'Jun 25, 2025' }),
      award({ place: 1, eventNumber: '1', lastName: 'Antilles',   firstName: 'Wedge', date: 'Jun 25, 2025' }),
      award({ place: 2, eventNumber: '1', lastName: 'Bridger',    firstName: 'Ezra',  date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'event');
    expect(sorted.map(l => l.place)).toEqual([1, 2, 3]);
  });
});

describe('sortLabels — week', () => {
  it('sorts by date chronologically', () => {
    const labels = [
      award({ place: 1, eventNumber: '1', lastName: 'Bridger',    firstName: 'Ezra',  date: 'Jul 9, 2025' }),
      award({ place: 1, eventNumber: '1', lastName: 'Antilles',   firstName: 'Wedge', date: 'Jun 25, 2025' }),
      award({ place: 1, eventNumber: '1', lastName: 'Calrissian', firstName: 'Lando', date: 'Jul 2, 2025' }),
    ];
    const sorted = sortLabels(labels, 'week');
    expect(sorted.map(l => l.date)).toEqual(['Jun 25, 2025', 'Jul 2, 2025', 'Jul 9, 2025']);
  });

  it('sorts by event number as secondary key within the same date', () => {
    const labels = [
      award({ place: 1, eventNumber: '3', lastName: 'Bridger',  firstName: 'Ezra',  date: 'Jun 25, 2025' }),
      award({ place: 1, eventNumber: '1', lastName: 'Antilles', firstName: 'Wedge', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'week');
    expect(sorted.map(l => l.eventNumber)).toEqual(['1', '3']);
  });

  it('sorts by place as tertiary key within the same date and event', () => {
    const labels = [
      award({ place: 3, eventNumber: '1', lastName: 'Calrissian', firstName: 'Lando', date: 'Jun 25, 2025' }),
      award({ place: 1, eventNumber: '1', lastName: 'Antilles',   firstName: 'Wedge', date: 'Jun 25, 2025' }),
      award({ place: 2, eventNumber: '1', lastName: 'Bridger',    firstName: 'Ezra',  date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'week');
    expect(sorted.map(l => l.place)).toEqual([1, 2, 3]);
  });
});

// ── sortLabels — improvement labels only ──────────────────────────────────────

describe('sortLabels — improvement labels only', () => {
  it('sorts by name', () => {
    const labels = [
      improvement({ eventNumber: '1', lastName: 'Vader',    firstName: 'Zam', date: 'Jun 25, 2025' }),
      improvement({ eventNumber: '1', lastName: 'Skywalker', firstName: 'Luke', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'name');
    expect(sorted.map(l => l.lastName)).toEqual(['Skywalker', 'Vader']);
  });

  it('sorts by event number', () => {
    const labels = [
      improvement({ eventNumber: '10', lastName: 'Vader',    firstName: 'Zam',  date: 'Jun 25, 2025' }),
      improvement({ eventNumber: '2',  lastName: 'Organa',   firstName: 'Leia', date: 'Jun 25, 2025' }),
      improvement({ eventNumber: '1',  lastName: 'Skywalker',firstName: 'Luke', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'event');
    expect(sorted.map(l => l.eventNumber)).toEqual(['1', '2', '10']);
  });

  it('sorts by name within the same event', () => {
    const labels = [
      improvement({ eventNumber: '1', lastName: 'Solo',      firstName: 'Han',  date: 'Jun 25, 2025' }),
      improvement({ eventNumber: '1', lastName: 'Organa',    firstName: 'Leia', date: 'Jun 25, 2025' }),
      improvement({ eventNumber: '1', lastName: 'Skywalker', firstName: 'Luke', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'event');
    expect(sorted.map(l => l.lastName)).toEqual(['Organa', 'Skywalker', 'Solo']);
  });

  it('sorts by week then event', () => {
    const labels = [
      improvement({ eventNumber: '3', lastName: 'Solo',      firstName: 'Han',  date: 'Jun 25, 2025' }),
      improvement({ eventNumber: '1', lastName: 'Skywalker', firstName: 'Luke', date: 'Jul 2, 2025' }),
      improvement({ eventNumber: '1', lastName: 'Organa',    firstName: 'Leia', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'week');
    expect(sorted.map(l => `${l.date}/#${l.eventNumber}/${l.lastName}`)).toEqual([
      'Jun 25, 2025/#1/Organa',
      'Jun 25, 2025/#3/Solo',
      'Jul 2, 2025/#1/Skywalker',
    ]);
  });
});

// ── sortLabels — mixed award + improvement ────────────────────────────────────

describe('sortLabels — mixed award and improvement labels', () => {
  it('sorts mixed labels by name regardless of type', () => {
    const labels = [
      award(      { place: 1, eventNumber: '1', lastName: 'Vader',     firstName: 'Zam',  date: 'Jun 25, 2025' }),
      improvement({           eventNumber: '1', lastName: 'Skywalker', firstName: 'Luke', date: 'Jun 25, 2025' }),
      award(      { place: 2, eventNumber: '1', lastName: 'Organa',    firstName: 'Leia', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'name');
    expect(sorted.map(l => l.lastName)).toEqual(['Organa', 'Skywalker', 'Vader']);
  });

  it('event sort: award labels appear before improvement labels for the same event', () => {
    const labels = [
      improvement({           eventNumber: '1', lastName: 'Solo',   firstName: 'Han',  date: 'Jun 25, 2025' }),
      award(      { place: 2, eventNumber: '1', lastName: 'Organa', firstName: 'Leia', date: 'Jun 25, 2025' }),
      award(      { place: 1, eventNumber: '1', lastName: 'Vader',  firstName: 'Zam',  date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'event');
    // 1st place award, 2nd place award, then improvement label
    expect(sorted[0]).toMatchObject({ lastName: 'Vader' });
    expect(sorted[1]).toMatchObject({ lastName: 'Organa' });
    expect(sorted[2]).toMatchObject({ lastName: 'Solo' });
  });

  it('event sort: improvement labels within the same event are sorted by name', () => {
    const labels = [
      improvement({           eventNumber: '1', lastName: 'Solo',      firstName: 'Han',  date: 'Jun 25, 2025' }),
      improvement({           eventNumber: '1', lastName: 'Organa',    firstName: 'Leia', date: 'Jun 25, 2025' }),
      award(      { place: 1, eventNumber: '1', lastName: 'Skywalker', firstName: 'Luke', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'event');
    expect(sorted.map(l => l.lastName)).toEqual(['Skywalker', 'Organa', 'Solo']);
  });

  it('event sort: different events are ordered by event number before label type', () => {
    const labels = [
      improvement({           eventNumber: '2', lastName: 'Solo',      firstName: 'Han',  date: 'Jun 25, 2025' }),
      award(      { place: 1, eventNumber: '3', lastName: 'Vader',     firstName: 'Zam',  date: 'Jun 25, 2025' }),
      award(      { place: 1, eventNumber: '1', lastName: 'Skywalker', firstName: 'Luke', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'event');
    expect(sorted.map(l => l.eventNumber)).toEqual(['1', '2', '3']);
  });

  it('week sort: groups by date then event, award labels before improvement within same event', () => {
    const labels = [
      improvement({           eventNumber: '1', lastName: 'Solo',      firstName: 'Han',  date: 'Jun 25, 2025' }),
      award(      { place: 1, eventNumber: '1', lastName: 'Skywalker', firstName: 'Luke', date: 'Jul 2, 2025' }),
      award(      { place: 1, eventNumber: '1', lastName: 'Organa',    firstName: 'Leia', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortLabels(labels, 'week');
    expect(sorted[0]).toMatchObject({ date: 'Jun 25, 2025', lastName: 'Organa' }); // award label first
    expect(sorted[1]).toMatchObject({ date: 'Jun 25, 2025', lastName: 'Solo' });   // improvement label after
    expect(sorted[2]).toMatchObject({ date: 'Jul 2, 2025',  lastName: 'Skywalker' });
  });

  it('preserves type information — returned array contains original objects', () => {
    const aw = award(       { place: 1, eventNumber: '1', lastName: 'Skywalker', firstName: 'Luke', date: 'Jun 25, 2025' });
    const im = improvement({            eventNumber: '1', lastName: 'Solo',      firstName: 'Han',  date: 'Jun 25, 2025' });
    const sorted = sortLabels([im, aw], 'name');
    // Skywalker < Solo alphabetically
    expect(sorted[0]).toBe(aw);
    expect(sorted[1]).toBe(im);
    // Type guard still works on the returned items
    expect('place' in sorted[0]).toBe(true);
    expect('improvement' in sorted[1]).toBe(true);
  });
});
