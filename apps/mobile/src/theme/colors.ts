/**
 * ProBase brand palette (Milestone 7) — LOCKED. Do not introduce a
 * second primary palette; extend `status` for a new semantic state
 * instead of inventing a one-off hex value in a screen.
 *
 * Navy is the dominant brand color; gold is a selective accent (primary
 * CTAs, active nav indicators, progress, highlights) — never a whole
 * screen, never body text, never every button. See docs/DESIGN_SYSTEM.md.
 */
export const colors = {
  brand: {
    deepNavy: '#0F1F33',
    primaryNavy: '#163A5F',
    gold: '#C9942F',
  },
  background: '#F6F7F9',
  surface: '#FFFFFF',
  /** Light navy tint for a selected row/card/chip — the one "selected" treatment used everywhere. */
  selectedTint: '#EEF3F8',
  text: {
    primary: '#17212B',
    secondary: '#667085',
    inverse: '#FFFFFF',
    onGold: '#0F1F33',
  },
  border: '#E4E7EC',
  borderStrong: '#CBD2D9',
  overlay: 'rgba(15, 31, 51, 0.5)',

  /**
   * Semantic status colors — communicate STATE, never brand. Reused by
   * `StatusBadge` for both business status (AVAILABLE/RESERVED/SOLD/
   * RENTED/OFF_MARKET/ARCHIVED) and publication status (PRIVATE/
   * PENDING_REVIEW/PUBLISHED/etc.) — the two are always rendered as
   * separate badges, never merged into one ambiguous status (see
   * docs/PRODUCT.md "Property status — two separate badges, always").
   */
  status: {
    available: { fg: '#0F7B4E', bg: '#E4F6EC' },
    pending: { fg: '#B25E09', bg: '#FCEDD8' },
    sold: { fg: '#B42318', bg: '#FBE7E6' },
    rented: { fg: '#1D5FBF', bg: '#E4EEFC' },
    reserved: { fg: '#1D5FBF', bg: '#E4EEFC' },
    private: { fg: '#374151', bg: '#EEF0F2' },
    published: { fg: '#0F7B4E', bg: '#E4F6EC' },
    archived: { fg: '#667085', bg: '#EEF0F2' },
    rejected: { fg: '#B42318', bg: '#FBE7E6' },
    changesRequested: { fg: '#B25E09', bg: '#FCEDD8' },
  },

  danger: '#C0392B',
  success: '#0F7B4E',
} as const;

export type StatusColorKey = keyof typeof colors.status;
