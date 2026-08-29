import { Alert } from 'react-native';

/**
 * The one confirmation-dialog pattern for a destructive action
 * (Milestone 7) — wraps the native `Alert` rather than a custom modal,
 * since the OS's own confirmation dialog is already accessible and
 * consistent per-platform.
 */
export function confirmDestructive(
  title: string,
  message: string | undefined,
  confirmLabel: string,
  onConfirm: () => void,
): void {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
