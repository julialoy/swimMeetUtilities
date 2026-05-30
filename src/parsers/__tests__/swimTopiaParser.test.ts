import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSwimTopiaReportCard } from '../swimTopiaParser';
import type { SwimTopiaReportCard } from '../../types';

const FIXTURE = join(
  import.meta.dirname,
  'fixutres',
  'test_report_card.csv'
);

function loadFixture(path: string): File {
  const buffer = readFileSync(path);
  return new File([buffer], 'report.csv');
}

describe('parseSwimTopiaReportCard — synthetic fixture', () => {
  let result: SwimTopiaReportCard;

  beforeAll(async () => {
    result = await parseSwimTopiaReportCard(loadFixture(FIXTURE));
  });

  // ── Top-level result shape ──────────────────────────────────────────────

  it('produces no parse errors', () => {
    expect(result.errors).toHaveLength(0);
  });

  it('returns a non-empty athletes array', () => {
    expect(result.athletes.length).toBeGreaterThan(0);
  });

  it('finds 2 athletes', () => {
    expect(result.athletes).toHaveLength(2);
  });

  // ── First athlete (Luke Skywalker) ─────────────────────────────────────

  describe('first athlete — Luke Skywalker', () => {
    it('parses athlete identity fields', () => {
      const a = result.athletes[0];
      expect(a.athleteId).toBe('1001001');
      expect(a.lastName).toBe('Skywalker');
      expect(a.firstName).toBe('Luke');
    });

    it('parses age and age group', () => {
      const a = result.athletes[0];
      expect(a.age).toBe(10);
      expect(a.ageGroup).toBe('09-10 Boys');
    });

    it('has 3 events', () => {
      expect(result.athletes[0].events).toHaveLength(3);
    });
  });

  // ── Skywalker event summaries ──────────────────────────────────────────

  describe('Skywalker event summaries', () => {
    it('first event is 50 Free', () => {
      const ev = result.athletes[0].events[0];
      expect(ev.eventDistance).toBe('50');
      expect(ev.eventStroke).toBe('Free');
    });

    it('50 Free summary stats', () => {
      const ev = result.athletes[0].events[0];
      expect(ev.totalResults).toBe(3);
      expect(ev.totalImproved).toBe(2);
      expect(ev.totalPoints).toBe(4.0);
      expect(ev.amountImprovedSec).toBe(3.0);
      expect(ev.percentImproved).toBe(10.0);
    });

    it('25 Back summary stats', () => {
      const ev = result.athletes[0].events[1];
      expect(ev.eventDistance).toBe('25');
      expect(ev.eventStroke).toBe('Back');
      expect(ev.totalResults).toBe(2);
      expect(ev.totalImproved).toBe(1);
      expect(ev.totalPoints).toBe(3.0);
      expect(ev.amountImprovedSec).toBe(1.0);
      expect(ev.percentImproved).toBe(4.0);
    });

    it('25 Breast summary stats (swam only at Jedi Trials)', () => {
      const ev = result.athletes[0].events[2];
      expect(ev.eventDistance).toBe('25');
      expect(ev.eventStroke).toBe('Breast');
      expect(ev.totalResults).toBe(1);
      expect(ev.totalImproved).toBe(0);
      expect(ev.totalPoints).toBe(0);
      expect(ev.amountImprovedSec).toBe(0);
      expect(ev.percentImproved).toBe(0);
    });
  });

  // ── Skywalker 50 Free meet results ────────────────────────────────────

  describe('Skywalker 50 Free meet results', () => {
    it('includes all 3 meets', () => {
      expect(result.athletes[0].events[0].meetResults).toHaveLength(3);
    });

    it('Meet 1 — Jedi Trials 2025 (no improvement flag on baseline)', () => {
      const m = result.athletes[0].events[0].meetResults[0];
      expect(m.meetName).toBe('Jedi Trials 2025');
      expect(m.result).toBe('30.00S');
      expect(m.resultSec).toBe(30.00);
      expect(m.improved).toBe(false);
      expect(m.points).toBe(0);
      expect(m.date).toBe('06/01/25');
    });

    it('Meet 2 — Week 1 (improved = true, points awarded)', () => {
      const m = result.athletes[0].events[0].meetResults[1];
      expect(m.meetName).toBe('Week 1 Home vs Sith');
      expect(m.result).toBe('28.00S');
      expect(m.resultSec).toBe(28.0);
      expect(m.improved).toBe(true);
      expect(m.points).toBe(2.0);
      expect(m.date).toBe('06/08/25');
    });

    it('Meet 3 — Week 2 (improved = true)', () => {
      const m = result.athletes[0].events[0].meetResults[2];
      expect(m.meetName).toBe('Week 2 Away vs Mandalore');
      expect(m.result).toBe('27.00S');
      expect(m.improved).toBe(true);
    });
  });

  // ── 25 Back — did-not-compete meet ────────────────────────────────────

  describe('Skywalker 25 Back meet results', () => {
    it('Meet 3 — did not compete, no result', () => {
      const m = result.athletes[0].events[1].meetResults[2];
      expect(m.meetName).toBe('Week 2 Away vs Mandalore');
      expect(m.result).toBe('');
      expect(m.resultSec).toBe(0);
      expect(m.improved).toBe(false);
    });
  });

  // ── Sub-minute vs over-minute result strings ───────────────────────────

  describe('result string formats', () => {
    it('parses a sub-minute result (e.g. 30.00S)', () => {
      const m = result.athletes[0].events[0].meetResults[0];
      expect(m.result).toBe('30.00S');
      expect(m.resultSec).toBeCloseTo(30.00);
    });

    it('parses an over-a-minute result (e.g. 1:07.69S) — Leia Organa 50 Breast', () => {
      const organa = result.athletes.find(a => a.athleteId === '1001002')!;
      const breast = organa.events.find(e => e.eventStroke === 'Breast')!;
      const m = breast.meetResults[0]; // Jedi Trials
      expect(m.result).toBe('1:07.69S');
      expect(m.resultSec).toBeCloseTo(67.69);
    });
  });

  // ── Second athlete spot-check (Leia Organa) ───────────────────────────

  describe('second athlete — Leia Organa', () => {
    it('parses identity and age group', () => {
      const a = result.athletes.find(a => a.athleteId === '1001002')!;
      expect(a.lastName).toBe('Organa');
      expect(a.firstName).toBe('Leia');
      expect(a.age).toBe(11);
      expect(a.ageGroup).toBe('11-12 Girls');
    });

    it('has 1 event', () => {
      const a = result.athletes.find(a => a.athleteId === '1001002')!;
      expect(a.events).toHaveLength(1);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns empty athletes for an empty file', async () => {
      const r = await parseSwimTopiaReportCard(new File([''], 'empty.csv'));
      expect(r.athletes).toHaveLength(0);
    });

    it('returns empty athletes for a header-only file', async () => {
      const header = 'AgeGroup,AthleteId,LastName,FirstName,LastName_FirstName,Age,EventDistance,EventStroke\n';
      const r = await parseSwimTopiaReportCard(new File([header], 'header-only.csv'));
      expect(r.athletes).toHaveLength(0);
    });
  });
});
