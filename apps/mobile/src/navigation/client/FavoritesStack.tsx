import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FavoritesScreen } from '../../screens/marketplace/FavoritesScreen';
import { MarketplaceDetailScreen } from '../../screens/marketplace/MarketplaceDetailScreen';
import type { MarketplaceDetailParamList } from './marketplaceDetailParams';

export type FavoritesStackParamList = MarketplaceDetailParamList & {
  FavoritesList: undefined;
};

const Stack = createNativeStackNavigator<FavoritesStackParamList>();

export function FavoritesStack(): React.JSX.Element {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="FavoritesList"
        component={FavoritesScreen}
        options={{ title: 'Favorites' }}
      />
      <Stack.Screen
        name="MarketplaceDetail"
        component={MarketplaceDetailScreen}
        options={{ title: 'Listing' }}
      />
    </Stack.Navigator>
  );
}
