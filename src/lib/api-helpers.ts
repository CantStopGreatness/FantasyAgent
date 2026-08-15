import "server-only";
import { NextResponse } from "next/server";
import { SleeperError } from "./sleeper/client";
import type { ScoringFormat } from "./engine/scoring";
import type { LeagueOverrides } from "./engine/league";

/** Turn any thrown error into a response the UI can show a human. */
export function errorResponse(err: unknown) {
  if (err instanceof SleeperError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[courtiq]", err);
  return NextResponse.json(
    { error: "Something broke talking to Sleeper. Try again in a moment." },
    { status: 500 },
  );
}

/**
 * A confirmed format correction from the setup screen, or null to use the
 * league's own detected value.
 *
 * Deliberately not a general "pick a format" parameter — the format belongs to
 * the league. This exists only so a user can fix a bad inference, since Sleeper
 * publishes no category-vs-points flag for us to read.
 */
export function parseFormatOverride(value: unknown): ScoringFormat | null {
  if (value === "points" || value === "category") return value;
  return null;
}

/** Sanitize the user's rule corrections — arbitrary JSON reaches this. */
function parseRuleOverrides(value: unknown): Record<string, number | string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && isFinite(v)) out[k] = v;
    else if (typeof v === "string" && v.length <= 120) out[k] = v;
  }
  return out;
}

/** Scoring corrections must be finite numbers — they go straight into the math. */
function parseScoringOverrides(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (isFinite(n)) out[k] = n;
  }
  return out;
}

/** Pull every user correction off a request body in one place. */
export function parseOverrides(body: {
  format?: unknown;
  ruleOverrides?: unknown;
  scoringOverrides?: unknown;
}): LeagueOverrides {
  return {
    format: parseFormatOverride(body.format),
    rules: parseRuleOverrides(body.ruleOverrides),
    scoring: parseScoringOverrides(body.scoringOverrides),
  };
}
