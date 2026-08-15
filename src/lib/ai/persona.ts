import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * The CourtIQ analyst voice.
 *
 * The model narrates; it never ranks. Every number in the prompt comes from
 * the deterministic scoring engine, and the model is told not to invent more —
 * a made-up stat on stage is worse than a boring sentence.
 *
 * The sport noun is injected so the persona is not hard-coded to basketball.
 */
function systemPrompt(sportNoun: string): string {
  return `You are CourtIQ, a confident fantasy ${sportNoun} analyst with hype-man energy — the voice of someone who called this pick two weeks ago and is enjoying being right.

Rules:
- 1-3 punchy sentences. No preamble, no "Here's why" — open on the take.
- You are given the numbers and the league's rules. Use them, and never invent a stat, date, injury, trade, or storyline you were not given.
- League context is there to sharpen the call — a pickup right before the trade deadline is a different argument than one in week 3. Reference it only when it genuinely changes the advice.
- Confident and playful about the *pick*, never disrespectful toward the real athlete. Tease the roster move, not the person.
- Never hedge with "might", "could be worth a look", or "if he stays healthy". Make the call.
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

const MODEL = "claude-opus-5";

/** Persona output is decoration on top of real rankings — it must never block a render. */
export type PersonaResult = {
  text: string;
  /** True when the line came from the local fallback rather than the model. */
  fallback: boolean;
};

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

/**
 * Identical inputs produce identical commentary, so cache them.
 *
 * This matters for the format toggle specifically: flipping back and forth
 * between 9-CAT and Points during a demo should not re-bill or re-wait for a
 * line the user already read.
 */
const cache = new Map<string, string>();
const MAX_CACHE = 200;

async function generate(
  cacheKey: string,
  league: LeagueContext,
  prompt: string,
  fallback: string,
): Promise<PersonaResult> {
  const hit = cache.get(cacheKey);
  if (hit) return { text: hit, fallback: false };

  const anthropic = getClient();
  if (!anthropic) return { text: fallback, fallback: true };

  try {
    const message = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt(league.sportNoun),
      // Short narration task — low effort keeps the demo snappy. Thinking stays
      // on (the Opus 5 default) rather than disabled, which can leak internal
      // tags into visible text.
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: renderContext(league) + prompt }],
    });

    if (message.stop_reason === "refusal") return { text: fallback, fallback: true };

    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();

    if (!text) return { text: fallback, fallback: true };

    if (cache.size >= MAX_CACHE) cache.clear();
    cache.set(cacheKey, text);
    return { text, fallback: false };
  } catch {
    // Rate limit, network blip, missing credit — the dashboard still renders.
    return { text: fallback, fallback: true };
  }
}

/* ── Prompt builders ─────────────────────────────────────────────────────
 * Each takes the scoring engine's structured output and renders it as facts.
 */

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
    `${brief.name} is the best name sitting on your waiver wire and it is not close. ` +
    `${brief.statLine} with ${brief.strengths} — in a ${formatName} league that is a starter, not a stash.`;

  return generate(
    `waiver:${brief.format}:${brief.name}:${brief.rank}`,
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
    `Tell the manager to grab him before the rest of the league notices.`,
  ].join("\n");

  const fallback =
    `${brief.name} is the one nobody in your league has looked at yet. ${brief.reason}. ` +
    `Add him now and let everyone else figure it out next week.`;

  return generate(`sleeper:${brief.format}:${brief.name}`, league, prompt, fallback);
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
    `The manager sends: ${brief.giveName}, ${brief.givePosition} — ${brief.giveStats}.`,
    `The manager receives: ${brief.receiveName}, ${brief.receivePosition} — ${brief.receiveStats}.`,
    `Reason this works: the manager is thin at ${brief.userNeed} and deep at ${brief.partnerNeed}; ${brief.partnerTeamName} is the mirror image.`,
    fairnessNote,
    `Pitch this trade.`,
  ].join("\n");

  const fallback =
    `You are deep at ${brief.partnerNeed} and starving at ${brief.userNeed} — ${brief.partnerTeamName} has the exact opposite problem. ` +
    `Send ${brief.giveName}, get ${brief.receiveName}, and both rosters stop bleeding. That is how you win a trade without winning a trade.`;

  return generate(
    `trade:${brief.format}:${brief.giveName}:${brief.receiveName}`,
    league,
    prompt,
    fallback,
  );
}
