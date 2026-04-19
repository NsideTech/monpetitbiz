import {Pressable, StyleSheet, View} from 'react-native';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {AuthScreen} from '../screens/AuthScreen';
import {OtpScreen} from '../screens/OtpScreen';
import {RegisterBusinessScreen} from '../screens/RegisterBusinessScreen';
import {JoinBusinessScreen} from '../screens/JoinBusinessScreen';
import {DashboardScreen} from '../screens/DashboardScreen';
import {ChatScreen} from '../screens/ChatScreen';
import {ProductsScreen} from '../screens/ProductsScreen';
import {ReportsScreen} from '../screens/ReportsScreen';
import {TransactionsScreen} from '../screens/TransactionsScreen';
import {ReceivablesScreen} from '../screens/ReceivablesScreen';
import {LoansScreen} from '../screens/LoansScreen';
import {MoreScreen} from '../screens/MoreScreen';
import {EmployeesScreen} from '../screens/EmployeesScreen';
import {AuthStackParamList, MainStackParamList} from './types';
import {useAuth} from '../auth/auth-context';
import {theme} from '../theme';
import {DrawerProvider, useDrawer} from '../components/DrawerContext';
import {AppDrawer} from '../components/AppDrawer';

const AppTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.bg,
    card: theme.colors.bgCard,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.accent,
  },
};

const headerOptions = {
  headerStyle: {
    backgroundColor: theme.colors.bgCard,
  },
  headerTintColor: theme.colors.text,
  headerTitleStyle: {
    fontWeight: '700' as const,
    fontSize: 17,
    letterSpacing: 0.3,
  },
  headerShadowVisible: false,
  contentStyle: {
    backgroundColor: theme.colors.bg,
  },
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

const MenuButton = () => {
  const {toggle} = useDrawer();
  return (
    <Pressable onPress={toggle} style={menuStyles.button} hitSlop={8}>
      <View style={menuStyles.line} />
      <View style={[menuStyles.line, menuStyles.lineShort]} />
      <View style={menuStyles.line} />
    </Pressable>
  );
};

const menuStyles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    gap: 5,
    marginLeft: 4,
  },
  line: {
    width: 22,
    height: 2.5,
    backgroundColor: theme.colors.text,
    borderRadius: 2,
  },
  lineShort: {
    width: 16,
  },
});

const MainNavigator = () => (
  <Stack.Navigator screenOptions={headerOptions}>
    <Stack.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{
        title: 'Tableau de bord',
        headerLeft: () => <MenuButton />,
      }}
    />
    <Stack.Screen
      name="Transactions"
      component={TransactionsScreen}
      options={{title: 'Ventes et Dépenses'}}
    />
    <Stack.Screen
      name="Receivables"
      component={ReceivablesScreen}
      options={{title: 'Créances'}}
    />
    <Stack.Screen
      name="Loans"
      component={LoansScreen}
      options={{title: 'Dettes'}}
    />
    <Stack.Screen
      name="Products"
      component={ProductsScreen}
      options={{title: 'Produits & Stock'}}
    />
    <Stack.Screen
      name="Reports"
      component={ReportsScreen}
      options={{title: 'Rapports'}}
    />
    <Stack.Screen
      name="Chat"
      component={ChatScreen}
      options={{title: 'Chatbot'}}
    />
    <Stack.Screen
      name="More"
      component={MoreScreen}
      options={{title: 'Paramètres'}}
    />
    <Stack.Screen
      name="Employees"
      component={EmployeesScreen}
      options={{title: 'Mes employés'}}
    />
  </Stack.Navigator>
);

const AuthenticatedApp = () => (
  <DrawerProvider>
    <View style={styles.flex}>
      <MainNavigator />
      <AppDrawer />
    </View>
  </DrawerProvider>
);

export const AppNavigator = () => {
  const {accessToken} = useAuth();

  return (
    <NavigationContainer theme={AppTheme}>
      {accessToken ? (
        <AuthenticatedApp />
      ) : (
        <AuthStack.Navigator screenOptions={headerOptions}>
          <AuthStack.Screen
            name="Auth"
            component={AuthScreen}
            options={{headerShown: false}}
          />
          <AuthStack.Screen
            name="Otp"
            component={OtpScreen}
            options={{title: 'Vérification'}}
          />
          <AuthStack.Screen
            name="RegisterBusiness"
            component={RegisterBusinessScreen}
            options={{title: 'Nouvelle entreprise'}}
          />
          <AuthStack.Screen
            name="JoinBusiness"
            component={JoinBusinessScreen}
            options={{title: 'Rejoindre une entreprise'}}
          />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
