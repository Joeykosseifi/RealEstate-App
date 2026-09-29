/**
 * Services showcase (home page)
 * ------------------------------------------------------------------
 * Hovering or focusing a service row swaps the visual on the sticky
 * stage beside the list. The stage is decorative (aria-hidden): every
 * row already contains its own title, description and link, so nothing
 * is lost for keyboard, screen-reader or touch users.
 */
export function initShowcase() {
  document.querySelectorAll('[data-showcase]').forEach((showcase) => {
    const items = [...showcase.querySelectorAll('[data-showcase-item]')];
    const plates = [...showcase.querySelectorAll('[data-plate]')];
    const caption = showcase.querySelector('[data-showcase-caption]');

    const activate = (item) => {
      const key = item.dataset.showcaseItem;
      items.forEach((other) => other.classList.toggle('is-active', other === item));
      plates.forEach((plate) => plate.classList.toggle('is-active', plate.dataset.plate === key));
      if (caption) caption.textContent = item.dataset.showcaseLabel || '';
    };

    items.forEach((item) => {
      item.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'mouse') activate(item);
      });
      item.addEventListener('focusin', () => activate(item));
    });
  });
}
