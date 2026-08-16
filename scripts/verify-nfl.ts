import assert from "node:assert/strict";
import { getProfile } from "../src/lib/sports";
import { pointsScore } from "../src/lib/engine/scoring";

const profile = getProfile("nfl");
assert.ok(profile, "NFL profile is registered");
assert.equal(profile.supportsCategories, false, "NFL is points-only");
assert.deepEqual(
  profile.positionGroups.map((group) => group.id),
  ["QB", "RB", "WR", "TE", "K", "DEF"],
  "NFL positions are mapped to football groups",
);

const rates = profile.toRates("qb", {
  gp: 2,
  pass_yd: 600,
  pass_td: 4,
  pass_int: 1,
  rush_yd: 40,
  rush_td: 1,
});
assert.ok(rates);
assert.equal(rates.pass_yd, 300);
assert.equal(rates.pass_td, 2);
assert.equal(
  pointsScore(profile, rates, { pass_yd: 0.04, pass_td: 4, pass_int: -2, rush_yd: 0.1, rush_td: 6 }),
  24,
);
assert.equal(profile.pointsScoring.some((key) => key.key === "made_field_goal"), false);

console.log("NFL profile verification passed");
