import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MarketplaceHomeScreen } from '../screens/marketplace/MarketplaceHomeScreen';
import { MarketplaceSearchScreen } from '../screens/marketplace/MarketplaceSearchScreen';
import { MarketplaceDetailScreen } from '../screens/marketplace/MarketplaceDetailScreen';
import { FavoritesScreen } from '../screens/marketplace/FavoritesScreen';

export type MarketplaceStackParamList = {
  MarketplaceHome: undefined;
  MarketplaceSearch: { listingPurpose?: 'SALE' | 'RENT' } | undefined;
  MarketplaceDetail: { publicationId: string };
  Favorites: undefined;
};

const Stack = createNativeStackNavigator<MarketplaceStackParamList>();

export function MarketplaceStack(): React.JSX.Element {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MarketplaceHome"
        component={MarketplaceHomeScreen}
        options={{ title: 'Home' }}
      />
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
      <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Favorites' }} />
    </Stack.Navigator>
  );
}
