import type { AwardLabel } from '../types';

// ── Regex patterns ────────────────────────────────────────────────────────────

const PLACE_RE   = /^(\w+)\s+Place\s+Time:\s+(.+)$/i;
const EVENT_RE   = /^#(\w+)\s+(.+)$/;
const SWIMMER_RE = /^(.+),\s*(.+?)\s+\((\d+)\)$/;
const TEAM_RE    = /^(.+?)\s+[–—-]\s+(.+)$/;

const LINES_PER_LABEL = 5;

function parseOrdinalToNumber(s: string): number {
  return parseInt(s.replace(/\D+/g, ''), 10) || 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parses one column's 5 text lines into an AwardLabel.
 * Returns null if any line is empty or a regex fails to match.
 *
 * Line order:
 *   0: {placeOrdinal} Place Time: {finishTime}
 *   1: #{eventNumber} {eventDescription}
 *   2: {lastName}, {firstName} ({age})
 *   3: {team} – {date}
 *   4: {meetName}
 */
export function parseLabelLines(lines: string[]): AwardLabel | null {
  if (lines.length < LINES_PER_LABEL) return null;
  if (lines.some(l => !l)) return null;

  const placeM   = lines[0].match(PLACE_RE);
  const eventM   = lines[1].match(EVENT_RE);
  const swimmerM = lines[2].match(SWIMMER_RE);
  const teamM    = lines[3].match(TEAM_RE);

  if (!placeM || !eventM || !swimmerM || !teamM) return null;

  return {
    place:            parseOrdinalToNumber(placeM[1]),
    placeOrdinal:     placeM[1],
    finishTime:       placeM[2].trim(),
    eventNumber:      eventM[1],
    eventDescription: eventM[2].trim(),
    lastName:         swimmerM[1].trim(),
    firstName:        swimmerM[2].trim(),
    age:              parseInt(swimmerM[3], 10),
    team:             teamM[1].trim(),
    date:             teamM[2].trim(),
    meetName:         lines[4].trim(),
  };
}
