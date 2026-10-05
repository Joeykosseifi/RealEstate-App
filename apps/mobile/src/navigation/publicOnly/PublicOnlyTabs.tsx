import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AccountScreen } from '../../screens/AccountScreen';
import { HomeStack } from '../client/HomeStack';
import { SearchStack } from '../client/SearchStack';
import { FavoritesStack } from '../client/FavoritesStack';
import type { ClientTabParamList } from '../client/ClientTabs';
import { QuickCreateButton } from '../professional/QuickCreateButton';
import { colors, shadows } from '../../theme';

/** Same route names as `ClientTabs` so the shared marketplace screens' cross-tab navigation (Home → Search) works unchanged. */
export type PublicOnlyTabParamList = ClientTabParamList & {
  AddProperty: undefined;
};

const Tab = createBottomTabNavigator<PublicOnlyTabParamList>();

function NoopScreen(): React.JSX.Element {
  return <View />;
}

/**
 * Navigation for an AGENT/COMPANY account that chose "Verify Later":
 * public marketplace only (Home | Search | + | Favorites | More). No
 * screen here loads workspace data. The center "+" stays visible so
 * adding a property is discoverable, but it opens the "Verification
 * required" prompt. Once verified, `MainTabs` switches to
 * `ProfessionalTabs` automatically.
 */
export function PublicOnlyTabs(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primaryNavy,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 58 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          ...shadows.sm,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="AddProperty"
        component={NoopScreen}
        options={{
          tabBarLabel: () => null,
          tabBarButton: () => <QuickCreateButton />,
        }}
        listeners={{
          tabPress: (e) => e.preventDefault(),
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          headerShown: true,
          tabBarLabel: 'More',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
