"use client";

import { useState } from "react";
import {
  FORMAT_LABEL,
  type LeagueSetting,
  type ScoringFormat,
  type ScoringStat,
} from "@/lib/types";

export type Overrides = {
  format: ScoringFormat | null;
  rules: Record<string, number | string>;
  scoring: Record<string, number>;
};

export const EMPTY_OVERRIDES: Overrides = { format: null, rules: {}, scoring: {} };

/**
 * The one place league settings get edited, shared by setup and the dashboard.
 *
 * Two classes of value live here and they behave differently, which the UI
 * says out loud: rules only reach the analyst's context, while supported
 * scoring weights feed the points calculation. Unsupported values stay visible.
 */
export function LeagueRulesEditor({
  format,
  formatInferred,
  supportsCategories,
  settings,
  scoring,
  overrides,
  busy,
  onChange,
  onReset,
}: {
  format: ScoringFormat;
  formatInferred: boolean;
  supportsCategories: boolean;
  settings: LeagueSetting[];
  scoring: ScoringStat[];
  overrides: Overrides;
  busy?: boolean;
  onChange: (next: Overrides) => void;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<"rules" | "scoring">("rules");
  const edited =
    overrides.format !== null ||
    Object.keys(overrides.rules).length > 0 ||
    Object.keys(overrides.scoring).length > 0;
  const supportedScoringCount = scoring.filter((stat) => stat.supported).length;

  function setRule(key: string, raw: string, kind: LeagueSetting["kind"]) {
    const next = { ...overrides.rules };
    if (raw === "") delete next[key];
    else next[key] = kind === "text" ? raw : Number(raw);
    onChange({ ...overrides, rules: next });
  }

  function setScore(key: string, raw: string) {
    if (!scoring.some((stat) => stat.key === key && stat.supported)) return;
    const next = { ...overrides.scoring };
    if (raw === "") delete next[key];
    else next[key] = Number(raw);
    onChange({ ...overrides, scoring: next });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex border-[3px] border-ink bg-bone">
          {(
            [
              ["rules", "League rules"],
              ["scoring", `Scoring (${scoring.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                tab === id ? "bg-bone-2 text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {edited && (
          <button
              type="button"
            onClick={onReset}
            disabled={busy}
            className="text-xs text-ink-2 underline-offset-4 hover:text-ink hover:underline disabled:opacity-40"
          >
            Reset to Sleeper&apos;s values
          </button>
        )}
      </div>

      {tab === "rules" ? (
        <>
          {/* Format leads: it is the one value we infer rather than read. */}
          <div className="mt-5 border-[3px] border-ink bg-bone-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs  text-ink-2">Scoring format</p>
                <p className="mt-1 font-display text-xl text-ink">
                  {FORMAT_LABEL[format]}
                </p>
              </div>
              {supportsCategories ? (
                <button
              type="button"
                  disabled={busy}
                  onClick={() =>
                    onChange({
                      ...overrides,
                      format: format === "category" ? "points" : "category",
                    })
                  }
                  className="border-2 border-ink px-3 py-1.5 text-xs text-ink transition hover:bg-gold disabled:opacity-40"
                >
                  Switch to {FORMAT_LABEL[format === "category" ? "points" : "category"]}
                </button>
              ) : (
                <p className="text-xs text-ink-2">This sport is points-only.</p>
              )}
            </div>
            {formatInferred && supportsCategories && (
              <p className="mt-3 border-t-2 border-ink pt-3 text-xs leading-relaxed text-ink-2">
                Sleeper publishes no category-vs-points flag, so this is read from your per-stat
                scoring values. Every ranking depends on it.
              </p>
            )}
          </div>

          <ul className="mt-4 divide-y-[3px] divide-ink border-[3px] border-ink">
            {settings.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center gap-3 bg-bone px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {s.label}
                    {s.edited && <span className="ml-2 text-[0.65rem] text-flag">edited</span>}
                  </p>
                  {s.hint && <p className="mt-0.5 text-xs text-ink-2">{s.hint}</p>}
                </div>
                <RuleField setting={s} busy={busy} onChange={setRule} />
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs leading-relaxed text-ink-2">
            These sharpen the analyst&apos;s advice — they don&apos;t change the rankings. Blank
            means your league didn&apos;t set it.
          </p>
        </>
      ) : (
        <>
          {scoring.length === 0 ? (
            <p className="mt-5  border-[3px] border-ink px-5 py-8 text-center text-sm text-ink-2">
              This league publishes no per-stat point values.
            </p>
          ) : (
            <>
              <p className="mt-5 text-xs leading-relaxed text-ink-2">
                <span className="font-display text-ink">
                  {supportedScoringCount} of {scoring.length}
                </span>{" "}
                imported point rules have an exact NBA player rate and affect CourtIQ&apos;s
                calculation. The rest are explicitly excluded.
              </p>
              <ul className="mt-3 divide-y-[3px] divide-ink border-[3px] border-ink">
                {scoring.map((s) => (
                  <li
                    key={s.key}
                    className={`flex items-center gap-3 px-4 py-2.5 ${
                      s.supported ? "bg-bone" : "bg-bone-3"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {s.label}
                        {s.edited && (
                          <span className="ml-2 text-[0.65rem] text-flag">edited</span>
                        )}
                        {!s.supported && (
                          <span className="ml-2 border border-ink bg-bone px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase text-ink">
                            excluded
                          </span>
                        )}
                      </p>
                      <p className="text-[0.7rem] text-ink-2">
                        {s.key}
                        {!s.supported && " / Imported from Sleeper, not used in rankings"}
                      </p>
                    </div>
                    <input
                      aria-label={`${s.label}${s.supported ? "" : " (excluded from rankings)"}`}
                      type="number"
                      step="0.1"
                      disabled={busy || !s.supported}
                      title={!s.supported ? "Excluded from CourtIQ rankings" : undefined}
                      value={overrides.scoring[s.key] ?? s.value}
                      onChange={(e) => setScore(s.key, e.target.value)}
                      className="nums w-24 border-2 border-ink bg-bone-2 px-2.5 py-1.5 text-right text-sm focus:bg-chalk focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="mt-3 text-xs leading-relaxed text-ink-2">
            Editing a supported value re-scores points-league boards. Excluded values remain
            visible for transparency but cannot be edited and never enter the calculation.
          </p>
        </>
      )}
    </div>
  );
}

/** The right editor for a setting's kind, pre-filled with what we parsed. */
function RuleField({
  setting,
  busy,
  onChange,
}: {
  setting: LeagueSetting;
  busy?: boolean;
  onChange: (key: string, raw: string, kind: LeagueSetting["kind"]) => void;
}) {
  const current = setting.raw ?? "";
  const cls =
    " border-2 border-ink bg-bone-2 px-2.5 py-1.5 text-sm focus:bg-chalk focus:outline-none disabled:opacity-40";

  if (setting.options?.length) {
    return (
      <select
        aria-label={setting.label}
        disabled={busy}
        value={String(current)}
        onChange={(e) => onChange(setting.key, e.target.value, setting.kind)}
        className={`${cls} w-40`}
      >
        <option value="">Not set</option>
        {setting.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {setting.kind === "week" && <span className="text-xs text-ink-2">Week</span>}
      {setting.kind === "currency" && <span className="text-xs text-ink-2">$</span>}
      <input
        aria-label={setting.label}
        type={setting.kind === "text" ? "text" : "number"}
 placeholder="Not set"
        disabled={busy}
        value={String(current)}
        onChange={(e) => onChange(setting.key, e.target.value, setting.kind)}
        className={`nums ${cls} w-24 text-right`}
      />
    </div>
  );
}
