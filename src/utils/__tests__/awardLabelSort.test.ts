import { describe, it, expect } from 'vitest';
import { sortAwardLabels } from '../awardLabelSort';
import type { AwardLabel } from '../../types';

// ── Fixture helpers ───────────────────────────────────────────────────────────

function label(overrides: Partial<AwardLabel> & Pick<AwardLabel, 'place' | 'eventNumber' | 'lastName' | 'firstName' | 'date'>): AwardLabel {
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

// ── Sort by name ──────────────────────────────────────────────────────────────

describe('sortAwardLabels — name', () => {
  it('sorts by lastName then firstName', () => {
    const labels = [
      label({ place: 1, eventNumber: '1', lastName: 'Vader',  firstName: 'Zam', date: 'Jun 25, 2025' }),
      label({ place: 2, eventNumber: '1', lastName: 'Ackbar', firstName: 'Bib', date: 'Jun 25, 2025' }),
      label({ place: 3, eventNumber: '1', lastName: 'Ackbar', firstName: 'Adi', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortAwardLabels(labels, 'name');
    expect(sorted.map(l => `${l.lastName},${l.firstName}`)).toEqual([
      'Ackbar,Adi',
      'Ackbar,Bib',
      'Vader,Zam',
    ]);
  });

  it('does not mutate the original array', () => {
    const labels = [
      label({ place: 2, eventNumber: '1', lastName: 'Vader',  firstName: 'A', date: 'Jun 25, 2025' }),
      label({ place: 1, eventNumber: '1', lastName: 'Ackbar', firstName: 'B', date: 'Jun 25, 2025' }),
    ];
    const original = [...labels];
    sortAwardLabels(labels, 'name');
    expect(labels[0].lastName).toBe(original[0].lastName);
  });

  it('returns empty array for empty input', () => {
    expect(sortAwardLabels([], 'name')).toEqual([]);
  });
});

// ── Sort by event ─────────────────────────────────────────────────────────────

describe('sortAwardLabels — event', () => {
  it('sorts numeric event numbers in ascending order', () => {
    const labels = [
      label({ place: 1, eventNumber: '10', lastName: 'Calrissian', firstName: 'Lando', date: 'Jun 25, 2025' }),
      label({ place: 1, eventNumber: '2',  lastName: 'Antilles',   firstName: 'Wedge', date: 'Jun 25, 2025' }),
      label({ place: 1, eventNumber: '1',  lastName: 'Bridger',    firstName: 'Ezra',  date: 'Jun 25, 2025' }),
    ];
    const sorted = sortAwardLabels(labels, 'event');
    expect(sorted.map(l => l.eventNumber)).toEqual(['1', '2', '10']);
  });

  it('sorts letter suffixes alphabetically within the same base number', () => {
    const labels = [
      label({ place: 1, eventNumber: '7B', lastName: 'Bridger',    firstName: 'Ezra',  date: 'Jun 25, 2025' }),
      label({ place: 1, eventNumber: '7A', lastName: 'Antilles',   firstName: 'Wedge', date: 'Jun 25, 2025' }),
      label({ place: 1, eventNumber: '7C', lastName: 'Calrissian', firstName: 'Lando', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortAwardLabels(labels, 'event');
    expect(sorted.map(l => l.eventNumber)).toEqual(['7A', '7B', '7C']);
  });

  it('sorts plain numbers before suffixed numbers of the same value', () => {
    const labels = [
      label({ place: 1, eventNumber: '7B', lastName: 'Bridger',  firstName: 'Ezra',  date: 'Jun 25, 2025' }),
      label({ place: 1, eventNumber: '7',  lastName: 'Antilles', firstName: 'Wedge', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortAwardLabels(labels, 'event');
    expect(sorted.map(l => l.eventNumber)).toEqual(['7', '7B']);
  });

  it('sorts by place as secondary key within the same event', () => {
    const labels = [
      label({ place: 3, eventNumber: '1', lastName: 'Calrissian', firstName: 'Lando', date: 'Jun 25, 2025' }),
      label({ place: 1, eventNumber: '1', lastName: 'Antilles',   firstName: 'Wedge', date: 'Jun 25, 2025' }),
      label({ place: 2, eventNumber: '1', lastName: 'Bridger',    firstName: 'Ezra',  date: 'Jun 25, 2025' }),
    ];
    const sorted = sortAwardLabels(labels, 'event');
    expect(sorted.map(l => l.place)).toEqual([1, 2, 3]);
  });
});

// ── Sort by week ──────────────────────────────────────────────────────────────

describe('sortAwardLabels — week', () => {
  it('sorts by date chronologically', () => {
    const labels = [
      label({ place: 1, eventNumber: '1', lastName: 'Bridger',    firstName: 'Ezra',  date: 'Jul 9, 2025' }),
      label({ place: 1, eventNumber: '1', lastName: 'Antilles',   firstName: 'Wedge', date: 'Jun 25, 2025' }),
      label({ place: 1, eventNumber: '1', lastName: 'Calrissian', firstName: 'Lando', date: 'Jul 2, 2025' }),
    ];
    const sorted = sortAwardLabels(labels, 'week');
    expect(sorted.map(l => l.date)).toEqual(['Jun 25, 2025', 'Jul 2, 2025', 'Jul 9, 2025']);
  });

  it('sorts by event number as secondary key within the same date', () => {
    const labels = [
      label({ place: 1, eventNumber: '3', lastName: 'Bridger',  firstName: 'Ezra',  date: 'Jun 25, 2025' }),
      label({ place: 1, eventNumber: '1', lastName: 'Antilles', firstName: 'Wedge', date: 'Jun 25, 2025' }),
    ];
    const sorted = sortAwardLabels(labels, 'week');
    expect(sorted.map(l => l.eventNumber)).toEqual(['1', '3']);
  });

  it('sorts by place as tertiary key within the same date and event', () => {
    const labels = [
      label({ place: 3, eventNumber: '1', lastName: 'Calrissian', firstName: 'Lando', date: 'Jun 25, 2025' }),
      label({ place: 1, eventNumber: '1', lastName: 'Antilles',   firstName: 'Wedge', date: 'Jun 25, 2025' }),
      label({ place: 2, eventNumber: '1', lastName: 'Bridger',    firstName: 'Ezra',  date: 'Jun 25, 2025' }),
    ];
    const sorted = sortAwardLabels(labels, 'week');
    expect(sorted.map(l => l.place)).toEqual([1, 2, 3]);
  });
});
