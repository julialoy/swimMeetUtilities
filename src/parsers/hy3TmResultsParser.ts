import type { ParsedMeet, MeetInfo, TeamInfo, Swimmer, IndividualEntry } from '../types';

/** Maps semantic names to their two-character HY3 record type codes. */
const RECORD = {
  HEADER_LINE:           'A10',
  MEET_INFO:             'B1',
  MEET_INFO_2:           'B2',
  TEAM_INFO:             'C1',
  SWIMMER_INFO:          'D1',
  INDIVIDUAL_EVENT_INFO: 'E1',
  SUPP_EVENT_INFO:       'E2'
  // INDIVIDUAL_ENTRY:  'D0',
  // INDIVIDUAL_RESULT: 'D3',
  // RELAY_ENTRY:       'E0',
  // RELAY_RESULT:      'E3',
  // RELAY_SWIMMER:     'F0',
} as const;

/** Trims surrounding whitespace from a fixed-width field slice. */
function trim(s: string): string {
  return s.trim();
}

/**
 * Helper method that converts a HY3 date string from `MMDDYYYY` to ISO format `YYYY-MM-DD`.
 * Returns the original string unchanged if it is not exactly 8 characters.
 *
 * @param s - Raw 8-character date string from the HY3 file.
 */
function parseDate(s: string): string {
  if (s.length !== 8) return s;
  return `${s.slice(4, 8)}-${s.slice(0, 2)}-${s.slice(2, 4)}`;
}

/**
 * Parses a B1/B2 (meet information) record lines.
 * Field offsets (TM Results format):
 * - [2:42]   Meet name
 * - [42:82]  Facility name
 * - [92:100] Start date (MMDDYYYY)
 * - [100:108] End date (MMDDYYYY)
 */
function parseMeetInfo(line: string): MeetInfo {
  return {
    meetName:  trim(line.slice(2, 42)),
    facility:  trim(line.slice(42, 82)),
    startDate: parseDate(trim(line.slice(92, 100))),
    endDate:   parseDate(trim(line.slice(100, 108)))
  };
}

/**
 * Parses a B2 (meet/week identification) record line and adds it
 * to the provided MeetInfo object.
 * Field offsets:
 * - [2:42]   Meet subtitle
 */
function parseMeetSubtitle(line: string): string {
  return trim(line.slice(2, 42));
}

/**
 * Parses a C1 (primary team identification) record line.
 * Field offsets (TM Results format):
 * - [2:7]   Team Abbreviation
 * - [7:37]  Full Team Name
 * - [37:53] Short Team Name
 * - [53:55] LSC
 */
function parseTeam(line: string): TeamInfo {
  return {
    teamCode:  trim(line.slice(2, 7)),
    teamName:  trim(line.slice(7, 37)),
    shortName: trim(line.slice(37, 53)),
    lscCode:   trim(line.slice(53, 55)),
    swimmers: []
  };
}

/**
 * Parses a D1 (swimmer information) record line.
 * Field offsets:
 * - [2:3]   Gender ('M' or 'F')
 * - [3:8]   Swimmer ID
 * - [8:28]  Last Name
 * - [28:48] First Name
 * - [48:68] Preferred Name/Nickname
 * - [68:88] Middle Initial
 * - [88:96] Birth Date (MMDDYYYY)
 * - [96:99] Age
 */
function parseSwimmer(line: string): Swimmer {
  return {
    gender:         trim(line.slice(2, 3)),
    swimmerId:      trim(line.slice(3, 8)),
    lastName:       trim(line.slice(8, 28)),
    firstName:      trim(line.slice(28, 48)),
    preferredName:  trim(line.slice(48, 68)),
    middleIntitial: trim(line.slice(68, 88)),
    birthDate:      parseDate(trim(line.slice(88, 96))),
    // parseInt returns NaN for blank fields; convert to undefined
    age:            parseInt(trim(line.slice(96, 99)), 10) || undefined
  };
}

/**
 * Parses an E1 (individual entry/result) record line.
 * Field offsets (TM Results format):
 * - [2:3]    Gender ('M' or 'F')
 * - [3:8]    Swimmer ID
 * - [8:13]   Swimmer Short Name
 * - [13:15]  Team/Gender Code
 * - [17:22]  Event Code
 * - [22:25]  Minimum Age
 * - [25:28]  Maximum Age
 * - [31:32]  Course Type
 * - [32:39]  Seed Time
 * - [39:43]  Place/Finish
 * - [43:53]  Official Time
 * - [63:72]  Points Scored
 *
 * @param line    - The full E1 record line
 * @param swimmer - The swimmer context established by the preceding D1 record.
 */
function parseIndividualEntry(line: string, swimmer: Swimmer): IndividualEntry {
  return {
    swimmer,
    eventGender:  trim(line.slice(13, 15)),
    eventCode:    trim(line.slice(17, 22)),
    minAge:       parseInt(trim(line.slice(22, 25)), 10) || undefined,
    maxAge:       parseInt(trim(line.slice(25, 28)), 10) || undefined,
    courseType:   trim(line.slice(31, 32)),
    seedTime:     trim(line.slice(32, 39)),
    finishPlace:  parseInt(trim(line.slice(39, 43)), 10) || undefined,
    finishTime:   trim(line.slice(43, 53)),
    pointsScored: parseFloat(trim(line.slice(63, 72))) || 0.0,
    isDisqualified: false
  };
}

/**
 * Parses an E2 (individual entry/result supplementary information) record line.
 * Field offsets (TM Results format):
 * - [12:13] DQ flag — 'Q' when the swim was disqualified, space otherwise
 */
function parseSupplIndividualEntry(line: string): boolean {
  return line.slice(12, 13) === 'Q';
}


/**
 * Parses an E0 or E3 (relay entry/result) record line.
 * Field offsets:
 * - [2:8]   Event code
 * - [8:16]  Seed time
 * - [16:24] Finish time
 *
 * @param line     - The full E0/E3 record line.
 * @param teamCode - The team code from the most recent B1 record.
 */
// function parseRelayEntry(line: string, teamCode: string): RelayEntry {
//   return {
//     teamCode,
//     eventCode:  trim(line.slice(2, 8)),
//     seedTime:   trim(line.slice(8, 16)),
//     finishTime: trim(line.slice(16, 24)),
//     swimmers:   [],
//   };
// }

/** An Interface for the result returned by `parseHy3`. */
export interface Hy3ParseResult {
  /** The fully parsed meet, or `null` if the file could not be read at all. */
  meet: ParsedMeet | null;
  /** Non-fatal per-line parse errors. The meet is still returned when these are present. */
  errors: string[];
}

/**
 * Parses a HY3 file and returns a structured `ParsedMeet` object.
 *
 * The parser reads the file as plain text and processes it line by line.
 * It maintains a small piece of mutable state &mdash;`currentTeam`, `currentSwimmer`,
 * and `currentRelay` &mdash;that tracks the most recently seen parent record, since
 * child records (entries, relay swimmers) implicitly belong to the last-seen parent.
 *
 * Unknown record types are silently ignored; per-line errors are collected and
 * returned alongside the (potentially partial) result rather than throwing.
 *
 * @param file - The `.hy3` file selected or dropped by the user.
 * @returns A promise resolving to the parsed meet data and any parse warnings.
 */
export async function parseHy3(file: File): Promise<Hy3ParseResult> {
  const errors: string[] = [];

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { meet: null, errors: ['Failed to read file'] };
  }

  // Normalize line endings &mdash;HY3 files from Windows may use CRLF
  const lines = text.split(/\r?\n/);

  const meet: ParsedMeet = {
    meetInfo: { meetName: '' },
    teams: [],
    individualEntries: [],
    relayEntries: [],
  };

  // Stateful context: tracks the current parent record as we scan line by line.
  // Child records reference the most recently parsed parent.
  let currentTeam: TeamInfo | null = null;
  let currentSwimmer: Swimmer | null = null;
  let currentEvent: IndividualEntry | null = null;
  // let currentRelay: RelayEntry | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip blank lines and any line too short to have a record type
    if (line.length < 2) continue;

    const recordType = line.slice(0, 2);

    try {
      switch (recordType) {
        case RECORD.MEET_INFO:
          meet.meetInfo = parseMeetInfo(line);
          break;
        
        case RECORD.MEET_INFO_2:
          meet.meetInfo.meetSubtitle = parseMeetSubtitle(line);
          break;

        case RECORD.TEAM_INFO:
          // Each C1 record starts a new team block; reset swimmer context
          currentTeam = parseTeam(line);
          currentSwimmer = null;
          meet.teams.push(currentTeam);
          break;

        case RECORD.SWIMMER_INFO:
          // D1 records belong to the most recent C1 team
          currentSwimmer = parseSwimmer(line);
          if (currentTeam) {
            // Denormalise team info onto the swimmer for convenient access
            currentSwimmer.teamCode = currentTeam.teamCode;
            currentSwimmer.teamName = currentTeam.teamName;
            currentTeam.swimmers.push(currentSwimmer);
          }
          break;

        case RECORD.INDIVIDUAL_EVENT_INFO:
          // E1 records belong to the most recent D1 swimmer
          if (currentSwimmer) {
            currentEvent = parseIndividualEntry(line, currentSwimmer);
          }
          break;
        
        case RECORD.SUPP_EVENT_INFO:
          // E2 records belong to the most recent E1 event and D1 swimmer
          if (currentEvent) {
            currentEvent.isDisqualified = parseSupplIndividualEntry(line);
            meet.individualEntries.push(currentEvent);
          }
          break;


        // case RECORD.RELAY_ENTRY:
        // case RECORD.RELAY_RESULT:
        //   // E0/E3 records start a new relay; subsequent F0 records add swimmers to it
        //   currentRelay = parseRelayEntry(line, currentTeam?.teamCode ?? '');
        //   if (currentTeam) currentRelay.teamName = currentTeam.teamName;
        //   meet.relayEntries.push(currentRelay);
        //   break;

        // case RECORD.RELAY_SWIMMER:
        //   // F0 records assign a swimmer (most recent C1) to the current relay leg
        //   if (currentRelay && currentSwimmer) {
        //     currentRelay.swimmers.push(currentSwimmer);
        //   }
        //   break;

        // All other record types (e.g. Z0 file terminator, split records) are ignored
      }
    } catch (err) {
      // Collect per-line errors so a single bad line doesn't abort the whole file
      errors.push(`Line ${i + 1}: ${err instanceof Error ? err.message : 'Parse error'}`);
    }
  }

  return { meet, errors };
}
