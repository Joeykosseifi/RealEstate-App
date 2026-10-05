import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import {
  VERIFICATION_PROMPT_TITLE,
  buildVerificationPromptButtons,
  verificationPromptMessage,
} from '../auth/accountVerification';
import type { AppStackParamList } from './AppStack';

/**
 * Shows the "Verification required" prompt. "Verify Account" opens the
 * existing verification screen; "Not Now" dismisses and leaves the user
 * where they were. Must be used inside `AppStack`.
 */
export function useVerificationPrompt(): (feature?: string) => void {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();

  return useCallback(
    (feature?: string) => {
      Alert.alert(
        VERIFICATION_PROMPT_TITLE,
        verificationPromptMessage(feature),
        buildVerificationPromptButtons({
          onVerify: () => navigation.navigate('VerifyAccount'),
        }),
        { cancelable: true },
      );
    },
    [navigation],
  );
}
