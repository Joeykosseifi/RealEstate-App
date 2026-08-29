import type { ViewStyle } from 'react-native';

/** Subtle elevation only — white cards on `#F6F7F9` use a soft border first, shadow second. */
export const shadows: Record<'none' | 'sm' | 'md', ViewStyle> = {
  none: {},
  sm: {
    shadowColor: '#0F1F33',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F1F33',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
};
