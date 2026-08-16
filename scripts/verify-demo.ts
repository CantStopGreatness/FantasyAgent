/** End-to-end deterministic invariants for the frozen CourtIQ demo. */
import assert from "node:assert/strict";
import {
  DEMO_FIXTURE,
  DEMO_FIXTURE_VERSION,
  DEMO_LEAGUE_ID,
  DEMO_USER_ID,
} from "../src/lib/demo";
import { buildSnapshot } from "../src/lib/engine/league";
import {
  buildAnalysis,
  getSleepers,
  getTeamRoster,
  getWaiverRecommendations,
} from "../src/lib/engine/recommend";
import { suggestTrade } from "../src/lib/engine/trade";

const ids = (players: { playerId: string }[]) => players.map((player) => player.playerId);
const rounded = (value: number) => Number(value.toFixed(1));

async function main() {
  delete process.env.OLLAMA_API_KEY;
  assert.equal(process.env.OLLAMA_API_KEY, undefined);
  assert.equal(DEMO_FIXTURE.version, DEMO_FIXTURE_VERSION);

  const fixtureRosterIds = DEMO_FIXTURE.rosters.flatMap((roster) => roster.players ?? []);
  assert.equal(
    new Set(fixtureRosterIds).size,
    fixtureRosterIds.length,
    "a fixture player must belong to at most one roster",
  );
  for (const playerId of fixtureRosterIds) {
    assert.ok(DEMO_FIXTURE.players[playerId], "every rostered ID must have player metadata");
    assert.ok(DEMO_FIXTURE.seasonStats[playerId], "every rostered ID must have stats");
  }
  for (const [playerId, line] of Object.entries(DEMO_FIXTURE.seasonStats)) {
    const pointsFromMakes = 2 * (line.fgm ?? 0) + (line.tpm ?? 0) + (line.ftm ?? 0);
    assert.ok(
      Math.abs((line.pts ?? 0) - pointsFromMakes) < 1e-8,
      playerId + " must have an internally consistent scoring line",
    );
  }

  const snapshot = await buildSnapshot(DEMO_LEAGUE_ID, DEMO_USER_ID);
  const context = await buildAnalysis(snapshot);
  assert.equal(snapshot.format, "points");
  assert.equal(snapshot.userTeamId, 1);
  assert.equal(snapshot.statsSeason, DEMO_FIXTURE_VERSION);
  assert.equal(snapshot.teams.length, DEMO_FIXTURE.rosters.length);

  const rostered = new Set(snapshot.rosteredIds);
  const waivers = getWaiverRecommendations(context, snapshot.format, 12);
  const sleepers = getSleepers(context, snapshot.format, 8);
  assert.ok(waivers.length >= 2, "the demo must have waiver candidates");
  assert.ok(sleepers.length > 0, "the demo must have sleeper candidates");
  assert.ok(
    [...waivers, ...sleepers].every((player) => !rostered.has(player.playerId)),
    "available recommendations must never leak a rostered player",
  );

  const fixtureUserRoster = DEMO_FIXTURE.rosters.find((roster) => roster.roster_id === 1);
  assert.ok(fixtureUserRoster?.players);
  assert.deepEqual(
    new Set(ids(getTeamRoster(context, 1, snapshot.format))),
    new Set(fixtureUserRoster.players),
    "My Team must contain exactly the fixture user's roster",
  );

  const tradeTargets = new Set<string>();
  for (const opponent of snapshot.teams.filter((team) => !team.isUserTeam)) {
    const fixtureRoster = DEMO_FIXTURE.rosters.find(
      (roster) => roster.roster_id === opponent.rosterId,
    );
    assert.ok(fixtureRoster?.players);
    assert.deepEqual(
      new Set(ids(getTeamRoster(context, opponent.rosterId, snapshot.format))),
      new Set(fixtureRoster.players),
      "selected opponent must map to its own fixture roster",
    );

    const trade = suggestTrade(context, opponent.rosterId, snapshot.format);
    assert.equal(trade.ok, true, opponent.teamName + " should produce a demo trade");
    if (!trade.ok) continue;
    assert.ok(
      fixtureRoster.players.includes(trade.proposal.receive.playerId),
      "trade target must belong to the selected partner",
    );
    assert.ok(
      fixtureUserRoster.players.includes(trade.proposal.give.playerId),
      "trade offer must belong to the user's roster",
    );
    assert.ok(
      !ids(waivers).includes(trade.proposal.receive.playerId),
      "trade target cannot also be an available waiver",
    );
    tradeTargets.add(trade.proposal.receive.playerId);
  }
  assert.equal(
    tradeTargets.size,
    snapshot.teams.filter((team) => !team.isUserTeam).length,
    "each offered opponent must produce its own trade target",
  );

  assert.deepEqual(ids(waivers.slice(0, 2)), ["demo-fa-devin", "demo-fa-marcus"]);
  assert.deepEqual(waivers.slice(0, 2).map((player) => rounded(player.score)), [37.9, 36]);

  const blocksFiveSnapshot = await buildSnapshot(DEMO_LEAGUE_ID, DEMO_USER_ID, {
    scoring: { blk: 5 },
  });
  const blocksFive = getWaiverRecommendations(
    await buildAnalysis(blocksFiveSnapshot),
    blocksFiveSnapshot.format,
    12,
  );
  assert.deepEqual(ids(blocksFive.slice(0, 2)), ["demo-fa-marcus", "demo-fa-devin"]);
  assert.deepEqual(blocksFive.slice(0, 2).map((player) => rounded(player.score)), [40.4, 38.5]);

  const unsupportedSnapshot = await buildSnapshot(DEMO_LEAGUE_ID, DEMO_USER_ID, {
    scoring: { bonus_pt_40p: 9999 },
  });
  const unsupported = getWaiverRecommendations(
    await buildAnalysis(unsupportedSnapshot),
    unsupportedSnapshot.format,
    12,
  );
  assert.deepEqual(
    unsupported.map((player) => [player.playerId, rounded(player.score)]),
    waivers.map((player) => [player.playerId, rounded(player.score)]),
    "unsupported scoring values must remain excluded from rankings",
  );
  assert.equal(
    unsupportedSnapshot.rules.scoring.find((stat) => stat.key === "bonus_pt_40p")
      ?.supported,
    false,
  );

  console.log("Demo invariants passed without Ollama Cloud");
  console.log("  BLK 3: Devin Cole 37.9, Marcus Bell 36.0");
  console.log("  BLK 5: Marcus Bell 40.4, Devin Cole 38.5");
}

void main();
