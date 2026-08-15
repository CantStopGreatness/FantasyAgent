/**
 * Exercises the full recommendation pipeline against a synthetic league built
 * from real Sleeper stats — waivers, sleepers, rosters, and the trade engine.
 *
 * Covers the logic a live league would exercise without needing anyone's
 * credentials. Run with `npm run verify:league`.
 */
import { getPlayers, getSeasonStats } from "../src/lib/sleeper/client";
import { fantasyRelevant, ratesFromStats } from "../src/lib/engine/rates";
import { computeNorms, rankPlayers } from "../src/lib/engine/scoring";
import type { LeagueSnapshot, LeagueTeam } from "../src/lib/engine/league";
import {
  buildAnalysis,
  getSleepers,
  getTeamRoster,
  getWaiverRecommendations,
} from "../src/lib/engine/recommend";
import { groupFor, groupLabel, suggestTrade } from "../src/lib/engine/trade";
import { nbaProfile } from "../src/lib/sports";

const profile = nbaProfile;
const SEASON = process.env.COURTIQ_SEASON ?? "2025";
const TEAM_COUNT = 10;
const ROSTER_SIZE = 12;

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log(
    `\nCourtIQ league pipeline — synthetic ${TEAM_COUNT}-team ${profile.label} league\n${"─".repeat(66)}`,
  );

  const [players, stats] = await Promise.all([
    getPlayers(profile.id),
    getSeasonStats(profile.id, SEASON),
  ]);
  const rates = ratesFromStats(profile, stats);
  const norms = computeNorms(profile, rates.values());
  const pool = fantasyRelevant(profile, rates.values()).filter(
    (r) => players[r.playerId]?.active,
  );

  // Draft snake-style off the category board so rosters look like a real
  // league: strong teams at the top, positional scarcity emerging naturally.
  const board = rankPlayers(profile, pool, "category", norms, profile.defaultPointsSettings);
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
    sport: profile.id,
    teamCount: TEAM_COUNT,
    format: "category",
    rules: {
      format: "category",
      formatInferred: false,
      rosterSize: 10,
      settings: [],
      scoring: [],
      raw: {},
    },
    scoringSettings: null,
    rosterPositions: null,
    teams,
    rosteredIds: [...new Set(rosters.flat())],
    userTeamId: 1,
    statsSeason: SEASON,
    currentWeek: null,
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
  check("the two formats disagree on the top 12", overlap < 12, `${12 - overlap} of 12 differ`);

  console.log(`\n  CATEGORY top 5                  |  POINTS top 5`);
  console.log(`  ${"-".repeat(31)} |  ${"-".repeat(31)}`);
  for (let i = 0; i < 5; i++) {
    const c = catWaivers[i];
    const p = ptsWaivers[i];
    const left = `${i + 1}. ${name(c.playerId).slice(0, 20)} ${c.score.toFixed(1)}`;
    const right = `${i + 1}. ${name(p.playerId).slice(0, 20)} ${p.score.toFixed(1)}`;
    console.log(`  ${left.padEnd(31)} |  ${right}`);
  }

  // The cross-format delta is what replaces the old toggle as the visible
  // intelligence, so assert the cards actually carry it.
  const movers = catWaivers
    .filter((w) => w.rankDelta !== null && Math.abs(w.rankDelta) >= 8)
    .slice(0, 3);
  check("waiver cards surface cross-format rank movement", movers.length > 0);
  for (const m of movers) {
    console.log(
      `  ${name(m.playerId)} rates ${m.rankDelta! > 0 ? "+" : ""}${m.rankDelta} vs the other format`,
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
  check(
    "user roster scores every drafted player",
    mine.length === ROSTER_SIZE,
    `${mine.length}/${ROSTER_SIZE}`,
  );
  check(
    "roster is sorted best-first",
    mine.every((p, i) => i === 0 || mine[i - 1].score >= p.score),
  );

  /* ── Trades ───────────────────────────────────────────────────────────── */
  console.log(`\n[4] Trade engine`);
  let found = 0;
  let rejected = 0;
  for (const team of teams.slice(1)) {
    const result = suggestTrade(ctx, team.rosterId, "category");
    if (result.ok) {
      found++;
      const p = result.proposal;
      // The whole point of the rule: each side receives at the position it lacks.
      const giveGroup = groupFor(profile, p.give.position);
      const recvGroup = groupFor(profile, p.receive.position);
      if (recvGroup !== p.userNeed || giveGroup !== p.partnerNeed) {
        check(`trade vs ${team.teamName} addresses the stated needs`, false);
      }
      if (found <= 3) {
        console.log(
          `  vs ${team.teamName}: send ${name(p.give.playerId)} (${p.give.position}), ` +
            `get ${name(p.receive.playerId)} (${p.receive.position}) — ` +
            `you need ${groupLabel(profile, p.userNeed)}, they need ${groupLabel(profile, p.partnerNeed)} [${p.fairness}]`,
        );
      }
    } else {
      rejected++;
    }
  }
  check(
    "engine produces trades across the league",
    found > 0,
    `${found} found, ${rejected} declined`,
  );

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
