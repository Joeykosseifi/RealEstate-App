import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PropertiesListScreen } from '../screens/properties/PropertiesListScreen';
import { AddPropertyScreen } from '../screens/properties/AddPropertyScreen';
import { PropertyDetailScreen } from '../screens/properties/PropertyDetailScreen';

export type PropertiesStackParamList = {
  PropertiesList: undefined;
  AddProperty: undefined;
  PropertyDetail: { propertyId: string };
};

const Stack = createNativeStackNavigator<PropertiesStackParamList>();

export function PropertiesStack(): React.JSX.Element {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="PropertiesList"
        component={PropertiesListScreen}
        options={{ title: 'Properties' }}
      />
      <Stack.Screen
        name="AddProperty"
        component={AddPropertyScreen}
        options={{ title: 'Add Property' }}
      />
      <Stack.Screen
        name="PropertyDetail"
        component={PropertyDetailScreen}
        options={{ title: 'Property' }}
      />
    </Stack.Navigator>
  );
}
