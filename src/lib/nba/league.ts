import {
  getLeague,
  getLeagueUsers,
  getLeaguesForUser,
  getNBAState,
  getRosters,
  getUser,
  SleeperError,
} from "@/lib/sleeper/client";
import type { SleeperLeague } from "@/lib/sleeper/types";
import { detectFormat, type ScoringFormat } from "./scoring";

export type LeagueTeam = {
  rosterId: number;
  ownerId: string | null;
  /** Manager's chosen team name, falling back to their display name. */
  teamName: string;
  ownerName: string;
  playerIds: string[];
  isUserTeam: boolean;
};

export type LeagueSnapshot = {
  leagueId: string;
  name: string;
  season: string;
  teamCount: number;
  detectedFormat: ScoringFormat;
  scoringSettings: Record<string, number> | null;
  rosterPositions: string[] | null;
  teams: LeagueTeam[];
  /** Every player ID rostered anywhere in the league. */
  rosteredIds: string[];
  userTeamId: number | null;
  /** Season whose stats we score against (may lag the league season in the offseason). */
  statsSeason: string;
};

/**
 * Which season's stats to score against.
 *
 * During the offseason Sleeper's current season has no games played yet, so we
 * fall back to the previous completed season. Without this the entire app
 * renders empty between April and October.
 */
export async function resolveStatsSeason(leagueSeason: string): Promise<string> {
  try {
    const state = await getNBAState();
    if (state.season === leagueSeason && state.season_type === "off") {
      return state.previous_season;
    }
    return leagueSeason;
  } catch {
    return leagueSeason;
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

export async function buildSnapshot(
  leagueId: string,
  userId: string | null,
): Promise<LeagueSnapshot> {
  const league = await getLeague(leagueId);
  if (!league) throw new SleeperError(`No Sleeper league found with ID ${leagueId}`, 404);
  if (league.sport && league.sport !== "nba") {
    throw new SleeperError(
      `That league is ${league.sport.toUpperCase()}, not NBA. CourtIQ is basketball-only.`,
      400,
    );
  }

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

  const rosteredIds = [...new Set(teams.flatMap((t) => t.playerIds))];
  const userTeam = teams.find((t) => t.isUserTeam) ?? null;

  return {
    leagueId,
    name: league.name,
    season: league.season,
    teamCount: league.total_rosters ?? teams.length,
    detectedFormat: detectFormat(league.scoring_settings),
    scoringSettings: league.scoring_settings,
    rosterPositions: league.roster_positions,
    teams,
    rosteredIds,
    userTeamId: userTeam?.rosterId ?? null,
    statsSeason: await resolveStatsSeason(league.season),
  };
}

/**
 * Resolve a username to their NBA leagues, checking the current season first
 * and falling back to the previous one — in the offseason a manager's leagues
 * often still live under last season until they roll over.
 */
export async function findLeaguesForUsername(username: string): Promise<{
  user: { userId: string; displayName: string };
  leagues: SleeperLeague[];
  season: string;
}> {
  const user = await getUser(username);
  if (!user) {
    throw new SleeperError(`No Sleeper user named "${username}". Check the spelling.`, 404);
  }

  const state = await getNBAState().catch(() => null);
  const seasons = state
    ? [...new Set([state.season, state.previous_season])]
    : [String(new Date().getFullYear())];

  for (const season of seasons) {
    const leagues = await getLeaguesForUser(user.user_id, season);
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
