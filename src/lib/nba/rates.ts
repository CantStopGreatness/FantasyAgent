import type { SleeperStatLine, StatsBySeason } from "@/lib/sleeper/types";

/**
 * A player's production expressed per game.
 *
 * Sleeper hands back season *totals*, so every rate here is derived. Shooting
 * percentages keep their underlying volume (attempts) alongside them because
 * category scoring weights efficiency by how many shots it came on — a 100%
 * night on two attempts is not a real FG% edge.
 */
export type PlayerRates = {
  playerId: string;
  gp: number;
  mpg: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  to: number;
  tpm: number;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
  fgPct: number;
  ftPct: number;
};

const num = (v: number | undefined): number => (typeof v === "number" && isFinite(v) ? v : 0);

export function toRates(playerId: string, line: SleeperStatLine): PlayerRates | null {
  const gp = num(line.gp);
  if (gp <= 0) return null;

  const per = (v: number | undefined) => num(v) / gp;
  const fga = per(line.fga);
  const fta = per(line.fta);
  const fgm = per(line.fgm);
  const ftm = per(line.ftm);

  return {
    playerId,
    gp,
    // `sp` is seconds played across the season.
    mpg: num(line.sp) / 60 / gp,
    pts: per(line.pts),
    reb: per(line.reb),
    ast: per(line.ast),
    stl: per(line.stl),
    blk: per(line.blk),
    to: per(line.to),
    tpm: per(line.tpm),
    fgm,
    fga,
    ftm,
    fta,
    fgPct: fga > 0 ? fgm / fga : 0,
    ftPct: fta > 0 ? ftm / fta : 0,
  };
}

export function ratesFromStats(stats: StatsBySeason): Map<string, PlayerRates> {
  const out = new Map<string, PlayerRates>();
  for (const [playerId, line] of Object.entries(stats)) {
    if (playerId.startsWith("TEAM_")) continue;
    const rates = toRates(playerId, line);
    if (rates) out.set(playerId, rates);
  }
  return out;
}

/**
 * The normalization pool: roughly "fantasy-relevant" players.
 *
 * This threshold matters more than it looks. Z-scores are only meaningful
 * relative to the population you compute them against — normalizing against
 * all ~1800 players who logged a minute would drag the means down toward
 * deep-bench production and inflate every rotation player's score. Filtering
 * to real contributors keeps a replacement-level pickup scoring near 0.
 */
export const POOL_MIN_GAMES = 15;
export const POOL_MIN_MPG = 14;

export function fantasyRelevant(rates: Iterable<PlayerRates>): PlayerRates[] {
  return [...rates].filter((r) => r.gp >= POOL_MIN_GAMES && r.mpg >= POOL_MIN_MPG);
}
