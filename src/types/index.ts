/** An Interface for representing an individual swimmer on a team. */
export interface Swimmer {
  lastName: string;
  firstName: string;
  /** Single middle initial, if present. */
  middleIntitial?: string;
  /** 'M' or 'F' as stored in the source file. */
  gender: string;
  /** ISO date string (YYYY-MM-DD), converted from source format. */
  birthDate?: string;
  age?: number;
  /** Short team code (e.g. 'TIDE'). */
  teamCode?: string;
  teamName?: string;
  /** Unique swimmer ID assigned by HyTek. */
  swimmerId?: string;
  /** Swimmer's preferred name or nickname. */
  preferredName?: string;
}

/** An Interface for representing a single swimmer's entry or result in an individual event. */
export interface IndividualEntry {
  swimmer: Swimmer;
  /** HyTek event code identifying the stroke, distance, and age group. */
  eventCode: string;
  /** Course type */
  courseType: string;
  /** Seed time as a formatted string (e.g. '1:02.34'). */
  seedTime?: string;
  /** Official finish time, populated from result records. */
  finishTime?: string;
  /** Finishing place within the event heat/final. */
  finishPlace?: number;
  /** Event's gender ('M' or 'F') */
  eventGender: string;
  /** Minimum age for event. */
  minAge?: number;
  /** Maximum age for event. */
  maxAge?: number;
  /** Points scored */
  pointsScored: number;
  /** Flag indicating whether the swimmer was disqualified. */
  isDisqualified: boolean;
}

/** An Interface for representing a relay team's entry or result in a relay event. */
export interface RelayEntry {
  /** Short team code for the relay team. */
  teamCode: string;
  teamName?: string;
  /** HyTek event code for the relay event. */
  eventCode: string;
  seedTime?: string;
  finishTime?: string;
  /** The swimmers assigned to this relay leg, in leg order. */
  swimmers: Swimmer[];
}

/**
 * An Interface for top-level metadata for a swim meet.
 * Populated from the A0 record in HY3 files.
 */
export interface MeetInfo {
  meetName: string;
  meetSubtitle?: string;
  /** Name of the host facility/pool. */
  facility?: string;
  /** ISO date string (YYYY-MM-DD). */
  startDate?: string;
  /** ISO date string (YYYY-MM-DD). */
  endDate?: string;
  /**
   * Pool course designation:
   * - `SCY` &mdash;Short Course Yards (25 yards)
   * - `SCM` &mdash;Short Course Meters (25 meters)
   * - `LCM` &mdash;Long Course Meters (50 meters)
   */
  course?: 'SCY' | 'SCM' | 'LCM';
}

/**
 * An Interface for the complete parsed representation of a meet file.
 * This is the root object returned by `parseHy3`.
 */
export interface ParsedMeet {
  meetInfo: MeetInfo;
  /** All teams present in the file, each with their roster of swimmers. */
  teams: TeamInfo[];
  /** Flattened list of all individual entries/results across all teams. */
  individualEntries: IndividualEntry[];
  /** Flattened list of all relay entries/results across all teams. */
  relayEntries: RelayEntry[];
}

/** An Interface for representing a team and its full roster as parsed from the file. */
export interface TeamInfo {
  /** Short team code (e.g. 'TIDE'). */
  teamCode: string;
  teamName: string;
  /** Abbreviated team name used in heat sheets and psych sheets. */
  shortName?: string;
  /** Local Swim Committee code (e.g. 'MD' for Maryland). */
  lscCode?: string;
  swimmers: Swimmer[];
}

// ── SwimTopia athlete report card ─────────────────────────────────────────────

/** One athlete's result in a single meet for a single event. */
export interface SwimTopiaMeetResult {
  meetName: string;
  /** Formatted time string (e.g. '1:02.34'). */
  result: string;
  /** Result converted to decimal seconds. */
  resultSec: number;
  /** True when this result was an improvement over the prior best. */
  improved: boolean;
  points: number;
  /** Raw date string as it appears in the CSV (e.g. '7/12/2025'). */
  date: string;
}

/** One event row for a single athlete — a summary across all their meets. */
export interface SwimTopiaEventSummary {
  /** Distance portion of the event (e.g. '25', '50', '100'). */
  eventDistance: string;
  /** Stroke name (e.g. 'Freestyle', 'Backstroke'). */
  eventStroke: string;
  meetResults: SwimTopiaMeetResult[];
  totalResults: number;
  totalImproved: number;
  totalPoints: number;
  /** Total improvement in decimal seconds across all meets. */
  amountImprovedSec: number;
  /** Improvement as a percentage of baseline. */
  percentImproved: number;
}

/** All event summaries for one athlete from a SwimTopia report card export. */
export interface SwimTopiaAthlete {
  ageGroup: string;
  athleteId: string;
  lastName: string;
  firstName: string;
  age: number;
  events: SwimTopiaEventSummary[];
}

/** The top-level result returned by `parseSwimTopiaReportCard`. */
export interface SwimTopiaReportCard {
  athletes: SwimTopiaAthlete[];
  errors: string[];
}

// ── Award labels PDF (Avery 8160 3×10 layout) ────────────────────────────────

/** One swimmer's award label parsed from the results PDF. */
export interface AwardLabel {
  place: number;
  /** "1st", "2nd", "3rd", etc. */
  placeOrdinal: string;
  finishTime: string;
  /** Event number as printed, may include a letter suffix (e.g. "7B", "8A"). */
  eventNumber: string;
  /** Human-readable event description, e.g. "Boys 12&U 100m IM". */
  eventDescription: string;
  lastName: string;
  firstName: string;
  age: number;
  /** Team name as printed, including relay designators (e.g. "MCT A"). */
  team: string;
  /** Raw date string as printed (e.g. "Jun 25, 2025"). */
  date: string;
  meetName: string;
}

/** The top-level result returned by `parseAwardLabelsPdf`. */
export interface AwardLabelsResult {
  labels: AwardLabel[];
  errors: string[];
}

// ── Improvement labels PDF (Avery 8160 3×10 layout) ──────────────────────────

/** One swimmer's improvement label parsed from the personal-best PDF. */
export interface ImprovementLabel {
  /** Event number as printed, may include a letter suffix (e.g. "7B", "8A"). */
  eventNumber: string;
  /** Human-readable event description, e.g. "Boys 12&U 100m IM". */
  eventDescription: string;
  lastName: string;
  firstName: string;
  age: number;
  /** Personal best time as a formatted string, e.g. "1:51.56". */
  personalBestTime: string;
  /** Improvement in seconds — always ≤ 0 (e.g. -14.13 means 14.13s faster). */
  improvement: number;
  /** Team name as printed. */
  team: string;
  /** Raw date string as printed (e.g. "Jun 18, 2025"). */
  date: string;
  meetName: string;
}

/** The top-level result returned by `parseImprovementLabelsPdf`. */
export interface ImprovementLabelsResult {
  labels: ImprovementLabel[];
  errors: string[];
}

/** Union of every label type that can be sorted, combined, and printed. */
export type Label = AwardLabel | ImprovementLabel;

