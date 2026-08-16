"use client";

import type { Commentary } from "@/lib/types";

/**
 * One analyst callout per view — not one per card, so the voice stays a
 * highlight rather than wallpaper.
 */
export function PersonaCallout({
  commentary,
  loading,
}: {
  commentary: Commentary;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-edge bg-panel px-6 py-5">
        <div className="flex items-center gap-2.5 text-xs uppercase tracking-[0.15em] text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange" />
          CourtIQ is watching the tape…
        </div>
        <div className="mt-4 space-y-2.5">
          <div className="h-3.5 w-full animate-pulse rounded bg-card" />
          <div className="h-3.5 w-4/5 animate-pulse rounded bg-card" />
        </div>
      </div>
    );
  }

  if (!commentary) return null;

  return (
    <figure className="relative overflow-hidden rounded-xl border border-edge bg-panel px-6 py-5">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-orange" />
      <figcaption className="flex items-center gap-2.5 text-xs uppercase tracking-[0.15em] text-orange">
        CourtIQ says
        {commentary.fallback && (
          <span
            className="rounded-full border border-edge px-2 py-0.5 text-[0.65rem] normal-case tracking-normal text-muted"
            title="Configure optional Ollama Cloud narration server-side"
          >
            offline read
          </span>
        )}
      </figcaption>
      <blockquote className="mt-3 text-lg leading-relaxed text-ink">{commentary.text}</blockquote>
    </figure>
  );
}
