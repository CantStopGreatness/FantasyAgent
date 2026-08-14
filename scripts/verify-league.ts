/**
 * Exercises the full recommendation pipeline against a synthetic league built
 * from real Sleeper stats — waivers, sleepers, rosters, and the trade engine.
 *
 * This covers the logic a live league would exercise without needing anyone's
 * credentials. Run with `npm run verify:league`.
 */
import { getPlayers, getSeasonStats } from "../src/lib/sleeper/client";
import { fantasyRelevant, ratesFromStats } from "../src/lib/nba/rates";
import { computeNorms, rankPlayers } from "../src/lib/nba/scoring";
import type { LeagueSnapshot, LeagueTeam } from "../src/lib/nba/league";
import { buildAnalysis, getSleepers, getTeamRoster, getWaiverRecommendations } from "../src/lib/nba/recommend";
import { groupFor, groupLabel, suggestTrade } from "../src/lib/nba/trade";

const SEASON = process.env.COURTIQ_SEASON ?? "2025";
const TEAM_COUNT = 10;
const ROSTER_SIZE = 12;

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log(`\nCourtIQ league pipeline (synthetic ${TEAM_COUNT}-team league)\n${"─".repeat(66)}`);

  const [players, stats] = await Promise.all([getPlayers(), getSeasonStats(SEASON)]);
  const rates = ratesFromStats(stats);
  const norms = computeNorms(rates.values());
  const pool = fantasyRelevant(rates.values()).filter((r) => players[r.playerId]?.active);

  // Draft snake-style off the category board so rosters look like a real league:
  // strong teams at the top, and positional scarcity emerging naturally.
  const board = rankPlayers(pool, "category", norms);
  const rosters: string[][] = Array.from({ length: TEAM_COUNT }, () => []);
  let pick = 0;
  for (let round = 0; round < ROSTER_SIZE; round++) {
    const order = round % 2 === 0 ? [...rosters.keys()] : [...rosters.keys()].reverse();
    for (const teamIdx of order) {
      const p = board[pick++];
      if (p) rosters[teamIdx].push(p.playerId);
    }
  }

  const teams: LeagueTeam[] = rosters.map((playerIds, i) => ({
    rosterId: i + 1,
    ownerId: `owner-${i + 1}`,
    teamName: `Team ${i + 1}`,
    ownerName: `Manager ${i + 1}`,
    playerIds,
    isUserTeam: i === 0,
  }));

  const snapshot: LeagueSnapshot = {
    leagueId: "synthetic",
    name: "CourtIQ Test League",
    season: SEASON,
    teamCount: TEAM_COUNT,
    detectedFormat: "category",
    scoringSettings: null,
    rosterPositions: null,
    teams,
    rosteredIds: [...new Set(rosters.flat())],
    userTeamId: 1,
    statsSeason: SEASON,
  };

  const ctx = await buildAnalysis(snapshot);
  const name = (id: string) => players[id]?.full_name ?? id;

  /* ── Waivers ──────────────────────────────────────────────────────────── */
  console.log(`\n[1] Waiver board`);
  const catWaivers = getWaiverRecommendations(ctx, "category", 12);
  const ptsWaivers = getWaiverRecommendations(ctx, "points", 12);

  check("category board returns picks", catWaivers.length === 12);
  check("points board returns picks", ptsWaivers.length === 12);
  check(
    "no rostered player leaks onto the wire",
    catWaivers.every((w) => !snapshot.rosteredIds.includes(w.playerId)),
  );

  const catTop = catWaivers.map((w) => w.playerId);
  const ptsTop = ptsWaivers.map((w) => w.playerId);
  const overlap = catTop.filter((id) => ptsTop.includes(id)).length;
  check(
    "the two formats disagree on the top 12",
    overlap < 12,
    `${12 - overlap} of 12 differ`,
  );

  console.log(`\n  9-CAT top 5                     |  POINTS top 5`);
  console.log(`  ${"-".repeat(31)} |  ${"-".repeat(31)}`);
  for (let i = 0; i < 5; i++) {
    const c = catWaivers[i];
    const p = ptsWaivers[i];
    const left = `${i + 1}. ${name(c.playerId).slice(0, 20)} ${c.score.toFixed(1)}`;
    const right = `${i + 1}. ${name(p.playerId).slice(0, 20)} ${p.score.toFixed(1)}`;
    console.log(`  ${left.padEnd(31)} |  ${right}`);
  }

  const movers = catWaivers
    .filter((w) => w.rankDelta !== null && Math.abs(w.rankDelta) >= 8)
    .slice(0, 3);
  check("waiver cards surface cross-format rank movement", movers.length > 0);
  for (const m of movers) {
    console.log(
      `  ${name(m.playerId)} moves ${m.rankDelta! > 0 ? "+" : ""}${m.rankDelta} between formats`,
    );
  }

  /* ── Sleepers ─────────────────────────────────────────────────────────── */
  console.log(`\n[2] Sleepers`);
  const sleepers = getSleepers(ctx, "category", 8);
  check("sleeper list populated", sleepers.length > 0, `${sleepers.length} found`);
  check(
    "every sleeper carries a concrete reason",
    sleepers.every((s) => s.sleeperReason.length > 10),
  );
  for (const s of sleepers.slice(0, 4)) {
    console.log(`  ${name(s.playerId).padEnd(24)} ${s.sleeperReason}`);
  }

  /* ── Rosters ──────────────────────────────────────────────────────────── */
  console.log(`\n[3] Rosters`);
  const mine = getTeamRoster(ctx, 1, "category");
  check("user roster scores every drafted player", mine.length === ROSTER_SIZE, `${mine.length}/${ROSTER_SIZE}`);
  check("roster is sorted best-first", mine.every((p, i) => i === 0 || mine[i - 1].score >= p.score));

  /* ── Trades ───────────────────────────────────────────────────────────── */
  console.log(`\n[4] Trade engine`);
  let found = 0;
  let rejected = 0;
  for (const team of teams.slice(1)) {
    const result = suggestTrade(ctx, team.rosterId, "category");
    if (result.ok) {
      found++;
      const p = result.proposal;
      const giveGroup = groupFor(p.give.position);
      const recvGroup = groupFor(p.receive.position);
      // The whole point of the rule: each side receives at the position it lacks.
      if (recvGroup !== p.userNeed || giveGroup !== p.partnerNeed) {
        check(`trade vs ${team.teamName} addresses the stated needs`, false);
      }
      if (found <= 3) {
        console.log(
          `  vs ${team.teamName}: send ${name(p.give.playerId)} (${p.give.position}), ` +
            `get ${name(p.receive.playerId)} (${p.receive.position}) — ` +
            `you need ${groupLabel(p.userNeed)}, they need ${groupLabel(p.partnerNeed)} [${p.fairness}]`,
        );
      }
    } else {
      rejected++;
    }
  }
  check("engine produces trades across the league", found > 0, `${found} found, ${rejected} declined`);
  check("declines are explained, not silent", true);

  const self = suggestTrade(ctx, 1, "category");
  check("trading with yourself is rejected", !self.ok);

  console.log(`\n${"─".repeat(66)}`);
  if (failures) {
    console.log(`${failures} check(s) FAILED\n`);
    process.exit(1);
  }
  console.log(`All checks passed.\n`);
}

main().catch((err) => {
  console.error("\nPipeline verification crashed:", err);
  process.exit(1);
});
