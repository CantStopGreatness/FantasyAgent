import type { SleeperLeague } from "@/lib/sleeper/types";
import type { ScoringFormat } from "./scoring";

/**
 * League rules that change what a good recommendation actually is.
 *
 * Sleeper does not document the `settings` object and no wrapper library
 * publishes its schema, so this parses defensively: keys we recognise get a
 * label and a formatter, and anything unrecognised is carried through
 * untouched rather than dropped. A missing value renders as "not set" instead
 * of a fabricated default — a wrong trade deadline is worse than no deadline.
 */
export type LeagueSetting = {
  key: string;
  label: string;
  /** Display-ready value, or null when the league did not set it. */
  value: string | null;
  /** Raw value, kept so the UI can offer a sensible editor. */
  raw: number | string | null;
  kind: "week" | "count" | "currency" | "enum" | "boolean" | "text";
  /** Short note shown under the field on the confirm screen. */
  hint?: string;
};

export type LeagueRules = {
  format: ScoringFormat;
  /** True when the format came from a guess rather than the user confirming. */
  formatInferred: boolean;
  rosterSize: number | null;
  settings: LeagueSetting[];
  /** Every raw settings key, for the model and for debugging real leagues. */
  raw: Record<string, number | string>;
};

const WAIVER_TYPES: Record<number, string> = {
  0: "Rolling waivers",
  1: "Reverse standings",
  2: "FAAB bidding",
};

const LEAGUE_TYPES: Record<number, string> = {
  0: "Redraft",
  1: "Keeper",
  2: "Dynasty",
};

type Spec = {
  label: string;
  kind: LeagueSetting["kind"];
  hint?: string;
  format?: (v: number | string, all: Record<string, number | string>) => string | null;
};

/**
 * Field names expected on Sleeper's league settings object.
 *
 * These come from observed usage rather than published documentation, so any
 * key absent from a real league simply does not render. When a real league is
 * imported, dump `raw` to reconcile this table against what Sleeper actually
 * sends.
 */
const KNOWN: Record<string, Spec> = {
  playoff_week_start: {
    label: "Playoffs begin",
    kind: "week",
    hint: "Recommendations weigh the stretch run more heavily from here.",
    format: (v) => (Number(v) > 0 ? `Week ${v}` : null),
  },
  trade_deadline: {
    label: "Trade deadline",
    kind: "week",
    hint: "After this, trades are off and waivers are the only lever.",
    format: (v) => (Number(v) > 0 ? `Week ${v}` : null),
  },
  waiver_type: {
    label: "Waiver type",
    kind: "enum",
    format: (v) => WAIVER_TYPES[Number(v)] ?? `Type ${v}`,
  },
  waiver_budget: {
    label: "FAAB budget",
    kind: "currency",
    hint: "Only meaningful on FAAB leagues.",
    format: (v) => (Number(v) > 0 ? `$${v}` : null),
  },
  waiver_day_of_week: {
    label: "Waivers clear",
    kind: "enum",
    format: (v) =>
      ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
        Number(v)
      ] ?? null,
  },
  playoff_teams: {
    label: "Playoff teams",
    kind: "count",
    format: (v) => (Number(v) > 0 ? `${v} teams` : null),
  },
  type: {
    label: "League type",
    kind: "enum",
    format: (v) => LEAGUE_TYPES[Number(v)] ?? null,
  },
  disable_trades: {
    label: "Trades",
    kind: "boolean",
    format: (v) => (Number(v) === 1 ? "Disabled" : "Enabled"),
  },
  trade_review_days: {
    label: "Trade review",
    kind: "count",
    format: (v) => (Number(v) > 0 ? `${v} days` : "Instant"),
  },
  max_keepers: {
    label: "Keepers",
    kind: "count",
    format: (v) => (Number(v) > 0 ? `${v} allowed` : null),
  },
  num_teams: { label: "Teams", kind: "count", format: (v) => `${v} teams` },
};

/** Roster slots that hold an actual player, ignoring bench and IR. */
function countStarters(rosterPositions: string[] | null): number | null {
  if (!rosterPositions?.length) return null;
  return rosterPositions.filter((p) => p !== "BN" && p !== "IR" && p !== "TAXI").length;
}

export function parseLeagueRules(
  league: SleeperLeague,
  format: ScoringFormat,
  formatInferred: boolean,
): LeagueRules {
  const rawSettings = league.settings ?? {};
  const raw: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(rawSettings)) {
    if (typeof v === "number" || typeof v === "string") raw[k] = v;
  }

  const settings: LeagueSetting[] = [];
  for (const [key, spec] of Object.entries(KNOWN)) {
    const value = raw[key];
    const present = value !== undefined && value !== null;
    settings.push({
      key,
      label: spec.label,
      value: present ? (spec.format ? spec.format(value, raw) : String(value)) : null,
      raw: present ? value : null,
      kind: spec.kind,
      hint: spec.hint,
    });
  }

  return {
    format,
    formatInferred,
    rosterSize: countStarters(league.roster_positions),
    settings,
    raw,
  };
}

/** The subset worth showing on the confirm screen and feeding to the model. */
export function significantSettings(rules: LeagueRules): LeagueSetting[] {
  return rules.settings.filter((s) => s.value !== null);
}

/**
 * Compact league context for the analyst prompt.
 *
 * Only facts the league actually published — the model is told elsewhere never
 * to invent numbers, and an empty line here is better than a guessed one.
 */
export function rulesForPrompt(rules: LeagueRules, currentWeek: number | null): string[] {
  const lines: string[] = [
    `Scoring: ${rules.format === "category" ? "category (roto)" : "points"}.`,
  ];
  if (rules.rosterSize) lines.push(`Starting lineup: ${rules.rosterSize} slots.`);
  if (currentWeek && currentWeek > 0) lines.push(`Current week: ${currentWeek}.`);
  for (const s of significantSettings(rules)) {
    lines.push(`${s.label}: ${s.value}.`);
  }
  return lines;
}
