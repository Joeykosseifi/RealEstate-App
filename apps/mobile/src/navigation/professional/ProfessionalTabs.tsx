import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DashboardScreen } from '../../screens/DashboardScreen';
import { AccountScreen } from '../../screens/AccountScreen';
import { PropertiesStack, type PropertiesStackParamList } from '../PropertiesStack';
import { ClientsStack, type ClientsStackParamList } from '../ClientsStack';
import { QuickCreateButton } from './QuickCreateButton';
import { colors, shadows } from '../../theme';

export type ProfessionalTabParamList = {
  Dashboard: undefined;
  Properties: NavigatorScreenParams<PropertiesStackParamList>;
  QuickCreate: undefined;
  Clients: NavigatorScreenParams<ClientsStackParamList>;
  Account: undefined;
};

const Tab = createBottomTabNavigator<ProfessionalTabParamList>();

/** Never actually rendered — `QuickCreate`'s tab press is intercepted before any navigation happens (see `tabBarButton`/`listeners` below). */
function NoopScreen(): React.JSX.Element {
  return <View />;
}

/**
 * Independent-agent and company-workspace-member navigation (see
 * docs/PRODUCT.md "Professional navigation"): Home | Properties | + |
 * Clients | More. Requirements/Matching/Shortlist/Presentations are
 * deliberately reached through the Clients tab's own workflow (Client →
 * Requirements → Matching → Shortlist → Presentation), not as separate
 * top-level tabs, since they only ever make sense in the context of one
 * client. A COMPANY member gets this exact same tab structure — only
 * the current workspace (shown on Dashboard/Account) differs.
 */
export function ProfessionalTabs(): React.JSX.Element {
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
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Properties"
        component={PropertiesStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="QuickCreate"
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
        name="Clients"
        component={ClientsStack}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
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
