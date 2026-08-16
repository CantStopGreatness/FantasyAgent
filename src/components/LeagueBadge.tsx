"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { EMPTY_OVERRIDES, LeagueRulesEditor, type Overrides } from "./LeagueRulesEditor";
import { FORMAT_LABEL, type Session } from "@/lib/types";

/**
 * The format is a league fact, not a preference, so it reads as a stamped
 * plate rather than a control. Opening it reveals the same editor the setup
 * screen uses — settings are correctable from here too, without re-importing.
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
        className="inline-flex items-center gap-2 border-[3px] border-ink bg-bone px-3 py-1.5 text-ink transition hover:bg-gold"
      >
        <span className="font-display text-sm">{FORMAT_LABEL[league.format]}</span>
        <span className="text-xs text-ink-2">{league.sportLabel}</span>
        {editCount > 0 && (
          <span className="nums border-2 border-ink bg-flag px-1 text-[0.65rem]">
            {editCount}
          </span>
        )}
        <Icon
          name="chevron-down"
          className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <button
            aria-label="Close league settings"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="card absolute right-0 z-20 mt-2 max-h-[75vh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto">
            <div className="strip flex items-center justify-between gap-3 px-5 py-2.5">
              <span className="font-display text-sm">LEAGUE SETTINGS</span>
              {busy && <span className="text-xs text-bone-3">Re-scoring…</span>}
            </div>
            <div className="p-5">
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
          </div>
        </>
      )}
    </div>
  );
}
