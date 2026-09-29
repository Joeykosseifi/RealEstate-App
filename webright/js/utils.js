/**
 * Small shared helpers. Kept dependency-free and side-effect-free.
 */

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/** True when the visitor has asked the OS to minimise motion. */
export function prefersReducedMotion() {
  return reducedMotionQuery.matches;
}

/** Run `fn` at most once per animation frame (for scroll/resize handlers). */
export function rafThrottle(fn) {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...args);
    });
  };
}

/** Promise-based delay. */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create an element with attributes and children using safe DOM APIs
 * (never innerHTML), so user-provided text can't inject markup.
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'className') node.className = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}
