/**
 * Wordplay — WEB | RIGHT  ⇄  WE | BRIGHT
 * ------------------------------------------------------------------
 * Markup contract (see index.html "Why WEBRIGHT"):
 *   [data-wordplay]            root; holds data-state="web" | "we"
 *   [data-wordplay-set="…"]    toggle buttons (aria-pressed)
 *   [data-meaning="…"]         explanation blocks that highlight in sync
 *   [data-wordplay-word]       the big word (decorative, aria-hidden);
 *                              clicking it flips the reading
 *
 * When the section first comes into view it plays the regrouping once
 * (WEB|RIGHT → WE|BRIGHT, well under 5 seconds) unless the visitor has
 * already interacted or prefers reduced motion. After that it only moves
 * when asked, so there is no auto-playing loop to pause.
 */
import { prefersReducedMotion } from './utils.js';

export function initWordplay() {
  document.querySelectorAll('[data-wordplay]').forEach(setup);
}

function setup(root) {
  const buttons = [...root.querySelectorAll('[data-wordplay-set]')];
  const meanings = [...root.querySelectorAll('[data-meaning]')];
  const word = root.querySelector('[data-wordplay-word]');
  let interacted = false;

  const setState = (state) => {
    root.dataset.state = state;
    buttons.forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.wordplaySet === state)),
    );
    meanings.forEach((meaning) =>
      meaning.classList.toggle('is-active', meaning.dataset.meaning === state),
    );
  };

  const toggle = () => setState(root.dataset.state === 'web' ? 'we' : 'web');

  buttons.forEach((button) =>
    button.addEventListener('click', () => {
      interacted = true;
      setState(button.dataset.wordplaySet);
    }),
  );

  word?.addEventListener('click', () => {
    interacted = true;
    toggle();
  });

  setState(root.dataset.state || 'web');

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setTimeout(() => {
        if (!interacted) setState('we');
      }, 1600);
    },
    { threshold: 0.6 },
  );
  observer.observe(word || root);
}
