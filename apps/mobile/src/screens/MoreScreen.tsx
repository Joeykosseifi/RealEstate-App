import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export function MoreScreen(): React.JSX.Element {
  const { user, currentWorkspace, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.name}>
        {user?.firstName} {user?.lastName}
      </Text>
      <Text style={styles.workspace}>Workspace: {currentWorkspace?.name ?? '—'}</Text>
      <TouchableOpacity style={styles.button} onPress={() => void logout()}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  name: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  workspace: { color: '#666', marginBottom: 32 },
  button: {
    backgroundColor: '#c0392b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
