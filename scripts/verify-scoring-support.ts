import {
  categoryZScores,
  computeNorms,
  pointsScore,
} from "../src/lib/engine/scoring";
import { parseScoring, scoringCoverage } from "../src/lib/engine/settings";
import { isScoringKeySupported, nbaProfile } from "../src/lib/sports";

let failures = 0;

function checkEqual(label: string, actual: unknown, expected: unknown) {
  const ok = Object.is(actual, expected);
  const detail = ok ? "" : " — expected " + String(expected) + ", got " + String(actual);
  console.log((ok ? "  PASS  " : "  FAIL  ") + label + detail);
  if (!ok) failures++;
}

function main() {
  console.log("\nCourtIQ scoring-support verification\n" + "─".repeat(64));

  const rates = nbaProfile.toRates("supported-player", {
    gp: 10,
    pts: 100,
    oreb: 30,
    dd: 4,
    td: 2,
    ff: 1,
    tf: 5,
  });
  if (!rates) throw new Error("Expected a valid deterministic player rate");

  const normal = pointsScore(nbaProfile, rates, { pts: 1, td: 3 });
  const absurd = pointsScore(nbaProfile, rates, { pts: 1, td: 1000 });

  checkEqual("a supported scoring weight changes the deterministic score", normal, 10.6);
  checkEqual("the same supported rate honors an extreme imported weight", absurd, 210);
  checkEqual("offensive rebounds use their exact per-game rate", rates.oreb, 3);
  checkEqual("double-doubles use their exact per-game rate", rates.dd, 0.4);
  checkEqual("triple-doubles use their exact per-game rate", rates.td, 0.2);
  checkEqual("flagrant fouls use their exact per-game rate", rates.ff, 0.1);
  checkEqual("technical fouls use their exact per-game rate", rates.tf, 0.5);

  const unsupportedKey = "unsupported_box_score";
  const withoutUnsupported = pointsScore(nbaProfile, rates, { pts: 1 });
  const withAbsurdUnsupported = pointsScore(nbaProfile, rates, {
    pts: 1,
    [unsupportedKey]: 1000,
  });
  const imported = parseScoring(nbaProfile, {
    pts: 1,
    reb: 0,
    [unsupportedKey]: 1000,
  });
  const unsupported = imported.find((stat) => stat.key === unsupportedKey);
  const coverage = scoringCoverage(imported);

  checkEqual(
    "an undeclared scoring key is reported unsupported",
    isScoringKeySupported(nbaProfile, unsupportedKey),
    false,
  );
  for (const ambiguousBonus of [
    "bonus_pt_40p",
    "bonus_pt_50p",
    "bonus_ast_15p",
    "bonus_reb_20p",
  ]) {
    checkEqual(
      ambiguousBonus + " is excluded because the upstream value is not an event total",
      isScoringKeySupported(nbaProfile, ambiguousBonus),
      false,
    );
  }
  checkEqual("the imported unsupported row is explicitly marked", unsupported?.supported, false);
  checkEqual(
    "an absurd unsupported weight is excluded from the deterministic score",
    withAbsurdUnsupported,
    withoutUnsupported,
  );
  checkEqual("coverage counts supported imported keys", coverage.supported, 2);
  checkEqual("coverage counts every imported key, including zero weights", coverage.total, 3);

  const clean = nbaProfile.toRates("clean", {
    gp: 20,
    sp: 36000,
    to: 20,
    fgm: 60,
    fga: 100,
  });
  const highVolume = nbaProfile.toRates("high-volume", {
    gp: 20,
    sp: 36000,
    to: 80,
    fgm: 240,
    fga: 400,
  });
  const baseline = nbaProfile.toRates("baseline", {
    gp: 20,
    sp: 36000,
    to: 40,
    fgm: 200,
    fga: 500,
  });
  if (!clean || !highVolume || !baseline) {
    throw new Error("Expected valid deterministic category rates");
  }

  const categoryPool = [clean, highVolume, baseline];
  const norms = computeNorms(nbaProfile, categoryPool);
  const cleanZ = categoryZScores(nbaProfile, clean, norms);
  const highVolumeZ = categoryZScores(nbaProfile, highVolume, norms);

  checkEqual("lower turnovers still produce a positive inverted z-score", cleanZ.to > 0, true);
  checkEqual(
    "higher turnovers still produce a negative inverted z-score",
    highVolumeZ.to < 0,
    true,
  );
  checkEqual(
    "equal shooting percentage has more impact at higher volume",
    highVolumeZ.fgPct > cleanZ.fgPct,
    true,
  );

  console.log("\n" + "─".repeat(64));
  if (failures) {
    console.log(String(failures) + " check(s) FAILED\n");
    process.exit(1);
  }
  console.log("All checks passed.\n");
}

main();
