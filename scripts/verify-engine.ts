/**
 * Guards the demo-critical behaviour: the same player must rank differently
 * under Points vs 9-CAT scoring, for the right reason.
 *
 * Run with `npm run verify`. Hits the live Sleeper API (cached to .cache/).
 */
import { getPlayers, getSeasonStats } from "../src/lib/sleeper/client";
import { fantasyRelevant, ratesFromStats } from "../src/lib/nba/rates";
import {
  CATEGORY_KEYS,
  CATEGORY_LABELS,
  categoryZScores,
  computeNorms,
  DEFAULT_POINTS_SETTINGS,
  rankPlayers,
} from "../src/lib/nba/scoring";

const SEASON = process.env.COURTIQ_SEASON ?? "2025";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log(`\nCourtIQ engine verification (season ${SEASON})\n${"─".repeat(64)}`);

  const [players, stats] = await Promise.all([getPlayers(), getSeasonStats(SEASON)]);
  const rates = ratesFromStats(stats);
  const pool = fantasyRelevant(rates.values());
  const norms = computeNorms(rates.values());

  const name = (id: string) => players[id]?.full_name ?? `#${id}`;
  const pos = (id: string) => players[id]?.fantasy_positions?.[0] ?? "—";

  console.log(`\nPool: ${pool.length} fantasy-relevant players of ${rates.size} with stats`);
  console.log(
    `Baselines: FG% ${(norms.poolFgPct * 100).toFixed(1)}  FT% ${(norms.poolFtPct * 100).toFixed(1)}`,
  );

  /* ── 1. Sanity: the pool and its z-scores are well-formed ─────────────── */
  console.log(`\n[1] Pool sanity`);
  check("pool is a plausible fantasy universe (100-400)", pool.length >= 100 && pool.length <= 400, `${pool.length}`);
  const meanZ =
    pool.reduce((s, p) => {
      const z = categoryZScores(p, norms);
      return s + CATEGORY_KEYS.reduce((a, k) => a + z[k], 0);
    }, 0) / pool.length;
  check("mean total z across pool sits near 0", Math.abs(meanZ) < 0.5, `${meanZ.toFixed(3)}`);

  /* ── 2. Turnover inversion — the flagged bug spot ─────────────────────── */
  console.log(`\n[2] Turnover inversion`);
  const sortedByTo = [...pool].sort((a, b) => a.to - b.to);
  const cleanest = sortedByTo[0];
  const sloppiest = sortedByTo[sortedByTo.length - 1];
  const zClean = categoryZScores(cleanest, norms).to;
  const zSloppy = categoryZScores(sloppiest, norms).to;
  check(
    "low-TO player earns positive TO z",
    zClean > 0,
    `${name(cleanest.playerId)} ${cleanest.to.toFixed(1)} TO/g -> z ${zClean.toFixed(2)}`,
  );
  check(
    "high-TO player earns negative TO z",
    zSloppy < 0,
    `${name(sloppiest.playerId)} ${sloppiest.to.toFixed(1)} TO/g -> z ${zSloppy.toFixed(2)}`,
  );

  /* ── 3. The demo moment: ranks must visibly diverge ───────────────────── */
  console.log(`\n[3] Format divergence`);
  const cat = rankPlayers(pool, "category", norms);
  const pts = rankPlayers(pool, "points", norms, DEFAULT_POINTS_SETTINGS);
  const catRank = new Map(cat.map((p, i) => [p.playerId, i + 1]));
  const ptsRank = new Map(pts.map((p, i) => [p.playerId, i + 1]));

  const movers = pool
    .map((p) => {
      const c = catRank.get(p.playerId)!;
      const q = ptsRank.get(p.playerId)!;
      return { id: p.playerId, cat: c, pts: q, delta: c - q, rates: p };
    })
    // Only consider players who are actually near the top in one format —
    // a swing from rank 280 to 250 is noise, not a story.
    .filter((m) => Math.min(m.cat, m.pts) <= 60)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  check("at least one top-60 player moves 20+ ranks", movers.some((m) => Math.abs(m.delta) >= 20));

  console.log(`\n  Biggest rank swings among top-60 players:\n`);
  console.log(
    `  ${"Player".padEnd(24)}${"Pos".padEnd(5)}${"9CAT".padStart(6)}${"PTS".padStart(6)}${"Δ".padStart(7)}   why`,
  );
  for (const m of movers.slice(0, 10)) {
    const z = categoryZScores(m.rates, norms);
    const worst = CATEGORY_KEYS.reduce((a, b) => (z[a] < z[b] ? a : b));
    const best = CATEGORY_KEYS.reduce((a, b) => (z[a] > z[b] ? a : b));
    const dir = m.delta > 0 ? "better in PTS" : "better in 9CAT";
    const why =
      m.delta > 0
        ? `${dir}: ${CATEGORY_LABELS[worst]} z ${z[worst].toFixed(2)}`
        : `${dir}: ${CATEGORY_LABELS[best]} z ${z[best].toFixed(2)}`;
    console.log(
      `  ${name(m.id).slice(0, 23).padEnd(24)}${pos(m.id).padEnd(5)}${String(m.cat).padStart(6)}${String(m.pts).padStart(6)}${(m.delta > 0 ? "+" : "") + m.delta}`.padEnd(48) +
        `   ${why}`,
    );
  }

  /* ── 4. The specific contrast the pitch claims ────────────────────────── */
  console.log(`\n[4] Volume-vs-efficiency contrast`);
  // A high-usage, poor-efficiency scorer should be materially better in Points.
  const inefficientVolume = pool
    .filter((p) => p.fga >= 12 && p.fgPct < norms.poolFgPct - 0.02)
    .map((p) => ({ p, delta: catRank.get(p.playerId)! - ptsRank.get(p.playerId)! }));
  const helped = inefficientVolume.filter((x) => x.delta > 0).length;
  check(
    "most high-volume/low-efficiency scorers rank better in Points",
    inefficientVolume.length > 0 && helped / inefficientVolume.length > 0.6,
    `${helped}/${inefficientVolume.length}`,
  );

  // Efficient, low-usage specialists (defensive stats, clean shooting) should
  // be the mirror image: better in category.
  const efficientSpecialist = pool
    .filter((p) => p.fga < 10 && p.fgPct > norms.poolFgPct + 0.03 && p.stl + p.blk >= 1.2)
    .map((p) => ({ p, delta: catRank.get(p.playerId)! - ptsRank.get(p.playerId)! }));
  const helpedCat = efficientSpecialist.filter((x) => x.delta < 0).length;
  check(
    "efficient low-usage specialists rank better in 9-CAT",
    efficientSpecialist.length > 0 && helpedCat / efficientSpecialist.length > 0.6,
    `${helpedCat}/${efficientSpecialist.length}`,
  );

  console.log(`\n${"─".repeat(64)}`);
  if (failures) {
    console.log(`${failures} check(s) FAILED\n`);
    process.exit(1);
  }
  console.log(`All checks passed.\n`);
}

main().catch((err) => {
  console.error("\nVerification crashed:", err);
  process.exit(1);
});
