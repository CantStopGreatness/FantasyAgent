import { getWeekStats } from "@/lib/sleeper/client";
import type { StatsBySeason } from "@/lib/sleeper/types";
import type { PlayerRates } from "./rates";

/**
 * Late-season form, sampled from Sleeper's per-week NBA stat files.
 *
 * A caveat worth stating plainly: each weekly file holds roughly a *single*
 * game per player, not a full week's aggregate — summing all 25 weeks recovers
 * only ~30% of a player's season totals. So this is a sample of recent games,
 * not a true "last N games" split, and the UI labels it as late-season form
 * rather than claiming precision the data does not support.
 */
export type RecentForm = {
  games: number;
  mpg: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tpm: number;
};

export type FormDelta = {
  /** Late-season minutes per game minus season-long minutes per game. */
  minutes: number;
  points: number;
  games: number;
};

const LAST_POPULATED_WEEK = 25;
const SAMPLE_WEEKS = 3;

export async function getRecentForm(season: string): Promise<Map<string, RecentForm>> {
  const weeks = Array.from(
    { length: SAMPLE_WEEKS },
    (_, i) => LAST_POPULATED_WEEK - i,
  ).filter((w) => w > 0);

  let files: StatsBySeason[];
  try {
    files = await Promise.all(weeks.map((w) => getWeekStats(season, w)));
  } catch {
    // Form is an enhancement; never let it take down a recommendation request.
    return new Map();
  }

  const acc = new Map<string, RecentForm & { seconds: number }>();
  for (const file of files) {
    for (const [playerId, line] of Object.entries(file)) {
      if (playerId.startsWith("TEAM_")) continue;
      if (!line || Object.keys(line).length === 0) continue;

      const cur =
        acc.get(playerId) ??
        { games: 0, seconds: 0, mpg: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0 };
      cur.games += 1;
      cur.seconds += line.sp ?? 0;
      cur.pts += line.pts ?? 0;
      cur.reb += line.reb ?? 0;
      cur.ast += line.ast ?? 0;
      cur.stl += line.stl ?? 0;
      cur.blk += line.blk ?? 0;
      cur.tpm += line.tpm ?? 0;
      acc.set(playerId, cur);
    }
  }

  const out = new Map<string, RecentForm>();
  for (const [playerId, v] of acc) {
    if (v.games === 0) continue;
    out.set(playerId, {
      games: v.games,
      mpg: v.seconds / 60 / v.games,
      pts: v.pts / v.games,
      reb: v.reb / v.games,
      ast: v.ast / v.games,
      stl: v.stl / v.games,
      blk: v.blk / v.games,
      tpm: v.tpm / v.games,
    });
  }
  return out;
}

export function formDelta(rates: PlayerRates, form: RecentForm | undefined): FormDelta | null {
  if (!form || form.games === 0) return null;
  return {
    minutes: form.mpg - rates.mpg,
    points: form.pts - rates.pts,
    games: form.games,
  };
}
