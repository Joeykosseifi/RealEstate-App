import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { colors, shadows } from '../../theme';
import { ActionSheet, IconButton } from '../../components/ui';
import type { ProfessionalTabParamList } from './ProfessionalTabs';

/**
 * The professional tab bar's center "+" quick-create action (Milestone
 * 7 spec §12) — a prominent gold button (the one deliberate use of gold
 * as a primary CTA) that opens a short action sheet for the workflows
 * that already exist: Add Property, New Client, New Requirement. It
 * never navigates anywhere itself — `tabBarButton` intercepts the tab
 * press (see `ProfessionalTabs`) so this renders in place of a normal
 * tab icon/label.
 */
export function QuickCreateButton(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<ProfessionalTabParamList>>();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <IconButton
        icon={<Text style={styles.plus}>+</Text>}
        onPress={() => setOpen(true)}
        accessibilityLabel="Quick create"
        style={styles.button}
      />
      <ActionSheet
        visible={open}
        title="Create new"
        onClose={() => setOpen(false)}
        items={[
          {
            label: 'Add Property',
            onPress: () => navigation.navigate('Properties', { screen: 'AddProperty' }),
          },
          {
            label: 'New Client',
            onPress: () => navigation.navigate('Clients', { screen: 'AddClient' }),
          },
          {
            label: 'New Requirement',
            onPress: () => navigation.navigate('Clients', { screen: 'ClientsList' }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand.gold,
    marginTop: -22,
    borderWidth: 4,
    borderColor: colors.background,
    ...shadows.md,
  },
  plus: { fontSize: 26, fontWeight: '600', color: colors.text.onGold, lineHeight: 30 },
});
