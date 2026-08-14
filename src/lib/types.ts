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

export type LeagueInfo = {
  leagueId: string;
  name: string;
  season: string;
  statsSeason: string;
  teamCount: number;
  detectedFormat: ScoringFormat;
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

export type Snapshot = { league: LeagueInfo; teams: TeamInfo[] };

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
  teams: TeamInfo[];
};

export const SESSION_KEY = "courtiq.session";

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

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
