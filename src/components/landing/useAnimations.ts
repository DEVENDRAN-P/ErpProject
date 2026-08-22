"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Custom hook for intersection observer animations.
 * Returns a ref to attach to the element and whether it's in view.
 */
export function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/**
 * Animated counter hook — counts from 0 to target.
 */
export function useCountUp(target: number, duration = 1200, startOnView = true) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView(0.3);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!startOnView || !inView || hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, target, duration, startOnView]);

  return { ref, count };
}

/**
 * Animate progress bar width from 0 to target.
 */
export function useProgress(target: number, duration = 1000) {
  const [width, setWidth] = useState(0);
  const { ref, inView } = useInView(0.3);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!inView || hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setWidth(eased * target);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, target, duration]);

  return { ref, width };
}

/**
 * Reveal animation class based on scroll
 */
export function useReveal(delay = 0) {
  const { ref, inView } = useInView(0.1);
  return {
    ref,
    className: `transition-all duration-700 ease-out ${
      inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
    }`,
    style: { transitionDelay: `${delay}ms` } as React.CSSProperties,
  };
}
