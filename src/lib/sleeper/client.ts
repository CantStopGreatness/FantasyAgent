import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  SleeperLeague,
  SleeperLeagueUser,
  SleeperPlayer,
  SleeperRoster,
  SleeperUser,
  StatsBySeason,
} from "./types";

const BASE = "https://api.sleeper.app/v1";
const CACHE_DIR = path.join(process.cwd(), ".cache");

/** Thrown for expected, user-facing failures (bad username, unknown league). */
export class SleeperError extends Error {
  constructor(
    message: string,
    readonly status: number = 502,
  ) {
    super(message);
    this.name = "SleeperError";
  }
}

async function getJSON<T>(endpoint: string): Promise<T | null> {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { accept: "application/json" },
    // We do our own disk caching; don't let Next's fetch cache hold the 2.4MB
    // player dictionary in memory on every route.
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new SleeperError(
      `Sleeper API returned ${res.status} for ${endpoint}`,
      res.status === 429 ? 429 : 502,
    );
  }

  const body = (await res.json()) as T | null;
  // Sleeper answers unknown users/leagues with a literal `null` body and a 200.
  return body ?? null;
}

/* ── Disk cache ─────────────────────────────────────────────────────────────
 * The player dictionary is ~2.4MB and season stats ~320KB. Both are static
 * enough to fetch once and reuse. We keep an in-process memo so warm requests
 * skip disk entirely, backed by a JSON file so a dev-server restart is cheap.
 */

const memo = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  const file = path.join(CACHE_DIR, `${key}.json`);
  try {
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs < ttlMs) {
      const value = JSON.parse(await fs.readFile(file, "utf8")) as T;
      memo.set(key, { at: Date.now(), value });
      return value;
    }
  } catch {
    // No cache file yet, or it is unreadable — fall through and refetch.
  }

  const value = await load();
  memo.set(key, { at: Date.now(), value });
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(value), "utf8");
  } catch {
    // A read-only filesystem (e.g. serverless) is fine — the memo still serves.
  }
  return value;
}

const DAY = 24 * 60 * 60 * 1000;

/* ── Endpoints ─────────────────────────────────────────────────────────── */

export async function getUser(username: string): Promise<SleeperUser | null> {
  return getJSON<SleeperUser>(`/user/${encodeURIComponent(username.trim())}`);
}

export async function getLeaguesForUser(
  userId: string,
  season: string,
): Promise<SleeperLeague[]> {
  return (await getJSON<SleeperLeague[]>(`/user/${userId}/leagues/nba/${season}`)) ?? [];
}

export async function getLeague(leagueId: string): Promise<SleeperLeague | null> {
  return getJSON<SleeperLeague>(`/league/${encodeURIComponent(leagueId.trim())}`);
}

export async function getRosters(leagueId: string): Promise<SleeperRoster[]> {
  return (await getJSON<SleeperRoster[]>(`/league/${leagueId}/rosters`)) ?? [];
}

export async function getLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
  return (await getJSON<SleeperLeagueUser[]>(`/league/${leagueId}/users`)) ?? [];
}

export async function getNBAState(): Promise<{
  season: string;
  previous_season: string;
  season_type: string;
  display_week: number;
}> {
  const state = await getJSON<{
    season: string;
    previous_season: string;
    season_type: string;
    display_week: number;
  }>("/state/nba");
  if (!state) throw new SleeperError("Could not read NBA season state from Sleeper");
  return state;
}

/**
 * Full NBA player dictionary, trimmed to the ~10 fields we use.
 *
 * Sleeper explicitly asks callers not to hammer this endpoint; we hold it for
 * a day. Trimming drops the payload from ~2.4MB to a few hundred KB, which
 * matters because this gets held in memory for the life of the process.
 */
export async function getPlayers(): Promise<Record<string, SleeperPlayer>> {
  return cached("players-nba", DAY, async () => {
    const raw = await getJSON<Record<string, Record<string, unknown>>>("/players/nba");
    if (!raw) throw new SleeperError("Could not load the NBA player dictionary");

    const trimmed: Record<string, SleeperPlayer> = {};
    for (const [id, p] of Object.entries(raw)) {
      // Skip Sleeper's synthetic team entries (TEAM_DEN and friends).
      if (id.startsWith("TEAM_")) continue;
      const positions = Array.isArray(p.fantasy_positions)
        ? (p.fantasy_positions as string[])
        : null;
      trimmed[id] = {
        player_id: id,
        full_name:
          (p.full_name as string) ??
          [p.first_name, p.last_name].filter(Boolean).join(" ") ??
          null,
        first_name: (p.first_name as string) ?? null,
        last_name: (p.last_name as string) ?? null,
        team: (p.team as string) ?? null,
        active: Boolean(p.active),
        fantasy_positions: positions,
        injury_status: (p.injury_status as string) ?? null,
        age: typeof p.age === "number" ? p.age : null,
        number: typeof p.number === "number" ? p.number : null,
      };
    }
    return trimmed;
  });
}

/** Season-long stat totals for every player, keyed by Sleeper player ID. */
export async function getSeasonStats(season: string): Promise<StatsBySeason> {
  return cached(`stats-nba-${season}`, DAY, async () => {
    const raw = await getJSON<StatsBySeason>(`/stats/nba/regular/${season}`);
    if (!raw) throw new SleeperError(`No NBA stats available for the ${season} season`);
    return raw;
  });
}

/** Per-week stat totals — used to derive recent-form trends. */
export async function getWeekStats(season: string, week: number): Promise<StatsBySeason> {
  return cached(`stats-nba-${season}-w${week}`, DAY, async () => {
    return (await getJSON<StatsBySeason>(`/stats/nba/regular/${season}/${week}`)) ?? {};
  });
}

/** Players most added across all Sleeper NBA leagues — a real "buzz" signal. */
export async function getTrendingAdds(
  lookbackHours = 168,
  limit = 60,
): Promise<Record<string, number>> {
  try {
    const rows =
      (await getJSON<{ player_id: string; count: number }[]>(
        `/players/nba/trending/add?lookback_hours=${lookbackHours}&limit=${limit}`,
      )) ?? [];
    return Object.fromEntries(rows.map((r) => [r.player_id, r.count]));
  } catch {
    // Buzz is decoration, never a hard dependency.
    return {};
  }
}
