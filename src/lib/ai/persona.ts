import "server-only";
import { narrationCacheKey } from "./cache";

/**
 * The CourtIQ analyst voice.
 *
 * The model narrates; it never ranks. Every number in the prompt comes from
 * the deterministic scoring engine, and the model is told not to invent more -
 * a made-up stat on stage is worse than a boring sentence.
 *
 * The sport noun is injected so the persona is not hard-coded to basketball.
 */
function systemPrompt(sportNoun: string): string {
  return `You are CourtIQ, a concise and knowledgeable fantasy ${sportNoun} analyst.
You narrate a result already computed by CourtIQ's deterministic engine. You did not perform an independent ranking or selection.

Rules:
- Write 1-3 short sentences. No preamble; open on the supplied result.
- Explain why the supplied deterministic recommendation makes sense.
- Use only facts explicitly supplied in the user message. Never invent or infer schedules, injuries, ownership, matchup strength, category needs, projections, win probabilities, statistics, dates, trades, or storylines.
- Treat the computed recommendation as fixed: never override it, rerank anyone, suggest a different pickup or sleeper, or select a different trade.
- Be confident about the computed comparison, but do not promise real-world outcomes.
- Reference league context only when a supplied rule materially supports the explanation.
- Be lively but respectful toward real athletes.
- Plain text only. No markdown, no emoji, no bullet points.`;
}

/** League rules rendered as prompt lines, plus the sport's noun. */
export type LeagueContext = {
  sportNoun: string;
  /** Pre-formatted fact lines from the league's own settings. */
  rules: string[];
};

function renderContext(ctx: LeagueContext): string {
  if (!ctx.rules.length) return "";
  return `League rules:\n${ctx.rules.map((r) => `- ${r}`).join("\n")}\n\n`;
}

const PROVIDER = "ollama-cloud";
const DEFAULT_MODEL = "gpt-oss:20b";
const DEFAULT_BASE_URL = "https://ollama.com/api";
export const OLLAMA_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE = 200;
const MAX_GENERATIONS_PER_MINUTE = 30;

export type PersonaResult = {
  text: string;
  fallback: boolean;
};

function ollamaConfig() {
  return {
    apiKey: process.env.OLLAMA_API_KEY?.trim() || null,
    model: process.env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL,
    baseUrl: (process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ""),
  };
}

function assistantContent(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const message = (value as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const { role, content } = message as { role?: unknown; content?: unknown };
  if (role !== "assistant" || typeof content !== "string") return null;
  return content.trim() || null;
}

const cache = new Map<string, { text: string; expiresAt: number }>();
const inFlight = new Map<string, Promise<PersonaResult>>();
let generationTimes: number[] = [];

function canGenerate(): boolean {
  const now = Date.now();
  generationTimes = generationTimes.filter((at) => now - at < 60_000);
  if (generationTimes.length >= MAX_GENERATIONS_PER_MINUTE) return false;
  generationTimes.push(now);
  return true;
}

async function generateNarration(
  identity: unknown,
  league: LeagueContext,
  prompt: string,
  fallback: string,
): Promise<PersonaResult> {
  const config = ollamaConfig();
  if (!config.apiKey) return { text: fallback, fallback: true };

  const cacheKey = narrationCacheKey({
    provider: PROVIDER,
    model: config.model,
    identity,
    league,
    prompt,
  });
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return { text: hit.text, fallback: false };
  if (hit) cache.delete(cacheKey);

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const operation = (async (): Promise<PersonaResult> => {
    if (!canGenerate()) return { text: fallback, fallback: true };

    try {
      const response = await fetch(config.baseUrl + "/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + config.apiKey,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt(league.sportNoun) },
            { role: "user", content: renderContext(league) + prompt },
          ],
          stream: false,
          think: "low",
          options: { num_predict: 384, temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
      });
      if (!response.ok) return { text: fallback, fallback: true };

      const text = assistantContent(await response.json());
      if (!text) return { text: fallback, fallback: true };
      if (cache.size >= MAX_CACHE) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(cacheKey, { text, expiresAt: Date.now() + CACHE_TTL_MS });
      return { text, fallback: false };
    } catch {
      return { text: fallback, fallback: true };
    }
  })();

  inFlight.set(cacheKey, operation);
  try {
    return await operation;
  } finally {
    inFlight.delete(cacheKey);
  }
}
export type WaiverBrief = {
  name: string;
  position: string;
  team: string;
  format: "category" | "points";
  rank: number;
  statLine: string;
  strengths: string;
  weakness: string | null;
  rankDelta: number | null;
  tags: string[];
};

export async function waiverCommentary(
  brief: WaiverBrief,
  league: LeagueContext,
): Promise<PersonaResult> {
  const formatName = brief.format === "category" ? "category" : "points";
  const lines = [
    `Top available pickup: ${brief.name}, ${brief.position}, ${brief.team}.`,
    `Per game: ${brief.statLine}.`,
    `Biggest strengths vs the league's player pool: ${brief.strengths}.`,
  ];
  if (brief.weakness) lines.push(`Weak spot: ${brief.weakness}.`);
  if (brief.tags.length) lines.push(`Flags: ${brief.tags.join(", ")}.`);
  if (brief.rankDelta && Math.abs(brief.rankDelta) >= 10) {
    lines.push(
      brief.rankDelta > 0
        ? `He rates ${brief.rankDelta} spots better in ${formatName} than in the other format.`
        : `He rates ${Math.abs(brief.rankDelta)} spots worse in ${formatName} than in the other format.`,
    );
  }
  lines.push(`Sell this pickup to the manager.`);

  const fallback =
    `${brief.name} ranks first among the available players in this analysis. ` +
    `${brief.statLine} with ${brief.strengths}; that is the deterministic case in this ${formatName} format.`;

  return generateNarration(
    { type: "waiver", brief },
    league,
    lines.join("\n"),
    fallback,
  );
}

export type SleeperBrief = {
  name: string;
  position: string;
  team: string;
  reason: string;
  statLine: string;
  format: "category" | "points";
};

export async function sleeperCommentary(
  brief: SleeperBrief,
  league: LeagueContext,
): Promise<PersonaResult> {
  const prompt = [
    `Breakout candidate: ${brief.name}, ${brief.position}, ${brief.team}.`,
    `Why he is trending up: ${brief.reason}.`,
    `Per game: ${brief.statLine}.`,
    `Explain why the supplied breakout-candidate rationale supports the result.`,
  ].join("\n");

  const fallback =
    `${brief.name} stands out in the sleeper model. ${brief.reason}. ` +
    `Review the player card and decide whether the available upside fits your roster.`;

  return generateNarration({ type: "sleeper", brief }, league, prompt, fallback);
}

export type TradeBrief = {
  giveName: string;
  givePosition: string;
  giveStats: string;
  receiveName: string;
  receivePosition: string;
  receiveStats: string;
  userNeed: string;
  partnerNeed: string;
  partnerTeamName: string;
  format: "category" | "points";
  fairness: "even" | "you-give-up-value" | "you-gain-value";
};

export async function tradeCommentary(
  brief: TradeBrief,
  league: LeagueContext,
): Promise<PersonaResult> {
  const fairnessNote = {
    even: "The two players grade out close to even on value.",
    "you-gain-value": "This slightly favors the manager you are advising.",
    "you-give-up-value": "This gives up a little value, but it fixes a real hole.",
  }[brief.fairness];

  const prompt = [
    `Trade partner: ${brief.partnerTeamName}.`,
    `The manager sends: ${brief.giveName}, ${brief.givePosition} - ${brief.giveStats}.`,
    `The manager receives: ${brief.receiveName}, ${brief.receivePosition} - ${brief.receiveStats}.`,
    `Reason this works: the manager is thin at ${brief.userNeed} and deep at ${brief.partnerNeed}; ${brief.partnerTeamName} is the mirror image.`,
    fairnessNote,
    `Pitch this trade.`,
  ].join("\n");

  const fallback =
    `This is a one-for-one candidate from the position-group comparison: you send ${brief.giveName} from ${brief.partnerNeed} and receive ${brief.receiveName} at ${brief.userNeed}. ` +
    `${brief.partnerTeamName} has the complementary group pattern used by the deterministic trade rule.`;

  return generateNarration(
    { type: "trade", brief },
    league,
    prompt,
    fallback,
  );
}
