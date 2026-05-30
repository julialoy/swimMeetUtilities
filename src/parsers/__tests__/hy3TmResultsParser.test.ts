import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseHy3, type Hy3ParseResult } from '../hy3TmResultsParser';

const FIXTURE = join(
  import.meta.dirname,
  'fixutres',
  'test_meet.hy3'
);

function loadFixture(path: string): File {
  const buffer = readFileSync(path);
  return new File([buffer], 'test.hy3');
}

describe('parseHy3 — synthetic fixture', () => {
  let result: Hy3ParseResult;

  beforeAll(async () => {
    result = await parseHy3(loadFixture(FIXTURE));
  });

  // ── Top-level result shape ──────────────────────────────────────────────

  it('returns a non-null meet', () => {
    expect(result.meet).not.toBeNull();
  });

  it('produces no parse errors', () => {
    expect(result.errors).toHaveLength(0);
  });

  // ── Meet info (B1 record) ──────────────────────────────────────────────

  describe('meetInfo', () => {
    it('parses meet name', () => {
      expect(result.meet?.meetInfo.meetName).toBe('Tatooine vs Coruscant Week 1 2025');
    });

    it('parses facility', () => {
      expect(result.meet?.meetInfo.facility).toBe('Jedi Temple Pool');
    });

    it('parses start date', () => {
      expect(result.meet?.meetInfo.startDate).toBe('2025-06-01');
    });

    it('parses end date', () => {
      expect(result.meet?.meetInfo.endDate).toBe('2025-06-01');
    });

    it('parses subtitle from B2 record', () => {
      expect(result.meet?.meetInfo.meetSubtitle).toBe('Away');
    });
  });

  // ── Teams (C1 records) ─────────────────────────────────────────────────

  describe('teams', () => {
    it('finds 2 teams', () => {
      expect(result.meet?.teams).toHaveLength(2);
    });

    it('parses JDA team fields', () => {
      const jda = result.meet!.teams[0];
      expect(jda.teamCode).toBe('JDA');
      expect(jda.teamName).toBe('Jedi Academy');
      expect(jda.lscCode).toBe('PV');
    });

    it('parses SSL team fields', () => {
      const ssl = result.meet!.teams[1];
      expect(ssl.teamCode).toBe('SSL');
      expect(ssl.teamName).toBe('Sith Swim League');
      expect(ssl.lscCode).toBe('PV');
    });

    it('attaches swimmers to the correct team', () => {
      expect(result.meet!.teams[0].swimmers.length).toBeGreaterThan(0);
      expect(result.meet!.teams[1].swimmers.length).toBeGreaterThan(0);
    });
  });

  // ── Swimmers (D1 records) ──────────────────────────────────────────────

  describe('swimmers', () => {
    it('parses first JDA swimmer — Luke Skywalker', () => {
      const s = result.meet!.teams[0].swimmers[0];
      expect(s.lastName).toBe('Skywalker');
      expect(s.firstName).toBe('Luke');
      expect(s.gender).toBe('M');
      expect(s.swimmerId).toBe('1001');
    });

    it('parses birth date for Skywalker', () => {
      const s = result.meet!.teams[0].swimmers[0];
      expect(s.birthDate).toBe('2015-03-15');
    });

    it('parses age for Skywalker', () => {
      const s = result.meet!.teams[0].swimmers[0];
      expect(s.age).toBe(10);
    });

    it('carries team info onto each swimmer', () => {
      const s = result.meet!.teams[0].swimmers[0];
      expect(s.teamCode).toBe('JDA');
      expect(s.teamName).toBe('Jedi Academy');
    });

    it('parses preferred name when present', () => {
      const s = result.meet!.teams[0].swimmers[0];
      expect(s.preferredName).toBe('Luke');
    });
  });

  // ── Individual entries (E1 + E2 record pairs) ─────────────────────────

  describe('individualEntries', () => {
    it('collects individual entries', () => {
      expect(result.meet!.individualEntries.length).toBeGreaterThan(0);
    });

    it('Skywalker has 3 individual entries', () => {
      const entries = result.meet!.individualEntries.filter(
        e => e.swimmer.swimmerId === '1001'
      );
      expect(entries).toHaveLength(3);
    });

    it('marks non-DQ entries as not disqualified', () => {
      const entries = result.meet!.individualEntries.filter(
        e => e.swimmer.swimmerId === '1001'
      );
      expect(entries.every(e => !e.isDisqualified)).toBe(true);
    });

    it('marks DQ entry as disqualified — Leia Organa 25A', () => {
      const entries = result.meet!.individualEntries.filter(
        e => e.swimmer.lastName === 'Organa' && e.swimmer.firstName === 'Leia'
      );
      const dq = entries.find(e => e.eventCode === '25A');
      expect(dq?.isDisqualified).toBe(true);
    });

    it('parses event code for Skywalker 50A', () => {
      const entry = result.meet!.individualEntries.find(
        e => e.swimmer.swimmerId === '1001' && e.eventCode === '50A'
      );
      expect(entry).toBeDefined();
    });

    it('parses min/max age for Skywalker 50A (9–10 age group)', () => {
      const entry = result.meet!.individualEntries.find(
        e => e.swimmer.swimmerId === '1001' && e.eventCode === '50A'
      );
      expect(entry?.minAge).toBe(9);
      expect(entry?.maxAge).toBe(10);
    });

    it('parses finish place for Skywalker 50A', () => {
      const entry = result.meet!.individualEntries.find(
        e => e.swimmer.swimmerId === '1001' && e.eventCode === '50A'
      );
      expect(entry?.finishPlace).toBe(9);
    });

    it('parses points scored', () => {
      const entry = result.meet!.individualEntries.find(
        e => e.swimmer.swimmerId === '1001' && e.eventCode === '25B'
      );
      expect(entry?.pointsScored).toBe(3.0);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns null meet on unreadable file', async () => {
      const badFile = {
        text: () => Promise.reject(new Error('disk error')),
      } as unknown as File;
      const r = await parseHy3(badFile);
      expect(r.meet).toBeNull();
      expect(r.errors).toEqual(['Failed to read file']);
    });

    it('returns an empty meet for an empty file', async () => {
      const r = await parseHy3(new File([''], 'empty.hy3'));
      expect(r.meet).not.toBeNull();
      expect(r.meet!.teams).toHaveLength(0);
      expect(r.meet!.individualEntries).toHaveLength(0);
    });
  });
});
