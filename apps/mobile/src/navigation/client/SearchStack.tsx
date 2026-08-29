import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MarketplaceSearchScreen } from '../../screens/marketplace/MarketplaceSearchScreen';
import { MarketplaceDetailScreen } from '../../screens/marketplace/MarketplaceDetailScreen';
import type { MarketplaceDetailParamList } from './marketplaceDetailParams';

export type SearchStackParamList = MarketplaceDetailParamList & {
  MarketplaceSearch: { listingPurpose?: 'SALE' | 'RENT' } | undefined;
};

const Stack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStack(): React.JSX.Element {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MarketplaceSearch"
        component={MarketplaceSearchScreen}
        options={{ title: 'Search' }}
      />
      <Stack.Screen
        name="MarketplaceDetail"
        component={MarketplaceDetailScreen}
        options={{ title: 'Listing' }}
      />
    </Stack.Navigator>
  );
}
