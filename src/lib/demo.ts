import type {
  SleeperLeague,
  SleeperLeagueUser,
  SleeperPlayer,
  SleeperRoster,
  SleeperStatLine,
  StatsBySeason,
} from "@/lib/sleeper/types";

export const DEMO_LEAGUE_ID = "demo";
export const DEMO_USER_ID = "demo-user";
export const DEMO_FIXTURE_VERSION = "2026.08-v1";

type RateTuple = [
  mpg: number,
  pts: number,
  reb: number,
  ast: number,
  stl: number,
  blk: number,
  turnovers: number,
  threes: number,
  fieldGoalPct: number,
  freeThrowPct: number,
];

type PlayerSeed = {
  id: string;
  name: string;
  position: string;
  team: string;
  age: number;
  line: RateTuple;
};

export type DemoFixture = {
  version: string;
  league: SleeperLeague;
  rosters: SleeperRoster[];
  users: SleeperLeagueUser[];
  players: Record<string, SleeperPlayer>;
  seasonStats: StatsBySeason;
  trendingAdds: Record<string, number>;
  statsSeason: string;
  currentWeek: null;
};

const GAMES_PLAYED = 24;
const seed = (
  id: string,
  name: string,
  position: string,
  team: string,
  age: number,
  line: RateTuple,
): PlayerSeed => ({ id, name, position, team, age, line });

/**
 * Fictional players and teams keep the sample safe from stale news, injuries,
 * transactions, and schedule claims. Devin leads at BLK=3; Marcus at BLK=5.
 */
const PLAYER_SEEDS: PlayerSeed[] = [
  // Your Team: guard depth, balanced forwards, and one center.
  seed("demo-u-ari", "Ari Monroe", "PG", "NTH", 27, [35, 21, 4, 8, 1.3, 0.2, 3.2, 2.4, 0.47, 0.84]),
  seed("demo-u-blake", "Blake Turner", "SG", "CST", 26, [33, 18, 4, 4, 1.5, 0.4, 2.2, 2.2, 0.46, 0.81]),
  seed("demo-u-cameron", "Cameron Reed", "PG", "WST", 24, [31, 15, 3, 7, 1, 0.1, 2.5, 1.6, 0.45, 0.82]),
  seed("demo-u-drew", "Drew Ellis", "SF", "EST", 28, [34, 19, 7, 3, 1, 0.6, 2, 2, 0.49, 0.8]),
  seed("demo-u-emery", "Emery Stone", "PF", "NTH", 29, [32, 14, 8, 2, 1, 1, 1.8, 1.1, 0.51, 0.77]),
  seed("demo-u-finley", "Finley Brooks", "C", "CST", 30, [29, 12, 9, 2, 0.6, 1.5, 2, 0.4, 0.56, 0.74]),

  // Paint Patrol: one guard and three centers create a complementary trade shape.
  seed("demo-a-gray", "Gray Lawson", "PG", "EST", 27, [36, 26, 4, 5, 1.7, 0.4, 2.6, 2.7, 0.48, 0.86]),
  seed("demo-a-harper", "Harper Lane", "SF", "WST", 25, [33, 18, 6, 4, 0.9, 0.7, 2, 1.8, 0.47, 0.8]),
  seed("demo-a-indy", "Indy Ross", "PF", "NTH", 24, [31, 15, 7, 3, 1.2, 0.8, 1.8, 1.3, 0.5, 0.78]),
  seed("demo-a-jules", "Jules Mercer", "C", "CST", 29, [35, 19, 12, 3, 0.8, 2.3, 2.4, 0.5, 0.58, 0.75]),
  seed("demo-a-kai", "Kai Bennett", "C", "EST", 26, [31, 15, 10, 2, 0.7, 1.8, 2, 0.3, 0.57, 0.73]),
  seed("demo-a-logan", "Logan Price", "C", "WST", 31, [25, 11, 8, 1, 0.5, 1.4, 1.5, 0.2, 0.59, 0.7]),

  // Perimeter Lab: a distinct second opponent and distinct owned center target.
  seed("demo-b-milan", "Milan Hayes", "PG", "NTH", 28, [34, 20, 5, 6, 1, 0.3, 2.5, 2, 0.46, 0.83]),
  seed("demo-b-nico", "Nico Warren", "SF", "CST", 27, [35, 22, 8, 3, 1, 0.8, 2.4, 2.1, 0.49, 0.81]),
  seed("demo-b-oakley", "Oakley James", "PF", "EST", 25, [32, 16, 6, 4, 1.4, 0.5, 2, 1.5, 0.48, 0.79]),
  seed("demo-b-parker", "Parker Wynn", "SF", "WST", 24, [27, 13, 6, 2, 0.8, 0.7, 1.5, 1.4, 0.47, 0.78]),
  seed("demo-b-quincy", "Quincy Ford", "C", "NTH", 30, [34, 18, 11, 2, 0.9, 2, 2.3, 0.4, 0.57, 0.76]),
  seed("demo-b-remy", "Remy Clarke", "C", "CST", 26, [29, 13, 9, 3, 0.8, 1.6, 1.7, 0.6, 0.55, 0.75]),

  // Available pool.
  seed("demo-fa-devin", "Devin Cole", "SG", "EST", 27, [32, 22, 5, 6, 1, 0.3, 3, 2.8, 0.45, 0.85]),
  seed("demo-fa-marcus", "Marcus Bell", "C", "NTH", 28, [29, 14, 10, 2, 0.8, 2.2, 2, 0.2, 0.58, 0.72]),
  seed("demo-fa-eli", "Eli Grant", "PG", "WST", 26, [30, 16, 3, 7.5, 1, 0.2, 2.8, 1.7, 0.44, 0.82]),
  seed("demo-fa-nova", "Nova Pierce", "SF", "CST", 25, [30, 18, 5, 3, 1.4, 0.5, 2, 2.1, 0.47, 0.8]),
  seed("demo-fa-taylor", "Taylor Knox", "C", "EST", 29, [26, 10, 9, 2, 0.5, 1.7, 1.5, 0.2, 0.6, 0.68]),
  seed("demo-fa-robin", "Robin Shaw", "SG", "NTH", 21, [20, 12, 3, 4, 1.2, 0.3, 1.5, 1.8, 0.46, 0.84]),
  seed("demo-fa-sage", "Sage Porter", "PF", "WST", 23, [24, 14, 7, 2, 0.8, 0.9, 1.8, 1.2, 0.51, 0.76]),
  seed("demo-fa-rory", "Rory Tate", "C", "CST", 24, [22, 9, 8, 1, 0.4, 1.5, 1.2, 0.1, 0.61, 0.69]),
  seed("demo-fa-sky", "Skyler Moss", "SG", "EST", 25, [28, 19, 3, 2, 0.7, 0.1, 1.2, 3.2, 0.44, 0.87]),
  seed("demo-fa-tegan", "Tegan Cross", "SF", "NTH", 22, [22, 10, 5, 2, 2, 0.8, 1.2, 1, 0.48, 0.79]),
  seed("demo-fa-val", "Val Jordan", "PF", "WST", 26, [25, 11, 11, 1, 0.5, 1.1, 1.7, 0.4, 0.55, 0.74]),
];

/**
 * Convert readable per-game lines to the season totals Sleeper returns.
 * Shooting makes are derived so points, makes, attempts, and percentages agree.
 */
function sleeperTotals(line: RateTuple): SleeperStatLine {
  const [mpg, pts, reb, ast, stl, blk, turnovers, threes, fgPct, ftPct] = line;
  const ftm = pts * 0.18;
  const fgm = (pts - threes - ftm) / 2;
  const fga = fgm / fgPct;
  const fta = ftm / ftPct;
  const total = (value: number) => value * GAMES_PLAYED;

  return {
    gp: GAMES_PLAYED,
    sp: total(mpg * 60),
    pts: total(pts),
    reb: total(reb),
    oreb: total(reb * 0.27),
    dreb: total(reb * 0.73),
    ast: total(ast),
    stl: total(stl),
    blk: total(blk),
    to: total(turnovers),
    tpm: total(threes),
    tpa: total(threes / 0.36),
    fgm: total(fgm),
    fga: total(fga),
    ftm: total(ftm),
    fta: total(fta),
    fgmi: total(fga - fgm),
    ftmi: total(fta - ftm),
    tpmi: total(threes / 0.36 - threes),
  };
}

const players: Record<string, SleeperPlayer> = Object.fromEntries(
  PLAYER_SEEDS.map((entry) => [
    entry.id,
    {
      player_id: entry.id,
      full_name: entry.name,
      first_name: entry.name.split(" ")[0],
      last_name: entry.name.split(" ").slice(1).join(" "),
      team: entry.team,
      active: true,
      fantasy_positions: [entry.position],
      injury_status: null,
      age: entry.age,
      number: null,
    },
  ]),
);

const seasonStats: StatsBySeason = Object.fromEntries(
  PLAYER_SEEDS.map((entry) => [entry.id, sleeperTotals(entry.line)]),
);

const rosters: SleeperRoster[] = [
  {
    roster_id: 1,
    owner_id: DEMO_USER_ID,
    league_id: DEMO_LEAGUE_ID,
    players: ["demo-u-ari", "demo-u-blake", "demo-u-cameron", "demo-u-drew", "demo-u-emery", "demo-u-finley"],
    starters: ["demo-u-ari", "demo-u-blake", "demo-u-drew", "demo-u-emery", "demo-u-finley"],
    settings: {},
  },
  {
    roster_id: 2,
    owner_id: "demo-owner-paint",
    league_id: DEMO_LEAGUE_ID,
    players: ["demo-a-gray", "demo-a-harper", "demo-a-indy", "demo-a-jules", "demo-a-kai", "demo-a-logan"],
    starters: ["demo-a-gray", "demo-a-harper", "demo-a-indy", "demo-a-jules", "demo-a-kai"],
    settings: {},
  },
  {
    roster_id: 3,
    owner_id: "demo-owner-perimeter",
    league_id: DEMO_LEAGUE_ID,
    players: ["demo-b-milan", "demo-b-nico", "demo-b-oakley", "demo-b-parker", "demo-b-quincy", "demo-b-remy"],
    starters: ["demo-b-milan", "demo-b-nico", "demo-b-oakley", "demo-b-quincy", "demo-b-remy"],
    settings: {},
  },
];

const users: SleeperLeagueUser[] = [
  { user_id: DEMO_USER_ID, display_name: "You", avatar: null, metadata: { team_name: "Your Team" } },
  { user_id: "demo-owner-paint", display_name: "Alex", avatar: null, metadata: { team_name: "Paint Patrol" } },
  { user_id: "demo-owner-perimeter", display_name: "Jordan", avatar: null, metadata: { team_name: "Perimeter Lab" } },
];

/** The only persisted demo source; all user-facing results are derived from it. */
export const DEMO_FIXTURE: DemoFixture = {
  version: DEMO_FIXTURE_VERSION,
  league: {
    league_id: DEMO_LEAGUE_ID,
    name: "CourtIQ Frozen Demo " + DEMO_FIXTURE_VERSION,
    season: DEMO_FIXTURE_VERSION,
    sport: "nba",
    total_rosters: rosters.length,
    status: "complete",
    avatar: null,
    scoring_settings: {
      pts: 1,
      reb: 1.2,
      ast: 1.5,
      stl: 3,
      blk: 3,
      to: -1,
      // Visible but excluded: there is no exact event-level rate for this bonus.
      bonus_pt_40p: 4,
    },
    roster_positions: ["PG", "SG", "SF", "PF", "C", "BN"],
    settings: {
      waiver_type: 2,
      waiver_budget: 100,
      playoff_teams: 2,
      type: 0,
      disable_trades: 0,
    },
  },
  rosters,
  users,
  players,
  seasonStats,
  trendingAdds: {
    "demo-fa-robin": 48,
    "demo-fa-tegan": 42,
    "demo-fa-rory": 36,
    "demo-fa-sage": 28,
    "demo-fa-taylor": 18,
  },
  statsSeason: DEMO_FIXTURE_VERSION,
  currentWeek: null,
};

export function isDemoLeague(leagueId: string): boolean {
  return leagueId === DEMO_LEAGUE_ID;
}
