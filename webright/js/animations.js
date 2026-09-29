/**
 * Animations — the "alignment" motion system
 * ------------------------------------------------------------------
 * - [data-reveal]  elements start slightly offset (CSS) and settle into
 *                  place when they enter the viewport.
 * - [data-observe] elements only receive `.is-revealed`; their CSS
 *                  decides what happens (specialist diagram lines,
 *                  statement strike-through, process nodes).
 * - [data-rail]    the hero discipline rail: items resolve from scattered
 *                  offsets onto one line shortly after load.
 *
 * With prefers-reduced-motion everything is shown in its final state
 * immediately (CSS durations also collapse to ~0).
 */
import { prefersReducedMotion } from './utils.js';

export function initAnimations() {
  const targets = document.querySelectorAll('[data-reveal], [data-observe]');
  const rails = document.querySelectorAll('[data-rail]');

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    targets.forEach((node) => node.classList.add('is-revealed', 'is-settled'));
    rails.forEach((rail) => rail.classList.add('is-aligned'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target);
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );

  targets.forEach((node) => observer.observe(node));
  rails.forEach(initRail);
}

function reveal(node) {
  node.classList.add('is-revealed');
  // Once the connection sequence has played, drop the long transition
  // delays so hover feedback is immediate.
  if (node.matches('.org')) {
    setTimeout(() => node.classList.add('is-settled'), 2400);
  }
}

function initRail(rail) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      // A short beat so the visitor sees the offset state before it resolves.
      setTimeout(() => rail.classList.add('is-aligned'), 450);
    },
    { threshold: 0.4 },
  );
  observer.observe(rail);
}
