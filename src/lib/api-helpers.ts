import "server-only";
import { NextResponse } from "next/server";
import { SleeperError } from "./sleeper/client";
import type { ScoringFormat } from "./engine/scoring";

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
