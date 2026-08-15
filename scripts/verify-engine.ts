/**
 * Guards the demo-critical behaviour: the same player must rank differently
 * under points vs category scoring, for the right reason.
 *
 * Run with `npm run verify`. Hits the live Sleeper API (cached to .cache/).
 */
import { getPlayers, getSeasonStats } from "../src/lib/sleeper/client";
import { fantasyRelevant, ratesFromStats, rateOf } from "../src/lib/engine/rates";
import {
  categoryLabels,
  categoryZScores,
  computeNorms,
  rankPlayers,
} from "../src/lib/engine/scoring";
import { nbaProfile } from "../src/lib/sports";

const profile = nbaProfile;
const SEASON = process.env.COURTIQ_SEASON ?? "2025";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log(
    `\nCourtIQ engine verification — ${profile.label}, season ${SEASON}\n${"─".repeat(64)}`,
  );

  const [players, stats] = await Promise.all([
    getPlayers(profile.id),
    getSeasonStats(profile.id, SEASON),
  ]);
  const rates = ratesFromStats(profile, stats);
  const pool = fantasyRelevant(profile, rates.values());
  const norms = computeNorms(profile, rates.values());
  const labels = categoryLabels(profile);
  const keys = profile.categories.map((c) => c.key);

  const name = (id: string) => players[id]?.full_name ?? `#${id}`;
  const pos = (id: string) => players[id]?.fantasy_positions?.[0] ?? "—";
  const pointsSettings = profile.defaultPointsSettings;

  console.log(`\nPool: ${pool.length} fantasy-relevant players of ${rates.size} with stats`);
  console.log(
    `Baselines: ${profile.categories
      .filter((c) => c.volumeWeighted)
      .map((c) => `${c.label} ${((norms.poolRatio[c.key] ?? 0) * 100).toFixed(1)}`)
      .join("  ")}`,
  );

  /* ── 1. Sanity: the pool and its z-scores are well-formed ─────────────── */
  console.log(`\n[1] Pool sanity`);
  check(
    "pool is a plausible fantasy universe (100-400)",
    pool.length >= 100 && pool.length <= 400,
    `${pool.length}`,
  );
  const meanZ =
    pool.reduce((s, p) => {
      const z = categoryZScores(profile, p, norms);
      return s + keys.reduce((a, k) => a + z[k], 0);
    }, 0) / pool.length;
  check("mean total z across pool sits near 0", Math.abs(meanZ) < 0.5, `${meanZ.toFixed(3)}`);

  /* ── 2. Inverted categories — the flagged bug spot ────────────────────── */
  console.log(`\n[2] Inverted category handling`);
  for (const cat of profile.categories.filter((c) => c.invert)) {
    const sorted = [...pool].sort((a, b) => rateOf(a, cat.key) - rateOf(b, cat.key));
    const cleanest = sorted[0];
    const sloppiest = sorted[sorted.length - 1];
    const zClean = categoryZScores(profile, cleanest, norms)[cat.key];
    const zSloppy = categoryZScores(profile, sloppiest, norms)[cat.key];
    check(
      `low-${cat.label} player earns positive ${cat.label} z`,
      zClean > 0,
      `${name(cleanest.playerId)} ${rateOf(cleanest, cat.key).toFixed(1)}/g -> z ${zClean.toFixed(2)}`,
    );
    check(
      `high-${cat.label} player earns negative ${cat.label} z`,
      zSloppy < 0,
      `${name(sloppiest.playerId)} ${rateOf(sloppiest, cat.key).toFixed(1)}/g -> z ${zSloppy.toFixed(2)}`,
    );
  }

  /* ── 3. The demo moment: ranks must visibly diverge ───────────────────── */
  console.log(`\n[3] Format divergence`);
  const cat = rankPlayers(profile, pool, "category", norms, pointsSettings);
  const pts = rankPlayers(profile, pool, "points", norms, pointsSettings);
  const catRank = new Map(cat.map((p, i) => [p.playerId, i + 1]));
  const ptsRank = new Map(pts.map((p, i) => [p.playerId, i + 1]));

  const movers = pool
    .map((p) => {
      const c = catRank.get(p.playerId)!;
      const q = ptsRank.get(p.playerId)!;
      return { id: p.playerId, cat: c, pts: q, delta: c - q, rates: p };
    })
    // Only consider players actually near the top in one format — a swing from
    // rank 280 to 250 is noise, not a story.
    .filter((m) => Math.min(m.cat, m.pts) <= 60)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  check("at least one top-60 player moves 20+ ranks", movers.some((m) => Math.abs(m.delta) >= 20));

  console.log(`\n  Biggest rank swings among top-60 players:\n`);
  console.log(
    `  ${"Player".padEnd(24)}${"Pos".padEnd(5)}${"CAT".padStart(6)}${"PTS".padStart(6)}${"Δ".padStart(7)}   why`,
  );
  for (const m of movers.slice(0, 10)) {
    const z = categoryZScores(profile, m.rates, norms);
    const worst = keys.reduce((a, b) => (z[a] < z[b] ? a : b));
    const best = keys.reduce((a, b) => (z[a] > z[b] ? a : b));
    const dir = m.delta > 0 ? "better in PTS" : "better in CAT";
    const why =
      m.delta > 0
        ? `${dir}: ${labels[worst]} z ${z[worst].toFixed(2)}`
        : `${dir}: ${labels[best]} z ${z[best].toFixed(2)}`;
    console.log(
      `  ${name(m.id).slice(0, 23).padEnd(24)}${pos(m.id).padEnd(5)}${String(m.cat).padStart(6)}${String(m.pts).padStart(6)}${(m.delta > 0 ? "+" : "") + m.delta}`.padEnd(
        48,
      ) + `   ${why}`,
    );
  }

  /* ── 4. The specific contrast the pitch claims ────────────────────────── */
  console.log(`\n[4] Volume-vs-efficiency contrast`);
  const fgBaseline = norms.poolRatio["fgPct"] ?? 0;

  const inefficientVolume = pool
    .filter((p) => rateOf(p, "fga") >= 12 && rateOf(p, "fgPct") < fgBaseline - 0.02)
    .map((p) => ({ p, delta: catRank.get(p.playerId)! - ptsRank.get(p.playerId)! }));
  const helped = inefficientVolume.filter((x) => x.delta > 0).length;
  check(
    "most high-volume/low-efficiency scorers rank better in Points",
    inefficientVolume.length > 0 && helped / inefficientVolume.length > 0.6,
    `${helped}/${inefficientVolume.length}`,
  );

  const efficientSpecialist = pool
    .filter(
      (p) =>
        rateOf(p, "fga") < 10 &&
        rateOf(p, "fgPct") > fgBaseline + 0.03 &&
        rateOf(p, "stl") + rateOf(p, "blk") >= 1.2,
    )
    .map((p) => ({ p, delta: catRank.get(p.playerId)! - ptsRank.get(p.playerId)! }));
  const helpedCat = efficientSpecialist.filter((x) => x.delta < 0).length;
  check(
    "efficient low-usage specialists rank better in categories",
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
