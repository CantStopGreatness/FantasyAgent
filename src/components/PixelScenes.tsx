"use client";

import { useEffect, useRef, useState } from "react";
import {
  BALL,
  FOOTBALL_SPIN,
  GOAL_FRAME,
  HOOP,
  MESH_FRAMES,
  NET_FRAMES,
  PixelAnim,
  PixelSprite,
  SOCCER_BALL,
} from "./PixelSprite";

/**
 * Looping sprite scenes.
 *
 * Motion is quantised with `steps()` rather than eased, because the point is
 * the low-framerate feel of a sprite game — smooth interpolation would read as
 * a modern web animation wearing pixel clothes.
 *
 * Every loop pauses when it scrolls out of view, and the global
 * prefers-reduced-motion rule stops them outright.
 */
function useOnScreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setOnScreen(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      rootMargin: "80px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, onScreen };
}

/**
 * A travelling sprite rides a wrapper that fills the whole lane.
 *
 * This exists because CSS transform percentages resolve against the element's
 * own box: `translateX(50%)` on a 44px ball moves it 22px, not half the lane.
 * Sizing the mover to the lane makes the percentages mean what the keyframes
 * intend, so a shot can be aimed at the rim in lane-relative terms and stay
 * aimed when the column resizes.
 */
function Mover({ className, children }: { className: string; children: React.ReactNode }) {
  return <div className={`pointer-events-none absolute inset-0 ${className}`}>{children}</div>;
}

/**
 * Three sports, one panel.
 *
 * Kept as a single card with shared ground, one sprite scale and hard ink
 * rules between lanes, so it reads as one attract-mode screen rather than
 * three unrelated toys scattered down the page. It also carries the
 * sport-agnostic claim visually: the engine is not a basketball tool.
 */
export function SportsReel({ className = "" }: { className?: string }) {
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();

  return (
    <div ref={ref} className={`card pixel-scene ${className}`} data-running={onScreen}>
      <div className="strip flex items-baseline justify-between px-4 py-2">
        <span className="font-display text-sm">BUILT FOR EVERY LEAGUE</span>
        <span className="text-[0.65rem] text-bone-3">NBA today · more next</span>
      </div>

      <div className="divide-y-[3px] divide-ink border-t-[3px] border-ink" aria-hidden>
        <HoopLane />
        <FootballLane />
        <GoalLane />
      </div>
    </div>
  );
}

/** Lanes are dark so bone nets, a white goal and an orange ball all read. */
const LANE = "lane relative h-[120px] overflow-hidden";

/** The ball arcs up and drops through the rim; the net snaps as it passes. */
function HoopLane() {
  return (
    <div className={LANE}>
      <PixelSprite bitmap={HOOP} className="absolute right-6 top-4 h-[68px] w-[110px]" />
      {/* Net hangs from the rim and goes taut on the pass-through frame. */}
      <PixelAnim
        frames={NET_FRAMES}
        duration="3.6s"
        className="absolute right-[26px] top-[66px] w-[70px]"
      />
      <Mover className="ball-shot">
        <PixelSprite bitmap={BALL} className="absolute left-0 top-0 h-[44px] w-[44px]" />
      </Mover>
    </div>
  );
}

/**
 * A spiral along an arc.
 *
 * The spin is frames, not a transform: the laces travel across the face and
 * wrap out of sight, which is what a spiral looks like. An end-over-end
 * `rotate()` is a wobbling duck.
 */
function FootballLane() {
  return (
    <div className={LANE}>
      <Mover className="ball-throw">
        <PixelAnim
          frames={FOOTBALL_SPIN}
          duration="0.44s"
          className="absolute left-0 top-0 w-[92px]"
        />
      </Mover>
    </div>
  );
}

/** Struck low and hard; the mesh snaps taut where it lands. */
function GoalLane() {
  return (
    <div className={LANE}>
      <PixelSprite bitmap={GOAL_FRAME} className="absolute right-4 top-6 h-[76px] w-[130px]" />
      <PixelAnim
        frames={MESH_FRAMES}
        duration="3.6s"
        className="absolute right-[31px] top-[39px] w-[92px]"
      />
      <Mover className="ball-strike">
        <PixelSprite bitmap={SOCCER_BALL} className="absolute left-0 top-[72px] h-[34px] w-[34px]" />
      </Mover>
    </div>
  );
}

/**
 * A dribbling ball for loading states.
 *
 * Replaces a generic pulse with motion that says the same thing in the world's
 * own vocabulary: something is in play, wait for it.
 */
export function DribbleLoader({ label }: { label: string }) {
  return (
    <div className="pixel-scene flex items-center gap-3" data-running="true">
      <span className="relative block h-[40px] w-[30px]">
        <PixelSprite
          bitmap={BALL}
          className="ball-dribble absolute inset-x-0 top-0 h-[30px] w-[30px]"
        />
      </span>
      <span className="font-display text-sm text-ink-2">{label}</span>
    </div>
  );
}
