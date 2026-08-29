import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { DashboardScreen } from '../../screens/DashboardScreen';
import { AccountScreen } from '../../screens/AccountScreen';
import { PropertiesStack, type PropertiesStackParamList } from '../PropertiesStack';
import { ClientsStack, type ClientsStackParamList } from '../ClientsStack';

export type ProfessionalTabParamList = {
  Dashboard: undefined;
  Properties: NavigatorScreenParams<PropertiesStackParamList>;
  Clients: NavigatorScreenParams<ClientsStackParamList>;
  Account: undefined;
};

const Tab = createBottomTabNavigator<ProfessionalTabParamList>();

/**
 * Independent-agent and company-workspace-member navigation (see
 * docs/PRODUCT.md "Professional navigation") — Requirements/Matching/
 * Shortlist/Presentations are deliberately reached through the Clients
 * tab's own workflow (Client → Requirements → Matching → Shortlist →
 * Presentation), not as separate top-level tabs, since they only ever
 * make sense in the context of one client.
 */
export function ProfessionalTabs(): React.JSX.Element {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Properties" component={PropertiesStack} />
      <Tab.Screen name="Clients" component={ClientsStack} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ headerShown: true }} />
    </Tab.Navigator>
  );
}
