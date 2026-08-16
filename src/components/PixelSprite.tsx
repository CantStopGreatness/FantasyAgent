"use client";

/**
 * Pixel art, authored as bitmaps rather than imported as assets.
 *
 * Each sprite is an array of equal-length strings, one character per pixel,
 * mapped to palette colours. Rendering to SVG rects keeps them crisp at any
 * scale, themeable from the same tokens as the rest of the world, and free of
 * a binary asset pipeline. Horizontal runs are merged into single rects so a
 * sprite costs a handful of nodes rather than one per pixel.
 */
export type Bitmap = {
  /** Rows of equal length. Space or "." is transparent. */
  rows: string[];
  /** Character to CSS colour. */
  palette: Record<string, string>;
};

function runsOf(row: string): { x: number; len: number; ch: string }[] {
  const runs: { x: number; len: number; ch: string }[] = [];
  let i = 0;
  while (i < row.length) {
    const ch = row[i];
    let len = 1;
    while (i + len < row.length && row[i + len] === ch) len++;
    if (ch !== "." && ch !== " ") runs.push({ x: i, len, ch });
    i += len;
  }
  return runs;
}

function rectsFor(bitmap: Bitmap, offsetX: number, keyPrefix: string) {
  return bitmap.rows.flatMap((row, y) =>
    runsOf(row).map((r) => (
      <rect
        key={`${keyPrefix}-${y}-${r.x}`}
        x={r.x + offsetX}
        y={y}
        width={r.len}
        height={1}
        fill={bitmap.palette[r.ch] ?? "transparent"}
      />
    )),
  );
}

export function PixelSprite({
  bitmap,
  className = "",
  title,
}: {
  bitmap: Bitmap;
  className?: string;
  title?: string;
}) {
  const h = bitmap.rows.length;
  const w = bitmap.rows[0]?.length ?? 0;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      shapeRendering="crispEdges"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {rectsFor(bitmap, 0, "s")}
    </svg>
  );
}

/**
 * Frame-by-frame sprite animation.
 *
 * Laces that rotate out of sight and back, and a net that deforms when a ball
 * hits it, are not transforms of one picture — they are different pictures.
 * Frames are laid out as a horizontal strip inside a single SVG; the wrapper
 * clips to one frame and CSS scrubs the strip with `steps(n)`, exactly the way
 * a sprite sheet has always worked. Staying CSS-only means it inherits the
 * offscreen pause and reduced-motion handling already in place.
 *
 * `delay` is negative-friendly: pass a negative value to start a loop
 * partway through so sibling lanes do not all fire on the same beat.
 */
export function PixelAnim({
  frames,
  duration,
  delay = "0s",
  className = "",
}: {
  frames: Bitmap[];
  /** CSS duration for one full cycle, e.g. "3.2s". */
  duration: string;
  delay?: string;
  className?: string;
}) {
  const n = frames.length;
  const h = frames[0]?.rows.length ?? 0;
  const w = frames[0]?.rows[0]?.length ?? 0;

  return (
    <span className={`pixel-anim ${className}`} style={{ aspectRatio: `${w} / ${h}` }}>
      <svg
        viewBox={`0 0 ${w * n} ${h}`}
        width={`${n * 100}%`}
        height="100%"
        shapeRendering="crispEdges"
        aria-hidden
        style={{
          animationDuration: duration,
          animationDelay: delay,
          // steps(n) lands on each frame exactly once per cycle.
          animationTimingFunction: `steps(${n})`,
        }}
      >
        {frames.map((f, i) => rectsFor(f, i * w, `f${i}`))}
      </svg>
    </span>
  );
}

/* ── The sprites ─────────────────────────────────────────────────────────
 * Drawn on the smallest grid that still reads at a glance. Palette keys point
 * at the world's own tokens so a sprite can never drift from the theme.
 */

const INK = "var(--ink)";
const CHALK = "var(--chalk)";
const BONE = "var(--bone)";
const FLAG = "var(--flag)";
const LEATHER = "var(--leather)";

/**
 * 15×15 basketball, generated rather than hand-typed.
 *
 * The two curved seams are the whole point. A circle with a plain cross reads
 * as a beach ball; what makes a basketball recognisable is the pair of seams
 * bowing out from the poles to about four columns off centre at the equator.
 * Deriving the circle and the seams from the geometry keeps the outline closed
 * on both sides — hand-typing fifteen rows of this quietly loses a pixel.
 */
function basketball(): Bitmap {
  const size = 15;
  const c = 7;
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => "."));

  for (let y = 0; y < size; y++) {
    const dx = Math.round(Math.sqrt(Math.max(0, c * c - (y - c) ** 2)));
    const [a, b] = [c - dx, c + dx];
    for (let x = a; x <= b; x++) grid[y][x] = x === a || x === b ? "k" : "o";

    // Centre seams.
    if (grid[y][c] !== ".") grid[y][c] = "k";
    if (y === c) for (let x = a; x <= b; x++) grid[y][x] = "k";

    // The pair of curved seams, bowing away from the vertical toward the rim.
    const bow = Math.round(4 * Math.sin((Math.PI * y) / (size - 1)));
    for (const x of [c - bow, c + bow]) {
      if (x >= a && x <= b && grid[y][x] === "o") grid[y][x] = "k";
    }
  }

  return { palette: { o: FLAG, k: INK }, rows: grid.map((r) => r.join("")) };
}

export const BALL: Bitmap = basketball();

/**
 * Backboard and rim, 15×8 — the net is animated separately.
 *
 * Seen from the side, so the rim projects clear of the board rather than
 * starting halfway across it: cols 0-7 are the board, cols 8-14 are the rim,
 * and they meet at exactly one column. That separation is what gives the ball
 * somewhere to fall through.
 *
 * The target box is small and sits low, directly above the rim, where a real
 * one does. Centring it makes the board read as concentric rings — a bullseye,
 * or a window — because at eight rows the board's own border is already a
 * rectangle and a second centred rectangle just nests inside it.
 */
export const HOOP: Bitmap = {
  palette: { w: CHALK, k: INK, r: FLAG },
  rows: [
    "kkkkkkkk.......",
    "kwwwwwwk.......",
    "kwwwwwwk.......",
    "kwwkkkwk.......",
    "kwwkwkwk.......",
    "kwwkkkwk.......",
    "kwwwwwwk.......",
    "kkkkkkkkrrrrrrr",
  ],
};

/**
 * The net, in four poses: hanging, stretched long as the ball passes through,
 * splayed on the recoil, back to hanging.
 */
const netRest: Bitmap = {
  palette: { n: BONE },
  rows: [".nnnnnnn.", "..nnnnn..", "..n.n.n..", "...nnn...", ".........", "........."],
};
const netStretched: Bitmap = {
  palette: { n: BONE },
  rows: [".nnnnnnn.", "..nnnnn..", "..nnnnn..", "..n.n.n..", "...nnn...", "....n...."],
};
const netRecoil: Bitmap = {
  palette: { n: BONE },
  rows: ["nnnnnnnnn", ".nnnnnnn.", ".n.n.n.n.", "..n...n..", ".........", "........."],
};
export const NET_FRAMES: Bitmap[] = [
  netRest,
  netRest,
  netRest,
  netRest,
  netStretched,
  netRecoil,
  netRest,
  netRest,
];

/**
 * 17×9 football: a true lens that comes to a point at both ends, with laces
 * drawn as a centre line and stitch ticks rather than a solid white slab, plus
 * the end stripes a real ball carries.
 */
function football(lacesAtX: number | null, stripeShift: number): Bitmap {
  // Body: a prolate spheroid tapering to points.
  const spans: [number, number][] = [
    [7, 9],
    [4, 12],
    [2, 14],
    [1, 15],
    [0, 16],
    [1, 15],
    [2, 14],
    [4, 12],
    [7, 9],
  ];

  const grid = spans.map(([a, b]) => {
    const row = Array.from({ length: 17 }, () => ".");
    for (let x = a; x <= b; x++) row[x] = x === a || x === b ? "k" : "b";
    return row;
  });

  // End stripes, wrapping with the spin.
  for (const base of [4, 12]) {
    const x = base + stripeShift;
    if (x > 1 && x < 15) {
      for (let y = 2; y <= 6; y++) if (grid[y][x] === "b") grid[y][x] = "l";
    }
  }

  // Laces: a short line with perpendicular ticks. Null means they have rotated
  // round the back of the ball and are not visible this frame.
  if (lacesAtX !== null) {
    for (let i = 0; i < 4; i++) {
      const x = lacesAtX + i;
      if (x < 1 || x > 15) continue;
      if (grid[4][x] === "b" || grid[4][x] === "l") grid[4][x] = "l";
      if (i % 2 === 0) {
        if (grid[3][x] === "b") grid[3][x] = "l";
        if (grid[5][x] === "b") grid[5][x] = "l";
      }
    }
  }

  return { palette: { b: LEATHER, l: CHALK, k: INK }, rows: grid.map((r) => r.join("")) };
}

export const FOOTBALL: Bitmap = football(7, 0);

/**
 * Six frames of a spiral.
 *
 * The body never changes; the laces and stripes travel across the face and
 * wrap. Two frames show no laces at all — that is the white disappearing round
 * the back of the ball and coming up the other side, which is what a spiral
 * actually looks like and what an end-over-end `rotate()` never gives you.
 */
export const FOOTBALL_SPIN: Bitmap[] = [
  football(7, 0),
  football(10, 1),
  football(13, 2),
  football(null, 0),
  football(2, -2),
  football(4, -1),
];

/**
 * 13×13 soccer ball: white body, dark centre pentagon with partial pentagons
 * running out to the rim. The black patches are what separate it from a plain
 * white circle at this size.
 */
export const SOCCER_BALL: Bitmap = {
  palette: { w: CHALK, k: INK },
  rows: [
    "....kkkkk....",
    "..kkwwwwwkk..",
    ".kwwwkkkwwwwk",
    ".kwwkkkkkwwwk",
    "kwwwkkkkkwwwk",
    "kwwwwkkkwwwwk",
    "kwkwwwwwwwkwk",
    "kkkwwwwwwwkkk",
    "kwkkwwwwwkkwk",
    "kwwwkwwwkwwwk",
    ".kwwwkkkwwwk.",
    "..kkwwwwwkk..",
    "....kkkkk....",
  ],
};

/** Goal frame: posts and crossbar. The mesh animates behind it. */
export const GOAL_FRAME: Bitmap = {
  palette: { w: CHALK, k: INK },
  rows: [
    "kkkkkkkkkkkkkkkkk",
    "kwwwwwwwwwwwwwwwk",
    "kk.............kk",
    "kw.............wk",
    "kw.............wk",
    "kw.............wk",
    "kw.............wk",
    "kw.............wk",
    "kw.............wk",
    "kk.............kk",
  ],
};

/**
 * The mesh, in three poses: hanging square, bulged where the ball struck, and
 * settling back. Cycling these is what makes the goal read as *scored* rather
 * than as a ball vanishing behind a rectangle.
 */
function mesh(bulgeRow: number | null): Bitmap {
  const rows: string[] = [];
  for (let y = 0; y < 8; y++) {
    // Where the ball struck, the strands gather instead of filling solid —
    // a filled band reads as a white brick, not as a net taking a shot.
    const hit = bulgeRow !== null && Math.abs(y - bulgeRow) <= 1;
    const row = Array.from({ length: 13 }, (_, x) => {
      if (hit) return x % 2 === 0 ? "m" : ".";
      return x % 4 === 0 || y % 3 === 0 ? "m" : ".";
    });
    rows.push(row.join(""));
  }
  return { palette: { m: BONE }, rows };
}

export const MESH_FRAMES: Bitmap[] = [
  mesh(null),
  mesh(null),
  mesh(null),
  mesh(null),
  mesh(4),
  mesh(5),
  mesh(null),
  mesh(null),
];
