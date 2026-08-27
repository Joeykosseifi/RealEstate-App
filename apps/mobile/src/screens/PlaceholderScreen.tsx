import { StyleSheet, Text, View } from 'react-native';

/**
 * Shared placeholder for tabs Milestone 3 doesn't build business logic
 * for (Home, Clients, Inbox) — see docs/PRODUCT.md "Mobile build order."
 * Only Properties gets full functionality this milestone.
 */
export function PlaceholderScreen({ title }: { title: string }): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Coming in a later milestone.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  subtitle: { color: '#888' },
});
