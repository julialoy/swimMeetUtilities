import type { ImprovementLabel } from '../types';
import { resolveLigatures } from './ligatures';

// ── Regex patterns ────────────────────────────────────────────────────────────

const EVENT_RE   = /^#(\w+)\s+(.+)$/;
const SWIMMER_RE = /^(.+),\s*(.+?)\s+\((\d+)\)$/;
const BEST_RE    = /^Personal Best:\s+(.+?)\s+\((-?\d+\.?\d*)\)$/;
const TEAM_RE    = /^(.+?)\s+[–—-]\s+(.+)$/;

const LINES_PER_LABEL = 5;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parses one column's 5 text lines into an ImprovementLabel.
 * Returns null if any line is empty or a regex fails to match.
 *
 * Line order:
 *   0: #{eventNumber} {eventDescription}
 *   1: {lastName}, {firstName} ({age})
 *   2: Personal Best: {time} ({improvement})
 *   3: {team} – {date}
 *   4: {meetName}
 */
export function parseLabelLines(rawLines: string[]): ImprovementLabel | null {
  // Normalise the font's lowercase-"f" → ϐ substitution across every field
  // (event names and swimmer names alike) before matching.
  const lines = rawLines.map(resolveLigatures);
  if (lines.length < LINES_PER_LABEL) return null;
  if (lines.some(l => !l)) return null;

  const eventM   = lines[0].match(EVENT_RE);
  const swimmerM = lines[1].match(SWIMMER_RE);
  const bestM    = lines[2].match(BEST_RE);
  const teamM    = lines[3].match(TEAM_RE);

  if (!eventM || !swimmerM || !bestM || !teamM) return null;

  return {
    eventNumber:      eventM[1],
    eventDescription: eventM[2].trim(),
    lastName:         swimmerM[1].trim(),
    firstName:        swimmerM[2].trim(),
    age:              parseInt(swimmerM[3], 10),
    personalBestTime: bestM[1].trim(),
    improvement:      parseFloat(bestM[2]),
    team:             teamM[1].trim(),
    date:             teamM[2].trim(),
    meetName:         lines[4].trim(),
  };
}
