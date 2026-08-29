import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PropertiesListScreen } from '../screens/properties/PropertiesListScreen';
import { AddPropertyScreen } from '../screens/properties/AddPropertyScreen';
import { EditPropertyScreen } from '../screens/properties/EditPropertyScreen';
import { PropertyDetailScreen } from '../screens/properties/PropertyDetailScreen';
import { PublishPropertyScreen } from '../screens/properties/PublishPropertyScreen';

export type PropertiesStackParamList = {
  PropertiesList: undefined;
  AddProperty: undefined;
  EditProperty: { propertyId: string };
  PropertyDetail: { propertyId: string };
  PublishProperty: { propertyId: string };
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
        name="EditProperty"
        component={EditPropertyScreen}
        options={{ title: 'Edit Property' }}
      />
      <Stack.Screen
        name="PropertyDetail"
        component={PropertyDetailScreen}
        options={{ title: 'Property' }}
      />
      <Stack.Screen
        name="PublishProperty"
        component={PublishPropertyScreen}
        options={{ title: 'Prepare Listing' }}
      />
    </Stack.Navigator>
  );
}
