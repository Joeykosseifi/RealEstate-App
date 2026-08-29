import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { getWorkspaceDetail, requestPasswordReset, updateWorkspaceContact } from '../api/auth';
import { ApiError } from '../api/client';
import type { WorkspaceSummary } from '../api/types';

/**
 * Role-aware account/profile screen (see docs/PRODUCT.md "Account
 * settings" and "Workspace experience") — replaces the Milestone 3
 * `MoreScreen` stub. A CLIENT sees only their own identity + sign out.
 * A professional (AGENT/COMPANY) additionally sees a workspace switcher
 * (current workspace + type always visible, per the workspace-experience
 * requirement) and, when they hold `workspace.update`, the workspace's
 * public marketplace contact info.
 */
export function AccountScreen(): React.JSX.Element {
  const { user, workspaces, currentWorkspace, permissions, selectWorkspace, logout } = useAuth();
  const isProfessional = user?.accountType !== 'CLIENT';
  const canEditContact = permissions.has('workspace.update');

  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [loadingContact, setLoadingContact] = useState(isProfessional && canEditContact);
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSaved, setContactSaved] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const loadContact = useCallback(async () => {
    if (!isProfessional || !canEditContact || !currentWorkspace) {
      setLoadingContact(false);
      return;
    }
    setLoadingContact(true);
    try {
      const detail = await getWorkspaceDetail(currentWorkspace.id);
      setContactPhone(detail.publicContactPhone ?? '');
      setContactEmail(detail.publicContactEmail ?? '');
      setContactWhatsapp(detail.publicContactWhatsapp ?? '');
    } catch {
      // Non-fatal — the form just starts blank; saving still works.
    } finally {
      setLoadingContact(false);
    }
  }, [isProfessional, canEditContact, currentWorkspace]);

  useEffect(() => {
    void loadContact();
  }, [loadContact]);

  const onSaveContact = async () => {
    if (!currentWorkspace) return;
    setSavingContact(true);
    setContactError(null);
    setContactSaved(false);
    try {
      await updateWorkspaceContact(currentWorkspace.id, {
        publicContactPhone: contactPhone.trim(),
        publicContactEmail: contactEmail.trim(),
        publicContactWhatsapp: contactWhatsapp.trim(),
      });
      setContactSaved(true);
    } catch (err) {
      setContactError(err instanceof ApiError ? err.message : 'Could not save your contact info.');
    } finally {
      setSavingContact(false);
    }
  };

  const onSwitchWorkspace = (workspace: WorkspaceSummary) => {
    if (workspace.id === currentWorkspace?.id) return;
    selectWorkspace(workspace);
  };

  const onRequestPasswordReset = async () => {
    if (!user) return;
    setResettingPassword(true);
    try {
      await requestPasswordReset(user.email);
      Alert.alert('Check your email', `We sent a password reset link to ${user.email}.`);
    } catch (err) {
      Alert.alert(
        'Could not send reset email',
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setResettingPassword(false);
    }
  };

  const onLogout = () => {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.name}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.hint}>{user?.email}</Text>
        {user?.phone ? <Text style={styles.hint}>{user.phone}</Text> : null}
      </View>

      {isProfessional && workspaces.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workspace</Text>
          {workspaces.map((workspace) => {
            const active = workspace.id === currentWorkspace?.id;
            return (
              <TouchableOpacity
                key={workspace.id}
                style={[styles.workspaceRow, active && styles.workspaceRowActive]}
                onPress={() => onSwitchWorkspace(workspace)}
              >
                <View style={styles.flex1}>
                  <Text style={styles.workspaceName}>{workspace.name}</Text>
                  <Text style={styles.hint}>
                    {workspace.type === 'COMPANY' ? 'Company workspace' : 'Personal workspace'}
                  </Text>
                </View>
                {active ? <Text style={styles.activeBadge}>Active</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {isProfessional && canEditContact && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Public Contact Info</Text>
          <Text style={styles.hint}>
            Shown to clients on this workspace's published listings. Leave a field blank to hide it.
          </Text>
          {loadingContact ? (
            <ActivityIndicator style={styles.contactLoading} />
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Phone"
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="WhatsApp"
                value={contactWhatsapp}
                onChangeText={setContactWhatsapp}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={contactEmail}
                onChangeText={setContactEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {contactError ? <Text style={styles.error}>{contactError}</Text> : null}
              {contactSaved ? <Text style={styles.success}>Saved.</Text> : null}
              <TouchableOpacity
                style={[styles.saveButton, savingContact && styles.buttonDisabled]}
                onPress={() => void onSaveContact()}
                disabled={savingContact}
              >
                {savingContact ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => void onRequestPasswordReset()}
          disabled={resettingPassword}
        >
          {resettingPassword ? (
            <ActivityIndicator color="#1a73e8" />
          ) : (
            <Text style={styles.secondaryButtonText}>Reset Password</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  name: { fontSize: 20, fontWeight: '700' },
  hint: { color: '#888', fontSize: 13, marginTop: 2 },
  flex1: { flex: 1 },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  workspaceRowActive: { borderColor: '#1a73e8', backgroundColor: '#eef4ff' },
  workspaceName: { fontSize: 15, fontWeight: '600' },
  activeBadge: { color: '#1a73e8', fontWeight: '600', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  contactLoading: { marginVertical: 12 },
  error: { color: '#c0392b', marginBottom: 8 },
  success: { color: '#1a7f37', marginBottom: 8 },
  saveButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1a73e8',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#1a73e8', fontWeight: '600' },
  logoutButton: {
    backgroundColor: '#c0392b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
