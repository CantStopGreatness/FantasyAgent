import type { Session } from "@/lib/types";

/**
 * Pre-authored sample league.
 *
 * Everything in it is illustrative; the dashboard labels it "CourtIQ Demo
 * League" so it is never mistaken for a real import.
 */
export const DEMO_SESSION: Session = {
  leagueId: "demo",
  userId: "demo-user",
  confirmedFormat: "category" as const,
  ruleOverrides: {},
  scoringOverrides: {},
  league: {
    leagueId: "demo",
    name: "CourtIQ Demo League",
    season: "2024",
    sport: "nba",
    sportLabel: "NBA",
    statsSeason: "2024",
    currentWeek: 18,
    teamCount: 12,
    format: "category" as const,
    formatInferred: false,
    supportsCategories: true,
    rosterSize: 13,
    userTeamId: 1,
    rosteredCount: 156,
    scoredCount: 148,
  },
  settings: [
    { key: "playoff_week_start", label: "Playoffs start", value: "Week 22", raw: 22, kind: "week" as const },
    { key: "trade_deadline", label: "Trade deadline", value: "Week 18", raw: 18, kind: "week" as const },
    { key: "waiver_type", label: "Waiver type", value: "FAAB", raw: 2, kind: "enum" as const },
  ],
  scoring: [
    { key: "pts", label: "Points", value: 1 },
    { key: "reb", label: "Rebounds", value: 1 },
    { key: "ast", label: "Assists", value: 1 },
    { key: "stl", label: "Steals", value: 2 },
    { key: "blk", label: "Blocks", value: 2 },
    { key: "tov", label: "Turnovers", value: -1 },
    { key: "fg_pct", label: "FG%", value: 1 },
    { key: "ft_pct", label: "FT%", value: 1 },
  ],
  teams: [
    { rosterId: 1, teamName: "Your Team", ownerName: "You", playerCount: 13, isUserTeam: true },
    { rosterId: 2, teamName: "Hoop Dreams", ownerName: "Alex", playerCount: 13, isUserTeam: false },
    { rosterId: 3, teamName: "Ball Hogs", ownerName: "Jordan", playerCount: 13, isUserTeam: false },
  ],
};
