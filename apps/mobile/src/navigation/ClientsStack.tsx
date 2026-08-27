import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ClientsListScreen } from '../screens/clients/ClientsListScreen';
import { AddClientScreen } from '../screens/clients/AddClientScreen';
import { ClientDetailScreen } from '../screens/clients/ClientDetailScreen';
import { AddRequirementScreen } from '../screens/clients/AddRequirementScreen';
import { MatchResultsScreen } from '../screens/clients/MatchResultsScreen';
import { ShortlistScreen } from '../screens/clients/ShortlistScreen';
import { CreatePresentationScreen } from '../screens/clients/CreatePresentationScreen';
import { PresentationDetailScreen } from '../screens/clients/PresentationDetailScreen';

export type ClientsStackParamList = {
  ClientsList: undefined;
  AddClient: undefined;
  ClientDetail: { clientId: string };
  AddRequirement: { clientId: string };
  MatchResults: { clientId: string; requirementId: string; requirementTitle: string };
  Shortlist: { clientId: string };
  CreatePresentation: { clientId: string; propertyIds: string[] };
  PresentationDetail: { presentationId: string };
};

const Stack = createNativeStackNavigator<ClientsStackParamList>();

export function ClientsStack(): React.JSX.Element {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ClientsList"
        component={ClientsListScreen}
        options={{ title: 'Clients' }}
      />
      <Stack.Screen
        name="AddClient"
        component={AddClientScreen}
        options={{ title: 'Add Client' }}
      />
      <Stack.Screen
        name="ClientDetail"
        component={ClientDetailScreen}
        options={{ title: 'Client' }}
      />
      <Stack.Screen
        name="AddRequirement"
        component={AddRequirementScreen}
        options={{ title: 'Add Requirement' }}
      />
      <Stack.Screen
        name="MatchResults"
        component={MatchResultsScreen}
        options={{ title: 'Matches' }}
      />
      <Stack.Screen name="Shortlist" component={ShortlistScreen} options={{ title: 'Shortlist' }} />
      <Stack.Screen
        name="CreatePresentation"
        component={CreatePresentationScreen}
        options={{ title: 'New Presentation' }}
      />
      <Stack.Screen
        name="PresentationDetail"
        component={PresentationDetailScreen}
        options={{ title: 'Presentation' }}
      />
    </Stack.Navigator>
  );
}
