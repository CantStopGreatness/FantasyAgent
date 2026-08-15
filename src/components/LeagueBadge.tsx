"use client";

import { useState } from "react";
import { FORMAT_LABEL, type LeagueInfo, type LeagueSetting } from "@/lib/types";

/**
 * The format is a league fact, not a preference, so it reads as a badge rather
 * than a control. Clicking opens the rest of the rules CourtIQ is working
 * from — visible when wanted, out of the way otherwise.
 */
export function LeagueBadge({
  league,
  settings,
}: {
  league: LeagueInfo;
  settings: LeagueSetting[];
}) {
  const [open, setOpen] = useState(false);
  const shown = settings.filter((s) => s.value !== null);

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
        <span aria-hidden className={`text-[0.6rem] text-muted transition ${open ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {open && (
        <>
          <button
            aria-label="Close league rules"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-edge bg-panel p-5 shadow-xl">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              League rules in play
            </p>

            <dl className="mt-4 space-y-2.5">
              <Row label="Scoring" value={FORMAT_LABEL[league.format]} />
              {league.rosterSize && (
                <Row label="Starting slots" value={String(league.rosterSize)} />
              )}
              {shown.map((s) => (
                <Row key={s.key} label={s.label} value={s.value!} />
              ))}
            </dl>

            <p className="mt-4 border-t border-edge pt-3.5 text-xs leading-relaxed text-muted">
              Read from your Sleeper league. Change them in Sleeper, then re-import.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="nums text-xs font-medium">{value}</dd>
    </div>
  );
}
