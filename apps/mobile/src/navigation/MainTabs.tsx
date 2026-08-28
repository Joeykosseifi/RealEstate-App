import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { PropertiesStack } from './PropertiesStack';
import { ClientsStack } from './ClientsStack';
import { MarketplaceStack } from './MarketplaceStack';

export type MainTabParamList = {
  Home: undefined;
  Properties: undefined;
  Clients: undefined;
  Inbox: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * The five-tab shell described in the Milestone 3 spec. Clients was
 * wired to real business functionality in Milestone 4 (CRM,
 * requirements, matching, shortlist, presentations); Home is now the
 * client marketplace (Milestone 5: browse/search/favorite published
 * listings). Inbox remains a deliberate placeholder (see
 * docs/PRODUCT.md) — in-app messaging is reserved for a later
 * milestone — not a dead button: it renders a real screen explaining
 * what's coming, rather than doing nothing when tapped.
 */
export function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={MarketplaceStack} options={{ headerShown: false }} />
      <Tab.Screen name="Properties" component={PropertiesStack} options={{ headerShown: false }} />
      <Tab.Screen name="Clients" component={ClientsStack} options={{ headerShown: false }} />
      <Tab.Screen name="Inbox" children={() => <PlaceholderScreen title="Inbox" />} />
      <Tab.Screen name="More" component={MoreScreen} options={{ headerShown: true }} />
    </Tab.Navigator>
  );
}
