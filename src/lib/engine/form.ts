import { getWeekStats } from "@/lib/sleeper/client";
import type { StatsBySeason } from "@/lib/sleeper/types";

/**
 * Late-season form, derived from Sleeper's per-week NBA stat files.
 *
 * An important caveat drives this whole module's design: a weekly file is a
 * *partial-week aggregate* covering an unknown number of games, and it carries
 * no `gp` field. Summing all 25 weeks recovers only ~30% of a player's season
 * totals, and treating one file as one game inflates every rate — a 16.8 MPG
 * bench player reads as 37 MPG.
 *
 * So we never claim a per-game number from this data. Instead we compare a
 * player's output *per file* late in the season against their own output *per
 * file* across the whole season. Both sides share the same unknown unit, so
 * the ratio is meaningful even though neither absolute figure is.
 */
export type FormDelta = {
  /** Change in playing time vs the player's own season rate, as a fraction. */
  minutesPct: number;
  /** Change in scoring vs the player's own season rate, as a fraction. */
  pointsPct: number;
  /** How many late-season files the player appears in (max 3). */
  appearances: number;
};

/** Weeks 1-25 carry data for the 2025 season; later weeks are empty. */
const LAST_WEEK = 25;
const RECENT_WEEKS = 3;

/** Below this we do not trust the split enough to say anything about it. */
const MIN_RECENT_APPEARANCES = 2;
const MIN_SEASON_APPEARANCES = 6;

type Tally = { files: number; seconds: number; pts: number };

function tally(files: StatsBySeason[]): Map<string, Tally> {
  const acc = new Map<string, Tally>();
  for (const file of files) {
    for (const [playerId, line] of Object.entries(file)) {
      if (playerId.startsWith("TEAM_")) continue;
      if (!line || Object.keys(line).length === 0) continue;
      const cur = acc.get(playerId) ?? { files: 0, seconds: 0, pts: 0 };
      cur.files += 1;
      cur.seconds += line.sp ?? 0;
      cur.pts += line.pts ?? 0;
      acc.set(playerId, cur);
    }
  }
  return acc;
}

/**
 * Compare each player's last three weekly files against their season-long
 * per-file average. Returns an empty map if the weekly endpoint is unavailable
 * — form is an enhancement and must never take down a recommendation request.
 */
export async function getRecentForm(sport: string, season: string): Promise<Map<string, FormDelta>> {
  const weeks = Array.from({ length: LAST_WEEK }, (_, i) => i + 1);

  let files: StatsBySeason[];
  try {
    files = await Promise.all(weeks.map((w) => getWeekStats(sport, season, w)));
  } catch {
    return new Map();
  }

  const seasonTally = tally(files);
  const recentTally = tally(files.slice(-RECENT_WEEKS));

  const out = new Map<string, FormDelta>();
  for (const [playerId, recent] of recentTally) {
    const all = seasonTally.get(playerId);
    if (!all) continue;
    if (recent.files < MIN_RECENT_APPEARANCES) continue;
    if (all.files < MIN_SEASON_APPEARANCES) continue;

    const seasonSecondsPerFile = all.seconds / all.files;
    const seasonPtsPerFile = all.pts / all.files;
    if (seasonSecondsPerFile <= 0) continue;

    out.set(playerId, {
      minutesPct: recent.seconds / recent.files / seasonSecondsPerFile - 1,
      pointsPct:
        seasonPtsPerFile > 0 ? recent.pts / recent.files / seasonPtsPerFile - 1 : 0,
      appearances: recent.files,
    });
  }
  return out;
}

/** Human-readable phrasing that does not overstate what the data supports. */
export function describeForm(delta: FormDelta): string | null {
  const pct = Math.round(delta.minutesPct * 100);
  if (pct >= 15) return `Playing time up ${pct}% over his season rate late in the year`;
  const scoring = Math.round(delta.pointsPct * 100);
  if (scoring >= 20) return `Scoring up ${scoring}% over his season rate down the stretch`;
  return null;
}
