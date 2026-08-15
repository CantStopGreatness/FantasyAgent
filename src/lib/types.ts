/**
 * Wire types shared by the API routes and the client components.
 *
 * Kept free of server imports so client components can pull the types in
 * without dragging `node:fs` into the browser bundle.
 */

export type ScoringFormat = "category" | "points";

export type TagTone = "hot" | "good" | "warn";

export type PlayerCard = {
  playerId: string;
  name: string;
  position: string;
  team: string;
  rank: number;
  score: number;
  scoreLabel: string;
  statLine: string;
  injuryStatus: string | null;
  tags: { label: string; tone: TagTone }[];
  rankDelta: number | null;
  otherFormatRank: number | null;
  topCategories: { label: string; z: number }[];
  buzz: number;
  /** Sleepers view only. */
  reason?: string;
};

export type Commentary = { text: string; fallback: boolean } | null;

/** One parsed league rule, as read from Sleeper's undocumented settings blob. */
export type LeagueSetting = {
  key: string;
  label: string;
  value: string | null;
  raw: number | string | null;
  kind: "week" | "count" | "currency" | "enum" | "boolean" | "text";
  hint?: string;
};

export type LeagueInfo = {
  leagueId: string;
  name: string;
  season: string;
  sport: string;
  sportLabel: string;
  statsSeason: string;
  currentWeek: number | null;
  teamCount: number;
  /** The league's scoring format — read from the league, not chosen. */
  format: ScoringFormat;
  /** True while the format is still an inference the user has not confirmed. */
  formatInferred: boolean;
  /** False for sports with no category scoring concept, e.g. NFL. */
  supportsCategories: boolean;
  rosterSize: number | null;
  userTeamId: number | null;
  rosteredCount: number;
  scoredCount: number;
};

export type TeamInfo = {
  rosterId: number;
  teamName: string;
  ownerName: string;
  playerCount: number;
  isUserTeam: boolean;
};

export type Snapshot = {
  league: LeagueInfo;
  settings: LeagueSetting[];
  rawSettings: Record<string, number | string>;
  teams: TeamInfo[];
};

export type BoardResponse = {
  view: "waivers" | "sleepers" | "roster";
  format: ScoringFormat;
  players: PlayerCard[];
  commentary?: Commentary;
  team?: { rosterId: number; teamName: string; ownerName: string } | null;
  unscored?: number;
};

export type TradeResponse =
  | { found: false; reason: string }
  | {
      found: true;
      format: ScoringFormat;
      partnerTeamName: string;
      give: PlayerCard;
      receive: PlayerCard;
      userNeed: string;
      partnerNeed: string;
      fairness: "even" | "you-give-up-value" | "you-gain-value";
      commentary: Commentary;
    };

/** Persisted in localStorage so a refresh does not force a re-import. */
export type Session = {
  leagueId: string;
  userId: string | null;
  league: LeagueInfo;
  settings: LeagueSetting[];
  teams: TeamInfo[];
  /**
   * Set once the user confirms or corrects the format on the setup screen.
   * Sent back with every request so a correction survives a page reload.
   */
  confirmedFormat: ScoringFormat | null;
};

export const SESSION_KEY = "courtiq.session";

export function saveSession(session: Session) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Private browsing / storage disabled — the app still works for this tab.
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export const FORMAT_LABEL: Record<ScoringFormat, string> = {
  category: "Categories",
  points: "Points",
};
