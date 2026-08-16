/**
 * Drawn icons for the turf world.
 *
 * Solid geometry on a 16-unit grid, no strokes — the same printing logic as
 * the panels, so an icon reads as stamped ink rather than as a line drawing
 * borrowed from another system. Everything inherits `currentColor`.
 */
type IconProps = {
  name: IconName;
  className?: string;
  /** Decorative by default; pass a label when the icon is the only content. */
  label?: string;
};

export type IconName =
  | "arrow-right"
  | "chevron-down"
  | "swap"
  | "up"
  | "down"
  | "check"
  | "alert"
  | "lock"
  | "whistle";

const PATHS: Record<IconName, React.ReactNode> = {
  "arrow-right": <path d="M2 6.5h7V3l5 5-5 5V9.5H2z" />,
  "chevron-down": <path d="M2.5 5h11L8 11.5z" />,
  // Two staggered arrows: the trade motion, both directions at once.
  swap: (
    <>
      <path d="M1 4.5h8V2l4 3.5L9 9V6.5H1z" />
      <path d="M15 11.5H7V14l-4-3.5L7 7v2.5h8z" />
    </>
  ),
  up: <path d="M8 2.5 14 10H2z" />,
  down: <path d="M8 13.5 2 6h12z" />,
  check: <path d="M6.2 13 1 7.8l2.1-2.1 3.1 3.1L12.9 2.5 15 4.6z" />,
  alert: <path d="M8 1.5 15.5 14.5h-15zM7 6h2v4H7zm0 5h2v2H7z" fillRule="evenodd" />,
  lock: (
    <path
      d="M4 7V5a4 4 0 1 1 8 0v2h1.5v8h-11V7zm2 0h4V5a2 2 0 1 0-4 0z"
      fillRule="evenodd"
    />
  ),
  // A referee's whistle: the analyst's own mark. Drawn as a ring plus a
  // mouthpiece bar rather than a filled silhouette, because at 14px a solid
  // shape collapses into an unreadable blob.
  whistle: (
    <>
      <path d="M7.4 2.6H15V6H7.4z" />
      <path
        d="M6 4.9a5.55 5.55 0 1 0 0 11.1A5.55 5.55 0 0 0 6 4.9zm0 2.8a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5z"
        fillRule="evenodd"
      />
    </>
  ),
};

export function Icon({ name, className = "h-4 w-4", label }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="currentColor"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {label && <title>{label}</title>}
      {PATHS[name]}
    </svg>
  );
}
