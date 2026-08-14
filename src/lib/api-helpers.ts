import "server-only";
import { NextResponse } from "next/server";
import { SleeperError } from "./sleeper/client";
import type { ScoringFormat } from "./nba/scoring";

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

export function parseFormat(value: unknown): ScoringFormat {
  return value === "points" ? "points" : "category";
}

/** One decimal, no trailing ".0" noise in the UI. */
export function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}
