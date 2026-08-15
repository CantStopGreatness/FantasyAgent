/** Shapes we consume from the public Sleeper API (api.sleeper.app/v1). */

export type SleeperUser = {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
};

export type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  sport: string;
  total_rosters: number;
  status: string;
  avatar: string | null;
  /** Map of stat key -> point value. Present on points leagues; may be sparse. */
  scoring_settings: Record<string, number> | null;
  roster_positions: string[] | null;
  settings: Record<string, number | string> | null;
};

export type SleeperRoster = {
  roster_id: number;
  /** Null on orphan teams with no manager. */
  owner_id: string | null;
  league_id: string;
  /** Sleeper player IDs. Null on a brand-new, undrafted league. */
  players: string[] | null;
  starters: string[] | null;
  settings: Record<string, number> | null;
};

export type SleeperLeagueUser = {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata: { team_name?: string } | null;
};

/** One entry from GET /v1/players/{sport} — trimmed to the fields we actually use. */
export type SleeperPlayer = {
  player_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  team: string | null;
  active: boolean;
  fantasy_positions: string[] | null;
  injury_status: string | null;
  age: number | null;
  number: number | null;
};

/**
 * Season or weekly stat totals, keyed by Sleeper player ID.
 * Sleeper returns season *totals* (not averages) plus `gp`, and playing time
 * as `sp` in seconds. Everything else is a raw count.
 */
export type SleeperStatLine = {
  gp?: number;
  /** Seconds played. Divide by 60 for minutes. */
  sp?: number;
  pts?: number;
  reb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  to?: number;
  fgm?: number;
  fga?: number;
  ftm?: number;
  fta?: number;
  tpm?: number;
  tpa?: number;
  [key: string]: number | undefined;
};

export type StatsBySeason = Record<string, SleeperStatLine>;
