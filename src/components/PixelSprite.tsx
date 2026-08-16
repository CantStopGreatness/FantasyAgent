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
      {bitmap.rows.map((row, y) =>
        runsOf(row).map((r) => (
          <rect
            key={`${y}-${r.x}`}
            x={r.x}
            y={y}
            width={r.len}
            height={1}
            fill={bitmap.palette[r.ch] ?? "transparent"}
          />
        )),
      )}
    </svg>
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
 * 13×13 basketball: outlined circle crossed by both seams.
 *
 * Drawn on 13 rather than 11 deliberately. At 11 the one-pixel seams eat a
 * third of the face and the thing reads as a four-pane window; at 13 each
 * quarter is a solid 5×5 block of orange and it reads as a ball. The outline
 * is what separates it from the turf.
 */
export const BALL: Bitmap = {
  palette: { o: FLAG, k: INK },
  rows: [
    ".....kkk.....",
    "...kookook...",
    "..koookoook..",
    ".kooookooook.",
    ".kooookooook.",
    "koooookoooook",
    "kkkkkkkkkkkkk",
    "koooookoooook",
    ".kooookooook.",
    ".kooookooook.",
    "..koookoook..",
    "...kookook...",
    ".....kkk.....",
  ],
};

/** Backboard on the left, rim extending right, net hanging below it. */
export const HOOP: Bitmap = {
  palette: { w: CHALK, k: INK, r: FLAG, n: BONE },
  rows: [
    "kkkkkkkkk....",
    "kwwwwwwwk....",
    "kwwkkkwwk....",
    "kwwk.kwwk....",
    "kwwkkkwwk....",
    "kwwwwwwwk....",
    "kkkkkkkkk....",
    "....rrrrrrrrr",
    ".....nnnnnnn.",
    "......nnnnn..",
    ".......nnn...",
    "........n....",
  ],
};

/** 13×7 football, laces up. */
export const FOOTBALL: Bitmap = {
  palette: { b: LEATHER, l: CHALK, k: INK },
  rows: [
    "....kkkkk....",
    "..kkbbbbbkk..",
    ".kbbblllbbbk.",
    "kbbbblllbbbbk",
    ".kbbblllbbbk.",
    "..kkbbbbbkk..",
    "....kkkkk....",
  ],
};
