import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MarketplaceHomeScreen } from '../../screens/marketplace/MarketplaceHomeScreen';
import { MarketplaceDetailScreen } from '../../screens/marketplace/MarketplaceDetailScreen';
import type { MarketplaceDetailParamList } from './marketplaceDetailParams';

export type HomeStackParamList = MarketplaceDetailParamList & {
  MarketplaceHome: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

/** The client Home tab — its own stack so Home/Search/Favorites can each be independent bottom tabs (see docs/PRODUCT.md "Client navigation"). */
export function HomeStack(): React.JSX.Element {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MarketplaceHome"
        component={MarketplaceHomeScreen}
        options={{ title: 'Home' }}
      />
      <Stack.Screen
        name="MarketplaceDetail"
        component={MarketplaceDetailScreen}
        options={{ title: 'Listing' }}
      />
    </Stack.Navigator>
  );
}
