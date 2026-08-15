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
  options?: { value: number; label: string }[];
  edited?: boolean;
};

/** One per-stat point value. In a points league these are the ranking. */
export type ScoringStat = {
  key: string;
  label: string;
  value: number;
  edited?: boolean;
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
  scoring: ScoringStat[];
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

/** Conditions the manager attaches to a trade request. All optional. */
export type TradeIntent = {
  wantCategories: string[];
  targetPlayerId: string | null;
  protectedPlayerIds: string[];
};

export const EMPTY_INTENT: TradeIntent = {
  wantCategories: [],
  targetPlayerId: null,
  protectedPlayerIds: [],
};

export type TradeResponse =
  | { found: false; reason: string }
  | {
      found: true;
      format: ScoringFormat;
      partnerTeamName: string;
      give: PlayerCard;
      receive: PlayerCard;
      /** Null when the deal came from a stated goal rather than a positional read. */
      userNeed: string | null;
      partnerNeed: string | null;
      fairness: "even" | "you-give-up-value" | "you-gain-value" | "worth-the-overpay";
      /** Movement in each category the manager asked to improve. */
      goalDelta: { key: string; label: string; delta: number }[];
      goalGain: number | null;
      rationale: string;
      commentary: Commentary;
    };

/** Category keys a manager can ask to improve, per sport. */
export const NBA_CATEGORY_CHOICES: { key: string; label: string }[] = [
  { key: "pts", label: "Points" },
  { key: "reb", label: "Rebounds" },
  { key: "ast", label: "Assists" },
  { key: "stl", label: "Steals" },
  { key: "blk", label: "Blocks" },
  { key: "tpm", label: "Threes" },
  { key: "fgPct", label: "FG%" },
  { key: "ftPct", label: "FT%" },
  { key: "to", label: "Fewer TOs" },
];

/** Persisted in localStorage so a refresh does not force a re-import. */
export type Session = {
  leagueId: string;
  userId: string | null;
  league: LeagueInfo;
  settings: LeagueSetting[];
  scoring: ScoringStat[];
  teams: TeamInfo[];
  /**
   * Corrections the user made on the settings screen. Sent with every request
   * so they survive a reload — and because scoring edits change the rankings,
   * they must be applied server-side rather than only in the UI.
   */
  confirmedFormat: ScoringFormat | null;
  ruleOverrides: Record<string, number | string>;
  scoringOverrides: Record<string, number>;
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
