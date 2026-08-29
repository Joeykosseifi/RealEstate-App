import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AccountScreen } from '../../screens/AccountScreen';
import { HomeStack, type HomeStackParamList } from './HomeStack';
import { SearchStack, type SearchStackParamList } from './SearchStack';
import { FavoritesStack, type FavoritesStackParamList } from './FavoritesStack';
import { colors } from '../../theme';

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
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primaryNavy,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStack}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesStack}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          headerShown: true,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
