import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../../theme';

export interface ActionSheetItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  items: ActionSheetItem[];
  onClose: () => void;
}

/**
 * The one bottom-sheet pattern for a short action list (Milestone 7) —
 * used by the professional tab bar's "+" quick-create action (Add
 * Property / New Client / New Requirement) and anywhere else a small
 * set of actions needs a modal picker, so every "+"-style menu in the
 * app looks and behaves the same way.
 */
export function ActionSheet({ visible, title, items, onClose }: ActionSheetProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.handle} />
          {title ? <Text style={[typography.h3, styles.title]}>{title}</Text> : null}
          {items.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.item}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              accessibilityRole="button"
            >
              <Text style={[typography.body, item.destructive && styles.destructiveLabel]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.item, styles.cancelItem]} onPress={onClose}>
            <Text style={[typography.body, styles.cancelLabel]}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.cardLarge,
    borderTopRightRadius: radii.cardLarge,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: { marginBottom: spacing.sm },
  item: { paddingVertical: spacing.smd, borderTopWidth: 1, borderTopColor: colors.border },
  destructiveLabel: { color: colors.danger, fontWeight: '600' },
  cancelItem: { marginTop: spacing.xs },
  cancelLabel: { color: colors.text.secondary, fontWeight: '600', textAlign: 'center' },
});
