/**
 * Navigation
 * ------------------------------------------------------------------
 * 1. Sticky header: gains a hairline once scrolled; tucks away while
 *    scrolling down and returns on scroll up (never while in use).
 * 2. Services dropdown: disclosure pattern (button + aria-expanded).
 *    Click / Enter / Space toggle, ArrowDown opens and moves into the
 *    list, arrows/Home/End move between items, Escape closes and returns
 *    focus to the trigger. On hover-capable pointers it also opens on
 *    hover with a short grace period.
 * 3. Mobile menu: a native modal <dialog> — gives focus containment,
 *    Escape-to-close and an inert page behind it for free.
 */
import { rafThrottle } from './utils.js';

const DESKTOP_NAV = window.matchMedia('(min-width: 62rem)');
const CAN_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)');

export function initNavigation() {
  initHeader();
  document.querySelectorAll('[data-dropdown]').forEach(initDropdown);
  initMobileMenu();
}

/* ---------------------------------------------------------------- header */
function initHeader() {
  const header = document.querySelector('[data-header]');
  if (!header) return;

  let lastY = window.scrollY;
  const HIDE_AFTER = 480;

  const update = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 8);

    const busy = header.matches(':focus-within') || header.querySelector('.is-open');
    const delta = y - lastY;
    if (busy || y < HIDE_AFTER || delta < -4) header.classList.remove('is-hidden');
    else if (delta > 6) header.classList.add('is-hidden');
    lastY = y;
  };

  window.addEventListener('scroll', rafThrottle(update), { passive: true });
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  update();
}

/* -------------------------------------------------------------- dropdown */
function initDropdown(item) {
  const trigger = item.querySelector('[data-dropdown-trigger]');
  const panel = item.querySelector('[data-dropdown-panel]');
  if (!trigger || !panel) return;

  const links = () => [...panel.querySelectorAll('a')];
  let hoverTimer;
  let openedByHoverAt = 0;

  const isOpen = () => trigger.getAttribute('aria-expanded') === 'true';

  const open = () => {
    clearTimeout(hoverTimer);
    trigger.setAttribute('aria-expanded', 'true');
    item.classList.add('is-open');
  };

  const close = ({ focusTrigger = false } = {}) => {
    clearTimeout(hoverTimer);
    trigger.setAttribute('aria-expanded', 'false');
    item.classList.remove('is-open');
    if (focusTrigger) trigger.focus();
  };

  trigger.addEventListener('click', () => {
    // A click right after a hover-open should not immediately close it.
    if (isOpen() && Date.now() - openedByHoverAt > 400) close();
    else open();
  });

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      open();
      links()[0]?.focus();
    }
  });

  panel.addEventListener('keydown', (event) => {
    const items = links();
    const index = items.indexOf(document.activeElement);
    const focusAt = (i) => items[(i + items.length) % items.length].focus();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (index <= 0) trigger.focus();
        else focusAt(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(items.length - 1);
        break;
      default:
    }
  });

  item.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      event.stopPropagation();
      close({ focusTrigger: true });
    }
  });

  // Close when focus leaves the whole dropdown (Tab past the last link).
  item.addEventListener('focusout', (event) => {
    if (!item.contains(event.relatedTarget)) close();
  });

  document.addEventListener('click', (event) => {
    if (isOpen() && !item.contains(event.target)) close();
  });

  item.addEventListener('mouseenter', () => {
    if (!CAN_HOVER.matches || !DESKTOP_NAV.matches) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (!isOpen()) openedByHoverAt = Date.now();
      open();
    }, 80);
  });

  item.addEventListener('mouseleave', () => {
    if (!CAN_HOVER.matches) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (!item.contains(document.activeElement)) close();
    }, 220);
  });
}

/* ----------------------------------------------------------- mobile menu */
function initMobileMenu() {
  const menu = document.querySelector('[data-menu]');
  const openButton = document.querySelector('[data-menu-open]');
  if (!menu || !openButton) return;

  const supportsDialog = typeof menu.showModal === 'function';

  const open = () => {
    if (supportsDialog) menu.showModal();
    else menu.setAttribute('open', '');
    openButton.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('menu-open');
  };

  const close = () => {
    if (!menu.open) return;
    if (supportsDialog) menu.close();
    else menu.removeAttribute('open');
  };

  // `close` fires for Escape, the close button and programmatic closes.
  menu.addEventListener('close', () => {
    openButton.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('menu-open');
    openButton.focus();
  });

  openButton.addEventListener('click', open);
  menu.querySelector('[data-menu-close]')?.addEventListener('click', close);

  // Links to the current page (or in-page anchors) should still dismiss.
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) close();
  });

  // Rotating a tablet to landscape can reveal the desktop nav.
  DESKTOP_NAV.addEventListener('change', (event) => {
    if (event.matches) close();
  });
}
