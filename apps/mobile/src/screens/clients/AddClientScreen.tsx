import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { createClient } from '../../api/clients';
import { ApiError } from '../../api/client';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';

type Props = NativeStackScreenProps<ClientsStackParamList, 'AddClient'>;

const SOURCES = [
  'REFERRAL',
  'WHATSAPP',
  'INSTAGRAM',
  'FACEBOOK',
  'WEBSITE',
  'PHONE',
  'WALK_IN',
  'PROPERTY_INQUIRY',
  'OTHER',
];
const CONTACT_METHODS = ['PHONE', 'WHATSAPP', 'EMAIL', 'OTHER'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChipPicker({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          style={[styles.chip, value === option && styles.chipActive]}
          onPress={() => onChange(value === option ? undefined : option)}
        >
          <Text style={[styles.chipText, value === option && styles.chipTextActive]}>{option}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * A single, uncluttered form for the fields agents actually need on
 * first contact — name, phone, and how the client found them. WhatsApp/
 * email/preferred-contact-method/notes live under "More details" so the
 * first screen an agent sees on a live call stays fast to fill in. See
 * docs/PRODUCT.md "Mobile CRM flow."
 */
export function AddClientScreen({ navigation }: Props): React.JSX.Element {
  const { currentWorkspace } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState<string | undefined>(undefined);
  const [preferredContactMethod, setPreferredContactMethod] = useState<string | undefined>(
    undefined,
  );
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!currentWorkspace) return;
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError('First name, last name, and phone are required.');
      return;
    }

    setSubmitting(true);
    try {
      await createClient(currentWorkspace.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        whatsappPhone: whatsappPhone.trim() || undefined,
        email: email.trim() || undefined,
        source,
        preferredContactMethod,
        notes: notes.trim() || undefined,
      });
      navigation.navigate('ClientsList');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this client.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Name">
        <TextInput
          style={styles.input}
          placeholder="First name"
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          style={styles.input}
          placeholder="Last name"
          value={lastName}
          onChangeText={setLastName}
        />
      </Section>

      <Section title="Phone">
        <TextInput
          style={styles.input}
          placeholder="Phone"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
      </Section>

      <Section title="How did they find you?">
        <ChipPicker options={SOURCES} value={source} onChange={setSource} />
      </Section>

      <Section title="More details">
        <TextInput
          style={styles.input}
          placeholder="WhatsApp (if different)"
          keyboardType="phone-pad"
          value={whatsappPhone}
          onChangeText={setWhatsappPhone}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <Text style={styles.label}>Preferred contact method</Text>
        <ChipPicker
          options={CONTACT_METHODS}
          value={preferredContactMethod}
          onChange={setPreferredContactMethod}
        />
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </Section>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.buttonDisabled]}
        onPress={() => void onSubmit()}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Save Client</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  label: { fontSize: 13, color: '#666', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0' },
  chipActive: { backgroundColor: '#1a73e8' },
  chipText: { color: '#333', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  submitButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c0392b', marginBottom: 12, textAlign: 'center' },
});
