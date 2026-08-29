import { useAuth } from '../auth/AuthContext';
import { ClientTabs } from './client/ClientTabs';
import { ProfessionalTabs } from './professional/ProfessionalTabs';
import { resolveMainTabsKind } from './roleRouting';

/**
 * Role-aware navigation root (see docs/PRODUCT.md "Role-aware
 * navigation"). A CLIENT account never has a workspace of its own (see
 * docs/DATABASE.md) and gets the marketplace-only `ClientTabs`; an
 * AGENT or COMPANY member gets the CRM-oriented `ProfessionalTabs` —
 * accountType, not workspace presence, is the authoritative signal
 * (mirrors the backend's own registration split), so a professional who
 * hasn't finished onboarding still lands on their own navigation shape
 * rather than being misclassified as a client.
 */
export function MainTabs(): React.JSX.Element {
  const { user } = useAuth();
  return resolveMainTabsKind(user?.accountType) === 'client' ? (
    <ClientTabs />
  ) : (
    <ProfessionalTabs />
  );
}
