import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';

interface StepIndicatorProps {
  /** Short labels shown under each step number, e.g. ['Details', 'Location', ...]. */
  steps: string[];
  /** 0-based index of the current step. */
  currentStep: number;
}

/**
 * Numbered-circle progress row for a multi-step flow (Milestone: UI
 * redesign pass). Purely presentational — the caller owns step state
 * and validation; this never changes how many steps exist or what they
 * do, only how progress through them is displayed.
 */
export function StepIndicator({ steps, currentStep }: StepIndicatorProps): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {steps.map((label, index) => {
          const done = index < currentStep;
          const active = index === currentStep;
          return (
            <View key={label} style={styles.stepGroup}>
              <View style={styles.circleRow}>
                <View style={[styles.circle, (done || active) && styles.circleFilled]}>
                  <Text style={[styles.circleText, (done || active) && styles.circleTextFilled]}>
                    {done ? '✓' : index + 1}
                  </Text>
                </View>
                {index < steps.length - 1 ? (
                  <View style={[styles.line, done && styles.lineFilled]} />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
      <Text style={styles.currentLabel}>
        Step {currentStep + 1} of {steps.length} · {steps[currentStep]}
      </Text>
    </View>
  );
}

const CIRCLE_SIZE = 26;

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  stepGroup: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  circleRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleFilled: { backgroundColor: colors.brand.primaryNavy, borderColor: colors.brand.primaryNavy },
  circleText: { fontSize: 12, fontWeight: '700', color: colors.text.secondary },
  circleTextFilled: { color: colors.text.inverse },
  line: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  lineFilled: { backgroundColor: colors.brand.primaryNavy },
  currentLabel: { ...typography.label, marginTop: spacing.sm },
});
