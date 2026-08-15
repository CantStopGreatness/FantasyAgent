import {
  getLeague,
  getLeagueUsers,
  getLeaguesForUser,
  getRosters,
  getSportState,
  getUser,
  SleeperError,
} from "@/lib/sleeper/client";
import type { SleeperLeague } from "@/lib/sleeper/types";
import { DEFAULT_SPORT, getProfile, supportedSportLabels, type SportProfile } from "@/lib/sports";
import { detectFormat, type ScoringFormat } from "./scoring";
import { parseLeagueRules, type LeagueRules, type RuleOverrides } from "./settings";

/**
 * Corrections the user made on the settings screen.
 *
 * `rules` only reach the analyst's context. `scoring` and `format` reach the
 * engine and change the rankings, which is why they arrive here rather than
 * being applied client-side.
 */
export type LeagueOverrides = {
  format?: ScoringFormat | null;
  rules?: RuleOverrides;
  scoring?: Record<string, number>;
};

export type LeagueTeam = {
  rosterId: number;
  ownerId: string | null;
  teamName: string;
  ownerName: string;
  playerIds: string[];
  isUserTeam: boolean;
};

export type LeagueSnapshot = {
  leagueId: string;
  name: string;
  season: string;
  sport: string;
  teamCount: number;
  /** Format actually in force — the user's confirmed choice, or the inference. */
  format: ScoringFormat;
  rules: LeagueRules;
  scoringSettings: Record<string, number> | null;
  rosterPositions: string[] | null;
  teams: LeagueTeam[];
  rosteredIds: string[];
  userTeamId: number | null;
  /** Season whose stats we score against (may lag in the offseason). */
  statsSeason: string;
  /** Week of the live season, when one is underway. */
  currentWeek: number | null;
};

/**
 * Which season's stats to score against.
 *
 * During the offseason the current season has no games played, so we fall back
 * to the previous completed one. Without this the whole app renders empty
 * between seasons.
 */
async function resolveSeasonContext(
  sport: string,
  leagueSeason: string,
): Promise<{ statsSeason: string; currentWeek: number | null }> {
  try {
    const state = await getSportState(sport);
    const offseason = state.season === leagueSeason && state.season_type === "off";
    return {
      statsSeason: offseason ? state.previous_season : leagueSeason,
      currentWeek: offseason ? null : (state.display_week ?? null),
    };
  } catch {
    return { statsSeason: leagueSeason, currentWeek: null };
  }
}

function teamNameFor(
  ownerId: string | null,
  users: { user_id: string; display_name: string; metadata: { team_name?: string } | null }[],
): { teamName: string; ownerName: string } {
  const user = users.find((u) => u.user_id === ownerId);
  if (!user) return { teamName: "Orphan Team", ownerName: "Unmanaged" };
  return {
    teamName: user.metadata?.team_name?.trim() || user.display_name,
    ownerName: user.display_name,
  };
}

/** Resolve the profile for a league, refusing sports we cannot score yet. */
export function profileForLeague(league: SleeperLeague): SportProfile {
  const sport = league.sport || DEFAULT_SPORT;
  const profile = getProfile(sport);
  if (!profile) {
    throw new SleeperError(
      `CourtIQ does not cover ${sport.toUpperCase()} yet — currently ${supportedSportLabels()}.`,
      400,
    );
  }
  return profile;
}

export async function buildSnapshot(
  leagueId: string,
  userId: string | null,
  overrides: LeagueOverrides = {},
): Promise<LeagueSnapshot> {
  const league = await getLeague(leagueId);
  if (!league) throw new SleeperError(`No Sleeper league found with ID ${leagueId}`, 404);

  const profile = profileForLeague(league);
  const [rosters, users] = await Promise.all([getRosters(leagueId), getLeagueUsers(leagueId)]);

  const teams: LeagueTeam[] = rosters.map((r) => {
    const { teamName, ownerName } = teamNameFor(r.owner_id, users);
    return {
      rosterId: r.roster_id,
      ownerId: r.owner_id,
      teamName,
      ownerName,
      playerIds: (r.players ?? []).filter((id) => !id.startsWith("TEAM_")),
      isUserTeam: Boolean(userId) && r.owner_id === userId,
    };
  });

  // Scoring corrections are merged before anything reads the weights, so both
  // the format inference and the points math see the user's version.
  const scoringOverrides = overrides.scoring ?? {};
  const scoringSettings = Object.keys(scoringOverrides).length
    ? { ...(league.scoring_settings ?? {}), ...scoringOverrides }
    : league.scoring_settings;

  const inferred = detectFormat(profile, scoringSettings);
  const format = overrides.format ?? inferred;
  const rules = parseLeagueRules(
    league,
    format,
    overrides.format == null,
    overrides.rules ?? {},
    scoringOverrides,
  );

  const rosteredIds = [...new Set(teams.flatMap((t) => t.playerIds))];
  const userTeam = teams.find((t) => t.isUserTeam) ?? null;
  const { statsSeason, currentWeek } = await resolveSeasonContext(profile.id, league.season);

  return {
    leagueId,
    name: league.name,
    season: league.season,
    sport: profile.id,
    teamCount: league.total_rosters ?? teams.length,
    format,
    rules,
    scoringSettings,
    rosterPositions: league.roster_positions,
    teams,
    rosteredIds,
    userTeamId: userTeam?.rosterId ?? null,
    statsSeason,
    currentWeek,
  };
}

/**
 * Resolve a username to their leagues, checking the current season first and
 * falling back to the previous one — between seasons a manager's leagues often
 * still live under last year until they roll over.
 */
export async function findLeaguesForUsername(
  username: string,
  sport: string = DEFAULT_SPORT,
): Promise<{
  user: { userId: string; displayName: string };
  leagues: SleeperLeague[];
  season: string;
}> {
  const user = await getUser(username);
  if (!user) {
    throw new SleeperError(`No Sleeper user named "${username}". Check the spelling.`, 404);
  }

  const state = await getSportState(sport).catch(() => null);
  const seasons = state
    ? [...new Set([state.season, state.previous_season])]
    : [String(new Date().getFullYear())];

  for (const season of seasons) {
    const leagues = await getLeaguesForUser(sport, user.user_id, season);
    if (leagues.length > 0) {
      return {
        user: { userId: user.user_id, displayName: user.display_name },
        leagues,
        season,
      };
    }
  }

  return {
    user: { userId: user.user_id, displayName: user.display_name },
    leagues: [],
    season: seasons[0],
  };
}
