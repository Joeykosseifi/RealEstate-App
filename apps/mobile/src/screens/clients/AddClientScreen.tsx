import { useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { createClient } from '../../api/clients';
import { ApiError } from '../../api/client';
import type { ClientsStackParamList } from '../../navigation/ClientsStack';
import { AppScreen, Button, FilterChip, TextField } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'AddClient'>;

const SOURCES = ['REFERRAL', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'WEBSITE', 'PHONE', 'WALK_IN', 'PROPERTY_INQUIRY', 'OTHER'];
const CONTACT_METHODS = ['PHONE', 'WHATSAPP', 'EMAIL', 'OTHER'];

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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
      {options.map((option) => (
        <FilterChip key={option} label={option} selected={value === option} onPress={() => onChange(value === option ? undefined : option)} />
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
  const [preferredContactMethod, setPreferredContactMethod] = useState<string | undefined>(undefined);
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
    <AppScreen>
      <TextField label="First name" value={firstName} onChangeText={setFirstName} />
      <TextField label="Last name" value={lastName} onChangeText={setLastName} />
      <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <Text style={typography.label}>How did they find you?</Text>
      <ChipPicker options={SOURCES} value={source} onChange={setSource} />

      <Text style={[typography.label, { marginBottom: spacing.sm }]}>More details</Text>
      <TextField label="WhatsApp" value={whatsappPhone} onChangeText={setWhatsappPhone} keyboardType="phone-pad" optional />
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" optional />
      <Text style={typography.label}>Preferred contact method</Text>
      <ChipPicker options={CONTACT_METHODS} value={preferredContactMethod} onChange={setPreferredContactMethod} />
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline optional />

      {error ? <Text style={{ color: colors.danger, marginBottom: spacing.sm, textAlign: 'center' }}>{error}</Text> : null}

      <Button label="Save Client" onPress={() => void onSubmit()} loading={submitting} style={{ marginTop: spacing.sm }} />
    </AppScreen>
  );
}
