"use client";

import { useEffect, useRef, useState } from "react";
import { BALL, FOOTBALL, HOOP, PixelSprite } from "./PixelSprite";

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
 * The focal moment: a shot arcing up and dropping through the net, on a loop.
 *
 * Sits where the landing's right column would otherwise run out of content,
 * so it fills real estate with the product's own subject rather than padding.
 */
export function HoopShot({ className = "" }: { className?: string }) {
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();

  // Fixed scene box: the arc keyframes are authored in pixels against these
  // dimensions, so a fluid width would throw the ball off the rim.
  return (
    <div
      ref={ref}
      className={`pixel-scene relative h-[168px] w-[248px] ${className}`}
      data-running={onScreen}
      aria-hidden
    >
      <PixelSprite bitmap={HOOP} className="absolute right-0 top-2 h-[96px] w-[104px]" />
      <PixelSprite bitmap={BALL} className="ball-shot absolute left-0 top-0 h-[52px] w-[52px]" />
    </div>
  );
}

/**
 * A football spiralling across the width — the multi-sport promise, stated
 * visually rather than in a roadmap sentence.
 */
export function FootballThrow({ className = "" }: { className?: string }) {
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`pixel-scene relative overflow-hidden ${className}`}
      data-running={onScreen}
      aria-hidden
    >
      <PixelSprite bitmap={FOOTBALL} className="ball-throw absolute top-0 h-[44px] w-[82px]" />
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
        <PixelSprite bitmap={BALL} className="ball-dribble absolute inset-x-0 top-0 h-[30px] w-[30px]" />
      </span>
      <span className="font-display text-sm text-ink-2">{label}</span>
    </div>
  );
}
