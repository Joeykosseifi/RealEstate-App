import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { AccountScreen } from '../../screens/AccountScreen';
import { HomeStack, type HomeStackParamList } from './HomeStack';
import { SearchStack, type SearchStackParamList } from './SearchStack';
import { FavoritesStack, type FavoritesStackParamList } from './FavoritesStack';

export type ClientTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Search: NavigatorScreenParams<SearchStackParamList>;
  Favorites: NavigatorScreenParams<FavoritesStackParamList>;
  Account: undefined;
};

const Tab = createBottomTabNavigator<ClientTabParamList>();

/** Client-account navigation (see docs/PRODUCT.md "Client navigation") — Home/Marketplace, Search, Favorites, Account. Never exposes any professional (Properties/Clients CRM) screen. */
export function ClientTabs(): React.JSX.Element {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Search" component={SearchStack} />
      <Tab.Screen name="Favorites" component={FavoritesStack} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ headerShown: true }} />
    </Tab.Navigator>
  );
}
