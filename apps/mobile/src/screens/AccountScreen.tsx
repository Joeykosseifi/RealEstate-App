import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { getWorkspaceDetail, requestPasswordReset, updateWorkspaceContact } from '../api/auth';
import { ApiError } from '../api/client';
import type { WorkspaceSummary } from '../api/types';
import { AppScreen, Button, Card, SectionHeader, TextField, confirmDestructive } from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';

/**
 * Role-aware account/profile screen (Milestone 6 & 6.1, restyled
 * Milestone 7 — see docs/PRODUCT.md "Account settings" and "Workspace
 * experience"). A CLIENT sees only their own identity + sign out. A
 * professional (AGENT/COMPANY) additionally sees a workspace switcher
 * (the real workspace name is always shown — never a generic "Personal
 * Workspace" placeholder, see docs/DESIGN_SYSTEM.md "Company
 * experience") and, when they hold `workspace.update`, the workspace's
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
      Alert.alert('Check your email', `We sent a password reset code to ${user.email}.`);
    } catch (err) {
      Alert.alert(
        'Could not send reset email',
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setResettingPassword(false);
    }
  };

  const onLogout = () => confirmDestructive('Sign out?', undefined, 'Sign Out', () => void logout());

  return (
    <AppScreen>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.firstName?.[0]}</Text>
        </View>
        <Text style={typography.h2}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={typography.bodySmall}>{user?.email}</Text>
        {user?.phone ? <Text style={typography.bodySmall}>{user.phone}</Text> : null}
      </View>

      {isProfessional && workspaces.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Workspace" />
          {workspaces.map((workspace) => {
            const active = workspace.id === currentWorkspace?.id;
            return (
              <TouchableOpacity
                key={workspace.id}
                style={[styles.workspaceRow, active && styles.workspaceRowActive]}
                onPress={() => onSwitchWorkspace(workspace)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={styles.flex1}>
                  <Text style={typography.h3}>{workspace.name}</Text>
                  <Text style={typography.caption}>
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
          <SectionHeader title="Public Contact Info" />
          <Text style={[typography.bodySmall, styles.hintSpacing]}>
            Shown to clients on this workspace&apos;s published listings. Leave a field blank to hide it.
          </Text>
          {!loadingContact && (
            <Card>
              <TextField label="Phone" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
              <TextField label="WhatsApp" value={contactWhatsapp} onChangeText={setContactWhatsapp} keyboardType="phone-pad" />
              <TextField label="Email" value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" />
              {contactError ? <Text style={styles.error}>{contactError}</Text> : null}
              {contactSaved ? <Text style={styles.success}>Saved.</Text> : null}
              <Button label="Save" size="sm" onPress={() => void onSaveContact()} loading={savingContact} />
            </Card>
          )}
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader title="Security" />
        <Button
          label="Reset Password"
          variant="secondary"
          onPress={() => void onRequestPasswordReset()}
          loading={resettingPassword}
        />
      </View>

      <Button label="Sign Out" variant="destructive" onPress={onLogout} style={styles.logoutButton} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand.primaryNavy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.smd,
  },
  avatarText: { color: colors.text.inverse, fontSize: 24, fontWeight: '700' },
  section: { marginBottom: spacing.xl },
  hintSpacing: { marginBottom: spacing.smd },
  flex1: { flex: 1 },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.smd,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  workspaceRowActive: { borderColor: colors.brand.primaryNavy, backgroundColor: colors.selectedTint },
  activeBadge: { color: colors.brand.primaryNavy, fontWeight: '700', fontSize: 12 },
  error: { color: colors.danger, marginBottom: spacing.sm },
  success: { color: colors.success, marginBottom: spacing.sm },
  logoutButton: { marginTop: spacing.sm },
});
