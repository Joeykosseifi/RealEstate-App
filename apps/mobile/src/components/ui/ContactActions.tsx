import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, radii, spacing } from '../../theme';

interface ContactActionsProps {
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  /** 'buttons' (full-width, labelled) matches the existing marketplace contact row; 'icons' is a compact circular row for a profile-style layout. */
  variant?: 'buttons' | 'icons';
}

/**
 * The one Call/WhatsApp/Email action pattern, extracted from the
 * marketplace "Contact Agent" row (Milestone 6) so Client Detail can
 * reuse the exact same tel:/wa.me/mailto: deep-link behavior instead of
 * reimplementing it — see docs/PRODUCT.md "Contact-professional flow".
 * Renders nothing for a channel whose value is absent — never a fake
 * disabled button for contact info that doesn't exist.
 */
export function ContactActions({ phone, whatsapp, email, variant = 'buttons' }: ContactActionsProps): React.JSX.Element | null {
  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open', 'Please try again.');
    }
  };

  const onCall = () => phone && void openLink(`tel:${phone}`);
  const onWhatsApp = () => {
    if (!whatsapp) return;
    const digits = whatsapp.replace(/[^\d]/g, '');
    void openLink(`https://wa.me/${digits}`);
  };
  const onEmail = () => email && void openLink(`mailto:${email}`);

  if (!phone && !whatsapp && !email) return null;

  if (variant === 'icons') {
    return (
      <View style={styles.iconRow}>
        {phone ? <IconAction icon="call-outline" label="Call" onPress={onCall} /> : null}
        {whatsapp ? <IconAction icon="logo-whatsapp" label="WhatsApp" onPress={onWhatsApp} /> : null}
        {email ? <IconAction icon="mail-outline" label="Email" onPress={onEmail} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.buttonRow}>
      {phone ? <Button label="Call" onPress={onCall} style={styles.button} /> : null}
      {whatsapp ? <Button label="WhatsApp" onPress={onWhatsApp} style={styles.button} /> : null}
      {email ? <Button label="Email" onPress={onEmail} style={styles.button} /> : null}
    </View>
  );
}

function IconAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.iconAction} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={20} color={colors.brand.primaryNavy} />
      </View>
      <Text style={styles.iconLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1 },
  iconRow: { flexDirection: 'row', gap: spacing.lg },
  iconAction: { alignItems: 'center', gap: 4 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.selectedTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
});
