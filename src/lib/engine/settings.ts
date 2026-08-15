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
  /** Choices for enum/boolean fields, so the editor can render a select. */
  options?: { value: number; label: string }[];
  /** True when the user corrected this value rather than Sleeper supplying it. */
  edited?: boolean;
};

/**
 * User corrections to what we parsed, keyed by settings key.
 *
 * These only ever feed the analyst's context — never the scoring engine — so a
 * wrong correction changes the narration, not the rankings.
 */
export type RuleOverrides = Record<string, number | string>;

/**
 * One per-stat point value from the league's scoring_settings.
 *
 * Unlike the rules above, these are load-bearing: in a points league they *are*
 * the ranking. Editing one re-scores the board, so corrections here round-trip
 * through the engine rather than only reaching the analyst.
 */
export type ScoringStat = {
  key: string;
  label: string;
  value: number;
  edited?: boolean;
};

export type LeagueRules = {
  format: ScoringFormat;
  /** True when the format came from a guess rather than the user confirming. */
  formatInferred: boolean;
  rosterSize: number | null;
  settings: LeagueSetting[];
  scoring: ScoringStat[];
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
  options?: { value: number; label: string }[];
  format?: (v: number | string, all: Record<string, number | string>) => string | null;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const asOptions = (m: Record<number, string>) =>
  Object.entries(m).map(([value, label]) => ({ value: Number(value), label }));

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
    options: asOptions(WAIVER_TYPES),
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
    options: DAYS.map((label, value) => ({ value, label })),
    format: (v) => DAYS[Number(v)] ?? null,
  },
  playoff_teams: {
    label: "Playoff teams",
    kind: "count",
    format: (v) => (Number(v) > 0 ? `${v} teams` : null),
  },
  type: {
    label: "League type",
    kind: "enum",
    options: asOptions(LEAGUE_TYPES),
    format: (v) => LEAGUE_TYPES[Number(v)] ?? null,
  },
  disable_trades: {
    label: "Trades",
    kind: "boolean",
    options: [
      { value: 0, label: "Enabled" },
      { value: 1, label: "Disabled" },
    ],
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

/**
 * Human labels for scoring stat keys.
 *
 * Sleeper's keys vary by sport and are not documented, so anything missing here
 * falls back to the raw key rather than being hidden — an unlabelled row the
 * user can still see and edit beats a silently dropped one.
 */
const STAT_LABELS: Record<string, string> = {
  pts: "Points",
  reb: "Rebounds",
  oreb: "Offensive rebounds",
  dreb: "Defensive rebounds",
  ast: "Assists",
  stl: "Steals",
  blk: "Blocks",
  to: "Turnovers",
  tpm: "Three-pointers made",
  tpa: "Three-pointers attempted",
  fgm: "Field goals made",
  fga: "Field goals attempted",
  ftm: "Free throws made",
  fta: "Free throws attempted",
  pf: "Personal fouls",
  dd: "Double-doubles",
  td: "Triple-doubles",
  gp: "Games played",
};

export function statLabel(key: string): string {
  return STAT_LABELS[key] ?? key.replace(/_/g, " ").toUpperCase();
}

export function parseScoring(
  scoringSettings: Record<string, number> | null,
  overrides: Record<string, number> = {},
): ScoringStat[] {
  const merged: Record<string, number> = { ...(scoringSettings ?? {}) };
  for (const [k, v] of Object.entries(overrides)) merged[k] = v;

  return Object.entries(merged)
    .filter(([, v]) => typeof v === "number" && isFinite(v))
    // Zero-weighted stats are noise on a settings screen unless the user set one.
    .filter(([k, v]) => v !== 0 || k in overrides)
    .map(([key, value]) => ({
      key,
      label: statLabel(key),
      value,
      edited: key in overrides,
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

export function parseLeagueRules(
  league: SleeperLeague,
  format: ScoringFormat,
  formatInferred: boolean,
  ruleOverrides: RuleOverrides = {},
  scoringOverrides: Record<string, number> = {},
): LeagueRules {
  const rawSettings = league.settings ?? {};
  const raw: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(rawSettings)) {
    if (typeof v === "number" || typeof v === "string") raw[k] = v;
  }
  // A correction wins over what Sleeper reported.
  for (const [k, v] of Object.entries(ruleOverrides)) raw[k] = v;

  const settings: LeagueSetting[] = [];
  for (const [key, spec] of Object.entries(KNOWN)) {
    const value = raw[key];
    const present = value !== undefined && value !== null && value !== "";
    settings.push({
      key,
      label: spec.label,
      value: present ? (spec.format ? spec.format(value, raw) : String(value)) : null,
      raw: present ? value : null,
      kind: spec.kind,
      hint: spec.hint,
      options: spec.options,
      edited: key in ruleOverrides,
    });
  }

  return {
    format,
    formatInferred,
    rosterSize: countStarters(league.roster_positions),
    settings,
    scoring: parseScoring(league.scoring_settings, scoringOverrides),
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

  // In a points league the weights are the ranking, so the analyst should know
  // which stats this league actually pays for. Only the ones that move the
  // needle — a full dump of twenty near-zero weights is noise.
  if (rules.format === "points" && rules.scoring.length) {
    const notable = rules.scoring.slice(0, 8).map((s) => `${s.label} ${s.value}`);
    lines.push(`Point values: ${notable.join(", ")}.`);
  }
  return lines;
}
