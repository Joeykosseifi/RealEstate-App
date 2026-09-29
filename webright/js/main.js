/**
 * WEBRIGHT — entry point
 * ------------------------------------------------------------------
 * Loaded on every page as an ES module (deferred by default).
 * Core behaviour runs everywhere; heavier, page-specific features are
 * imported only when their markup is present, so pages only download
 * the JavaScript they use.
 *
 * Progressive enhancement: every page is fully readable and navigable
 * without JavaScript. The inline snippet in <head> adds `.js` to <html>;
 * this module adds `.motion-ready` once it has taken over animations.
 */
import { initNavigation } from './navigation.js';
import { initAnimations } from './animations.js';
import { initAnalytics } from './analytics.js';

const root = document.documentElement;

function safely(name, fn) {
  try {
    fn();
  } catch (error) {
    // One failing feature must never take the rest of the page down.
    console.error(`[webright] ${name} failed to initialise`, error);
  }
}

// Page-specific modules, keyed by the element that needs them.
const lazyFeatures = [
  ['[data-wordplay]', () => import('./wordplay.js').then((m) => m.initWordplay())],
  ['[data-showcase]', () => import('./showcase.js').then((m) => m.initShowcase())],
  ['[data-project-form]', () => import('./project-form.js').then((m) => m.initProjectForm())],
];

safely('analytics', initAnalytics);
safely('navigation', initNavigation);
safely('animations', initAnimations);
root.classList.add('motion-ready');

for (const [selector, load] of lazyFeatures) {
  if (document.querySelector(selector)) {
    load().catch((error) => console.error(`[webright] ${selector} failed to load`, error));
  }
}
