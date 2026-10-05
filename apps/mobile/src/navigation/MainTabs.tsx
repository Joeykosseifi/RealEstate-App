import { useAuth } from '../auth/AuthContext';
import { isAccountVerified } from '../auth/accountVerification';
import { ClientTabs } from './client/ClientTabs';
import { ProfessionalTabs } from './professional/ProfessionalTabs';
import { PublicOnlyTabs } from './publicOnly/PublicOnlyTabs';
import { resolveMainTabsKind } from './roleRouting';

/**
 * Role-aware navigation root (see docs/PRODUCT.md "Role-aware
 * navigation"). A CLIENT account never has a workspace of its own (see
 * docs/DATABASE.md) and gets the marketplace-only `ClientTabs`; a
 * verified AGENT or COMPANY member gets the CRM-oriented
 * `ProfessionalTabs`; an unverified AGENT/COMPANY ("Verify Later") gets
 * the marketplace-only `PublicOnlyTabs`, matching the API, which
 * rejects every workspace route until the account is verified.
 */
export function MainTabs(): React.JSX.Element {
  const { user } = useAuth();
  const kind = resolveMainTabsKind(user?.accountType, isAccountVerified(user));
  if (kind === 'client') return <ClientTabs />;
  if (kind === 'publicOnly') return <PublicOnlyTabs />;
  return <ProfessionalTabs />;
}
