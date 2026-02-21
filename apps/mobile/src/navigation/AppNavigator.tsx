import {Platform, StyleSheet, Text, View} from 'react-native';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AuthScreen} from '../screens/AuthScreen';
import {OtpScreen} from '../screens/OtpScreen';
import {RegisterBusinessScreen} from '../screens/RegisterBusinessScreen';
import {DashboardScreen} from '../screens/DashboardScreen';
import {ChatScreen} from '../screens/ChatScreen';
import {ProductsScreen} from '../screens/ProductsScreen';
import {ReportsScreen} from '../screens/ReportsScreen';
import {TransactionsScreen} from '../screens/TransactionsScreen';
import {MoreScreen} from '../screens/MoreScreen';
import {AuthStackParamList, MainStackParamList, RootTabParamList} from './types';
import {useAuth} from '../auth/auth-context';
import {theme} from '../theme';

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
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICON_SIZE = 26;

const TabIcon = ({emoji, focused}: {emoji: string; focused: boolean}) => (
  <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
    <Text style={[tabStyles.icon, focused && tabStyles.iconActive]}>{emoji}</Text>
  </View>
);

const HomeStack = () => (
  <MainStack.Navigator screenOptions={headerOptions}>
    <MainStack.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{title: 'MonPetitBiz'}}
    />
    <MainStack.Screen
      name="Chat"
      component={ChatScreen}
      options={{title: 'Chatbot'}}
    />
  </MainStack.Navigator>
);

const ChatTabStack = createNativeStackNavigator();

const ChatTabScreen = () => (
  <ChatTabStack.Navigator screenOptions={headerOptions}>
    <ChatTabStack.Screen
      name="ChatMain"
      component={ChatScreen}
      options={{title: 'Chatbot'}}
    />
  </ChatTabStack.Navigator>
);

const TAB_BAR_CONTENT_HEIGHT = 60;

export const AppNavigator = () => {
  const {accessToken} = useAuth();
  const insets = useSafeAreaInsets();

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);

  return (
    <NavigationContainer theme={AppTheme}>
      {accessToken ? (
        <Tab.Navigator
          screenOptions={{
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.textMuted,
            tabBarStyle: {
              backgroundColor: '#FFFFFF',
              borderTopWidth: 0,
              paddingTop: 8,
              paddingBottom: bottomPadding,
              height: TAB_BAR_CONTENT_HEIGHT + bottomPadding,
              ...theme.shadows.md,
              shadowOffset: {width: 0, height: -2},
            },
            tabBarItemStyle: {
              paddingVertical: 4,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 0.3,
              marginTop: 4,
            },
            headerShown: false,
          }}>
          <Tab.Screen
            name="HomeTab"
            component={HomeStack}
            options={{
              tabBarLabel: 'Accueil',
              tabBarIcon: ({focused}) => <TabIcon emoji="🏠" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="TransactionsTab"
            component={TransactionsScreen}
            options={{
              tabBarLabel: 'Ventes',
              headerShown: true,
              title: 'Ventes et Dépenses',
              ...headerOptions,
              tabBarIcon: ({focused}) => <TabIcon emoji="💰" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="StockTab"
            component={ProductsScreen}
            options={{
              tabBarLabel: 'Stock',
              headerShown: true,
              title: 'Stock',
              ...headerOptions,
              tabBarIcon: ({focused}) => <TabIcon emoji="📦" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="ReportsTab"
            component={ReportsScreen}
            options={{
              tabBarLabel: 'Rapports',
              headerShown: true,
              title: 'Rapports',
              ...headerOptions,
              tabBarIcon: ({focused}) => <TabIcon emoji="📊" focused={focused} />,
            }}
          />
           <Tab.Screen
            name="ChatTab"
            component={ChatTabScreen}
            options={{
              tabBarLabel: 'Chatbot',
              headerShown: false,
              tabBarIcon: ({focused}) => <TabIcon emoji="💬" focused={focused} />,
            }}
          />
          <Tab.Screen
            name="MoreTab"
            component={MoreScreen}
            options={{
              tabBarLabel: 'Plus',
              headerShown: true,
              title: 'Plus',
              ...headerOptions,
              tabBarIcon: ({focused}) => <TabIcon emoji="⚙️" focused={focused} />,
            }}
          />
        </Tab.Navigator>
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
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
};

const tabStyles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: theme.colors.chipBgActive,
  },
  icon: {
    fontSize: TAB_ICON_SIZE,
    opacity: 0.45,
  },
  iconActive: {
    opacity: 1,
  },
});
