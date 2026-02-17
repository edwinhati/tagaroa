/**
 * Consistent animation patterns for the finance dashboard.
 * All animations respect the user's prefers-reduced-motion preference.
 */

export const animations = {
  // Card entrance animations (staggered)
  cardEntrance: {
    duration: 300,
    ease: [0.4, 0, 0.2, 1] as const, // easeOut
    stagger: 50, // ms between each card
  },

  // Number counter animations
  numberCounter: {
    duration: 1000,
    ease: [0.4, 0, 0.2, 1] as const, // easeOut
  },

  // Chart data transitions
  chartTransition: {
    duration: 500,
    ease: [0.4, 0, 0.6, 1] as const, // easeInOut
  },

  // Hover interactions
  hoverScale: {
    scale: 1.02,
    transition: {
      duration: 200,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },

  // Fade in/out
  fade: {
    duration: 200,
    ease: [0.4, 0, 0.2, 1] as const,
  },

  // Slide animations
  slide: {
    duration: 300,
    ease: [0.4, 0, 0.2, 1] as const,
  },
} as const;

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Get animation duration, respecting reduced motion preference
 */
export function getAnimationDuration(duration: number): number {
  return prefersReducedMotion() ? 0 : duration;
}

/**
 * Stagger delay calculator for card entrances
 */
export function getStaggerDelay(
  index: number,
  stagger = animations.cardEntrance.stagger,
): number {
  return prefersReducedMotion() ? 0 : index * stagger;
}
