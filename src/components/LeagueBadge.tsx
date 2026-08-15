"use client";

import { useState } from "react";
import { EMPTY_OVERRIDES, LeagueRulesEditor, type Overrides } from "./LeagueRulesEditor";
import { FORMAT_LABEL, type Session } from "@/lib/types";

/**
 * The format is a league fact, not a preference, so it reads as a badge rather
 * than a control. Opening it reveals the same editor the setup screen uses —
 * settings are correctable from here too, without re-importing.
 */
export function LeagueBadge({
  session,
  busy,
  onOverrides,
}: {
  session: Session;
  busy: boolean;
  onOverrides: (next: Overrides) => void;
}) {
  const [open, setOpen] = useState(false);
  const { league } = session;

  const overrides: Overrides = {
    format: session.confirmedFormat === league.format ? null : session.confirmedFormat,
    rules: session.ruleOverrides,
    scoring: session.scoringOverrides,
  };
  const editCount =
    Object.keys(session.ruleOverrides).length + Object.keys(session.scoringOverrides).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg border border-edge bg-panel px-3 py-1.5 transition hover:border-teal/50"
      >
        <span className="font-display text-sm font-semibold uppercase tracking-wide text-teal">
          {FORMAT_LABEL[league.format]}
        </span>
        <span className="text-xs text-muted">{league.sportLabel}</span>
        {editCount > 0 && (
          <span className="rounded-full bg-orange/15 px-1.5 text-[0.65rem] text-orange">
            {editCount}
          </span>
        )}
        <span
          aria-hidden
          className={`text-[0.6rem] text-muted transition ${open ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      {open && (
        <>
          <button
            aria-label="Close league settings"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 z-20 mt-2 max-h-[75vh] w-[min(30rem,calc(100vw-3rem))] overflow-y-auto rounded-xl border border-edge bg-panel p-5 shadow-2xl">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <p className="font-display text-sm font-semibold uppercase tracking-[0.12em]">
                League settings
              </p>
              {busy && <span className="text-xs text-muted">Re-scoring…</span>}
            </div>

            <LeagueRulesEditor
              format={league.format}
              formatInferred={league.formatInferred}
              supportsCategories={league.supportsCategories}
              settings={session.settings}
              scoring={session.scoring}
              overrides={overrides}
              busy={busy}
              onChange={onOverrides}
              onReset={() => onOverrides(EMPTY_OVERRIDES)}
            />
          </div>
        </>
      )}
    </div>
  );
}
