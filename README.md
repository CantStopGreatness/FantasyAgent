# CourtIQ

League-aware fantasy recommendations. CourtIQ reads your Sleeper league — its
scoring format, playoff dates, trade deadline, waiver rules — and ranks every
waiver pickup, sleeper, and trade against them, then explains the call in an
analyst's voice.

**The format is the league's, not a setting.** There is no scoring toggle: the
format is read from the league and shown as a badge. Setup asks you to confirm
it, because Sleeper publishes no category-vs-points flag and our read of it is
an inference.

What stays visible is the *reason* a ranking looks the way it does. Giannis
Antetokounmpo is the 69th most valuable player under category scoring and the
5th under points, because his free-throw shooting carries a −5.6 z-score at
high volume — so his card says so, whichever format your league uses.

## Running it

```bash
npm install
npm run dev
```

Open the printed URL, enter a Sleeper username (or a league ID), confirm the
rules it read, and go.

No API key is required to run the app. Add one to unlock live analyst
commentary:

```bash
cp .env.example .env.local   # then set ANTHROPIC_API_KEY
```

Without a key every callout falls back to a written line and is labelled
"offline read" in the UI, so the app never breaks on a missing or rate-limited
credential.

## Verifying

```bash
npm run verify         # scoring engine: inverted categories, format divergence
npm run verify:league  # full pipeline against a synthetic league
```

Both run against live Sleeper data (cached to `.cache/`). `verify` is the guard
on the demo-critical behaviour — it fails the build if the two formats stop
disagreeing.

## Sports

NBA is the only scoring profile implemented, but nothing above the profile
layer assumes basketball. A sport is defined in one file (`src/lib/sports/`):
its categories, which of them invert, which are volume-weighted ratios, its
position groups, and how to turn a Sleeper stat line into per-game rates. The
engine in `src/lib/engine/` is sport-agnostic.

Sleeper serves `players` and `stats` for `nfl`, `nhl`, `mlb`, `ncaaf`, and
`ncaab` — all verified reachable — so adding one is a profile file, not a
rewrite. Importing a league for a sport with no profile is refused rather than
guessed at.

Note that category scoring is itself sport-specific: NFL is points-only, which
is why `supportsCategories` lives on the profile rather than being assumed.

## Data

Everything comes from the public Sleeper API. No key, no second provider.

| What | Endpoint |
| --- | --- |
| League, rosters, managers | `/v1/league/{id}`, `/rosters`, `/users` |
| Player dictionary | `/v1/players/{sport}` (2.4 MB — trimmed and cached for a day) |
| Season stat totals | `/v1/stats/{sport}/regular/{season}` |
| Late-season splits | `/v1/stats/{sport}/regular/{season}/{week}` |
| Add velocity | `/v1/players/{sport}/trending/add` |

Two things worth knowing about this data:

**Offseason.** Sleeper's current season may have no games played yet, so the
engine falls back to the previous completed season and the UI says which season
the numbers come from.

**League settings are undocumented.** Sleeper publishes no schema for the
`settings` object, so `src/lib/engine/settings.ts` labels the keys it knows and
passes unknown ones through untouched. A setting the league did not set renders
as absent rather than as a fabricated default — a wrong trade deadline is worse
than no trade deadline. The snapshot endpoint returns the raw object alongside
the parsed one so the label table can be reconciled against a real league.

**Weekly splits are not per-game.** A weekly file is a partial-week aggregate
covering an unknown number of games, with no `gp` field — summing all 25 weeks
recovers only ~30% of a player's season totals. Treating one file as one game
inflates every rate (a 16.8 MPG bench player reads as 37 MPG). So recent form
is expressed as a player's late-season output *per file* against their own
season-long output *per file*: the same unknown unit on both sides, reported as
a relative change rather than a fabricated per-game number.

## How the scoring works

**Points** — each per-game stat weighted by the league's own point values, read
straight from Sleeper's `scoring_settings`.

**Categories** — a z-score per category against a fantasy-relevant player pool
(≥15 GP, ≥14 MPG for NBA), summed. Two details matter, and both are declared on
the sport profile rather than hard-coded:

- **Inverted categories** score in reverse, so fewer turnovers is better.
- **FG% and FT% are volume-weighted**, scored as the swing a player applies to
  the pool baseline rather than as a raw percentage — otherwise a bench big
  shooting 70% on three attempts outranks a starter shooting 52% on twenty.

The normalization pool matters more than it looks: z-scores against all ~1800
players who logged a minute would drag the means toward deep-bench production
and inflate everyone. Filtering to real contributors keeps a replacement-level
pickup near zero.

## Trades

Selection is deterministic, so the same league always yields the same trade and
the reasoning is explainable on stage:

1. Score each roster's position groups (guard / forward / center for NBA, as
   declared by the sport profile) on their top three.
2. Find each side's weakest group.
3. Require the needs to be complementary — I'm thin where they're deep, and
   vice versa — otherwise report no trade rather than invent one.
4. From each side's surplus, skip the best player at that position (nobody
   trades him) and pick the closest-value pair.

The model writes the pitch. It never picks the trade.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Anthropic API (`claude-opus-5`)

The analyst is given the league's rules as context — format, playoff week,
trade deadline, waiver type — so a pickup before the deadline reads differently
from the same pickup in week 3. It narrates; it never ranks, and it is told
never to state a number it was not given.
