import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '../../theme';

interface SearchInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}

/** A clearable search box — the "X" only appears once there's text to clear. */
export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search',
  onSubmit,
}: SearchInputProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>⌕</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.text.secondary}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoCapitalize="none"
        accessibilityLabel={placeholder}
      />
      {value.length > 0 ? (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityLabel="Clear search"
        >
          <Text style={styles.clear}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.smd,
  },
  icon: { fontSize: 16, color: colors.text.secondary, marginRight: spacing.sm },
  input: { flex: 1, paddingVertical: 11, fontSize: 15, color: colors.text.primary },
  clear: { fontSize: 14, color: colors.text.secondary, paddingLeft: spacing.sm },
});
