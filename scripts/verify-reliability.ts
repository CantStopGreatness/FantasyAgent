/** Focused reliability checks for CourtIQ's data and optional narration boundaries. */
import assert from "node:assert/strict";
import {
  OLLAMA_TIMEOUT_MS,
  sleeperCommentary,
  tradeCommentary,
  waiverCommentary,
  type LeagueContext,
  type SleeperBrief,
  type TradeBrief,
  type WaiverBrief,
} from "../src/lib/ai/persona";
import {
  narrationCacheKey,
  normalizeNarrationBrief,
} from "../src/lib/ai/cache";
import { DEMO_LEAGUE_ID, DEMO_USER_ID } from "../src/lib/demo";
import { buildSnapshot } from "../src/lib/engine/league";
import {
  buildAnalysis,
  getWaiverRecommendations,
} from "../src/lib/engine/recommend";
import { suggestTrade } from "../src/lib/engine/trade";
import { getUser, SLEEPER_TIMEOUT_MS } from "../src/lib/sleeper/client";

const league: LeagueContext = {
  sportNoun: "basketball",
  rules: ["Format: points", "Trade deadline: week 12"],
};

const waiverBrief: WaiverBrief = {
  name: "A Player",
  position: "G",
  team: "TOR",
  format: "points",
  rank: 1,
  statLine: "18 PTS, 5 REB, 7 AST",
  strengths: "assists and points",
  weakness: "turnovers",
  rankDelta: 12,
  tags: ["Hot add"],
};

const sleeperBrief: SleeperBrief = {
  name: "A Sleeper",
  position: "F",
  team: "NYK",
  reason: "recent-form and per-36 signals both improved",
  statLine: "12 PTS, 6 REB, 2 AST",
  format: "points",
};

const tradeBrief: TradeBrief = {
  giveName: "Giving Guard",
  givePosition: "G",
  giveStats: "17 PTS, 8 AST",
  receiveName: "Receiving Center",
  receivePosition: "C",
  receiveStats: "15 PTS, 10 REB",
  userNeed: "centers",
  partnerNeed: "guards",
  partnerTeamName: "Test Team",
  format: "points",
  fairness: "even",
};

function ollamaResponse(content: unknown, thinking = "internal reasoning that must stay hidden") {
  return new Response(
    JSON.stringify({
      model: process.env.OLLAMA_MODEL ?? "gpt-oss:20b",
      created_at: "2026-08-16T00:00:00Z",
      message: {
        role: "assistant",
        content,
        thinking,
        tool_calls: [],
        images: [],
      },
      done: true,
      done_reason: "stop",
      total_duration: 1,
      load_duration: 0,
      prompt_eval_count: 1,
      prompt_eval_duration: 1,
      eval_count: 1,
      eval_duration: 1,
      logprobs: [],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function main() {
  const base = {
    kind: "waiver",
    mode: "category",
    league: { sport: "nba", currentWeek: 4, rules: ["9-cat", "playoffs week 20"] },
    player: { name: "A Player", rank: 1, score: 2.4, reasons: ["rebounds"] },
    settings: { scoring: { reb: 1 }, overrides: { format: "category" } },
  };

  const first = narrationCacheKey(normalizeNarrationBrief(base));
  const differentScore = narrationCacheKey(
    normalizeNarrationBrief({ ...base, player: { ...base.player, score: 2.5 } }),
  );
  assert.notEqual(first, differentScore, "materially different briefs must not collide");
  assert.equal(
    narrationCacheKey(
      normalizeNarrationBrief({
        ...base,
        league: { ...base.league, rules: [...base.league.rules] },
      }),
    ),
    first,
    "identical normalized briefs should reuse the same cache key",
  );
  assert.ok(SLEEPER_TIMEOUT_MS >= 8_000 && SLEEPER_TIMEOUT_MS <= 20_000);
  assert.ok(OLLAMA_TIMEOUT_MS >= 8_000 && OLLAMA_TIMEOUT_MS <= 20_000);

  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OLLAMA_API_KEY;
  const originalModel = process.env.OLLAMA_MODEL;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  let remoteCalls = 0;

  try {
    delete process.env.OLLAMA_API_KEY;
    globalThis.fetch = (async () => {
      throw new Error("no-key narration must not call fetch");
    }) as typeof fetch;
    const noKey = await waiverCommentary(
      { ...waiverBrief, name: "No Key Player" },
      league,
    );
    assert.equal(noKey.fallback, true, "missing key must use deterministic fallback");
    assert.match(noKey.text, /No Key Player/);

    const snapshotBefore = await buildSnapshot(DEMO_LEAGUE_ID, DEMO_USER_ID);
    const contextBefore = await buildAnalysis(snapshotBefore);
    const rankingBefore = getWaiverRecommendations(contextBefore, snapshotBefore.format, 12)
      .map((player) => [player.playerId, player.score]);
    const opponent = snapshotBefore.teams.find((team) => !team.isUserTeam);
    assert.ok(opponent);
    const tradeBefore = suggestTrade(contextBefore, opponent.rosterId, snapshotBefore.format);
    assert.equal(tradeBefore.ok, true);

    process.env.OLLAMA_API_KEY = "test-key-ranking";
    globalThis.fetch = (async () => {
      remoteCalls += 1;
      return ollamaResponse("The supplied deterministic choice makes sense.");
    }) as typeof fetch;
    await waiverCommentary({ ...waiverBrief, name: "Ranking Invariant" }, league);
    await tradeCommentary({ ...tradeBrief, receiveName: "Trade Invariant" }, league);

    const snapshotAfter = await buildSnapshot(DEMO_LEAGUE_ID, DEMO_USER_ID);
    const contextAfter = await buildAnalysis(snapshotAfter);
    const rankingAfter = getWaiverRecommendations(contextAfter, snapshotAfter.format, 12)
      .map((player) => [player.playerId, player.score]);
    const tradeAfter = suggestTrade(contextAfter, opponent.rosterId, snapshotAfter.format);
    assert.deepEqual(
      rankingAfter,
      rankingBefore,
      "ranking output must be identical regardless of narration availability",
    );
    assert.deepEqual(
      tradeAfter,
      tradeBefore,
      "trade selection must be identical regardless of narration availability",
    );

    process.env.OLLAMA_API_KEY = "test-key-timeout";
    globalThis.fetch = ((_input, init) => {
      remoteCalls += 1;
      return new Promise<Response>((_resolve, reject) => {
        const guard = setTimeout(
          () => reject(new Error("mock provider did not receive an abort")),
          OLLAMA_TIMEOUT_MS + 2_000,
        );
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(guard);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    }) as typeof fetch;
    const timeoutStarted = Date.now();
    const timedOut = await sleeperCommentary(
      { ...sleeperBrief, name: "Timeout Sleeper" },
      league,
    );
    assert.equal(timedOut.fallback, true, "Ollama timeout must use fallback");
    assert.ok(Date.now() - timeoutStarted < OLLAMA_TIMEOUT_MS + 2_000);

    for (const status of [401, 403, 429, 500]) {
      process.env.OLLAMA_API_KEY = "test-key-status-" + status;
      globalThis.fetch = (async () => {
        remoteCalls += 1;
        return new Response(JSON.stringify({ error: "provider rejected request" }), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;
      const result = await waiverCommentary(
        { ...waiverBrief, name: "Status " + status },
        league,
      );
      assert.equal(result.fallback, true, "Ollama " + status + " must use fallback");
      assert.match(result.text, new RegExp("Status " + status));
    }

    process.env.OLLAMA_API_KEY = "test-key-network";
    globalThis.fetch = (async () => {
      remoteCalls += 1;
      throw new TypeError("mock network failure");
    }) as typeof fetch;
    assert.equal(
      (await sleeperCommentary({ ...sleeperBrief, name: "Network Failure" }, league)).fallback,
      true,
      "network failure must use fallback",
    );

    process.env.OLLAMA_API_KEY = "test-key-malformed-json";
    globalThis.fetch = (async () => {
      remoteCalls += 1;
      return new Response("{", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    assert.equal(
      (await waiverCommentary({ ...waiverBrief, name: "Malformed JSON" }, league)).fallback,
      true,
      "malformed JSON must use fallback",
    );

    process.env.OLLAMA_API_KEY = "test-key-malformed-shape";
    globalThis.fetch = (async () => {
      remoteCalls += 1;
      return ollamaResponse(42);
    }) as typeof fetch;
    assert.equal(
      (await waiverCommentary({ ...waiverBrief, name: "Malformed Shape" }, league)).fallback,
      true,
      "malformed response shape must use fallback",
    );

    process.env.OLLAMA_API_KEY = "test-key-empty";
    globalThis.fetch = (async () => {
      remoteCalls += 1;
      return ollamaResponse("   ");
    }) as typeof fetch;
    assert.equal(
      (await waiverCommentary({ ...waiverBrief, name: "Empty Message" }, league)).fallback,
      true,
      "empty message.content must use fallback",
    );

    process.env.OLLAMA_API_KEY = "test-key-request";
    process.env.OLLAMA_MODEL = "gpt-oss:20b";
    process.env.OLLAMA_BASE_URL = "https://ollama.com/api/";
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (input, init) => {
      remoteCalls += 1;
      capturedUrl = String(input);
      capturedInit = init;
      return ollamaResponse("Visible assistant narration.");
    }) as typeof fetch;
    const valid = await waiverCommentary(
      { ...waiverBrief, name: "Valid Response" },
      league,
    );
    assert.deepEqual(valid, { text: "Visible assistant narration.", fallback: false });
    assert.equal(capturedUrl, "https://ollama.com/api/chat");
    assert.equal(capturedInit?.method, "POST");
    const headers = new Headers(capturedInit?.headers);
    assert.equal(headers.get("Content-Type"), "application/json");
    assert.equal(headers.get("Authorization"), "Bearer test-key-request");
    const requestBody = JSON.parse(String(capturedInit?.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      stream: boolean;
      think: string;
    };
    assert.equal(requestBody.model, "gpt-oss:20b");
    assert.equal(requestBody.stream, false);
    assert.equal(requestBody.think, "low");
    assert.deepEqual(requestBody.messages.map((message) => message.role), ["system", "user"]);
    assert.ok(requestBody.messages[0].content.includes("never override"));
    assert.ok(requestBody.messages[1].content.includes("Valid Response"));
    assert.ok(!JSON.stringify(requestBody).includes("test-key-request"));

    process.env.OLLAMA_API_KEY = "test-key-cache";
    globalThis.fetch = (async () => {
      remoteCalls += 1;
      return ollamaResponse("Cached narration.");
    }) as typeof fetch;
    const beforeIdentical = remoteCalls;
    const identicalBrief = { ...sleeperBrief, name: "Identical Brief" };
    const identicalFirst = await sleeperCommentary(identicalBrief, league);
    const identicalSecond = await sleeperCommentary(
      { ...identicalBrief },
      { ...league, rules: [...league.rules] },
    );
    assert.deepEqual(identicalSecond, identicalFirst);
    assert.equal(remoteCalls - beforeIdentical, 1, "identical briefs must reuse cache");

    const beforeDifferent = remoteCalls;
    await sleeperCommentary({ ...sleeperBrief, name: "Brief A" }, league);
    await sleeperCommentary({ ...sleeperBrief, name: "Brief B" }, league);
    assert.equal(remoteCalls - beforeDifferent, 2, "materially different briefs must not collide");

    const modelBrief = { ...waiverBrief, name: "Model Identity" };
    const beforeModels = remoteCalls;
    process.env.OLLAMA_MODEL = "gpt-oss:20b";
    await waiverCommentary(modelBrief, league);
    process.env.OLLAMA_MODEL = "gpt-oss:120b";
    await waiverCommentary(modelBrief, league);
    assert.equal(remoteCalls - beforeModels, 2, "model identity must be part of cache identity");

    const keyBrief = { ...waiverBrief, name: "Key Isolation" };
    process.env.OLLAMA_MODEL = "gpt-oss:20b";
    process.env.OLLAMA_API_KEY = "test-key-a";
    const beforeKeys = remoteCalls;
    const firstKeyResult = await waiverCommentary(keyBrief, league);
    process.env.OLLAMA_API_KEY = "test-key-b";
    const secondKeyResult = await waiverCommentary(keyBrief, league);
    assert.deepEqual(secondKeyResult, firstKeyResult);
    assert.equal(remoteCalls - beforeKeys, 1, "API key must not be part of cache identity");

    delete process.env.OLLAMA_API_KEY;
    const cachedWithoutKey = await waiverCommentary(keyBrief, league);
    assert.equal(
      cachedWithoutKey.fallback,
      true,
      "missing key must immediately use fallback instead of cached provider text",
    );

    process.env.OLLAMA_API_KEY = "test-key-coalescing";
    let releaseCoalesced: ((response: Response) => void) | undefined;
    globalThis.fetch = (() => {
      remoteCalls += 1;
      return new Promise<Response>((resolve) => {
        releaseCoalesced = resolve;
      });
    }) as typeof fetch;
    const beforeCoalesced = remoteCalls;
    const coalescedBrief = { ...sleeperBrief, name: "Coalesced Brief" };
    const pendingA = sleeperCommentary(coalescedBrief, league);
    const pendingB = sleeperCommentary({ ...coalescedBrief }, league);
    await Promise.resolve();
    assert.equal(remoteCalls - beforeCoalesced, 1, "identical in-flight requests must coalesce");
    assert.ok(releaseCoalesced);
    releaseCoalesced(ollamaResponse("Coalesced narration."));
    assert.deepEqual(await pendingB, await pendingA);

    globalThis.fetch = (async () => {
      remoteCalls += 1;
      return ollamaResponse("Rate-limited test narration.");
    }) as typeof fetch;
    let refused = 0;
    for (let index = 0; index < 31; index += 1) {
      const result = await sleeperCommentary(
        { ...sleeperBrief, name: "Rate Brief " + index },
        league,
      );
      if (result.fallback) refused += 1;
    }
    assert.equal(remoteCalls, 30, "process-local guard must cap new generations at 30/minute");
    assert.ok(refused > 0, "rate refusal must leave deterministic fallback available");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OLLAMA_API_KEY;
    else process.env.OLLAMA_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.OLLAMA_MODEL;
    else process.env.OLLAMA_MODEL = originalModel;
    if (originalBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = originalBaseUrl;
  }

  globalThis.fetch = ((_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("Aborted", "AbortError"));
    });
  })) as typeof fetch;
  const sleeperStarted = Date.now();
  try {
    await assert.rejects(getUser("timeout-check"), /too long/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.ok(Date.now() - sleeperStarted < SLEEPER_TIMEOUT_MS + 2_000);

  console.log("Reliability checks passed");
  console.log("  Ollama fallback, request shape, cache, coalescing, and rate controls verified");
  console.log("  Deterministic ranking and trade selection verified across narration availability");
}

void main();
