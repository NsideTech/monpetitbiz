import {useCallback, useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useAuth} from '../auth/auth-context';
import {theme} from '../theme';
import {MainStackParamList} from '../navigation/types';
import {useDrawer} from './DrawerContext';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const DRAWER_WIDTH = 280;

type UserRole = 'owner' | 'manager' | 'seller';

type MenuItem = {
  key: keyof MainStackParamList;
  emoji: string;
  label: string;
  visibleTo: UserRole[];
};

const ALL_ROLES: UserRole[] = ['owner', 'manager', 'seller'];

const ALL_MENU_ITEMS: MenuItem[] = [
  {key: 'Dashboard', emoji: '🏠', label: 'Tableau de bord', visibleTo: ALL_ROLES},
  {key: 'Transactions', emoji: '💰', label: 'Ventes & Dépenses', visibleTo: ALL_ROLES},
  {key: 'Receivables', emoji: '📥', label: 'Créances', visibleTo: ALL_ROLES},
  {key: 'Loans', emoji: '📤', label: 'Dettes', visibleTo: ALL_ROLES},
  {key: 'Products', emoji: '📦', label: 'Produits & Stock', visibleTo: ALL_ROLES},
  {key: 'Reports', emoji: '📊', label: 'Rapports', visibleTo: ['owner', 'manager']},
  {key: 'Chat', emoji: '💬', label: 'Chatbot', visibleTo: ALL_ROLES},
  {key: 'Employees', emoji: '👥', label: 'Employés', visibleTo: ['owner']},
  {key: 'More', emoji: '⚙️', label: 'Paramètres', visibleTo: ALL_ROLES},
];

export const AppDrawer = () => {
  const {isOpen, close} = useDrawer();
  const insets = useSafeAreaInsets();
  const {profile, logout} = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -DRAWER_WIDTH,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, slideAnim, overlayAnim]);

  const navigateTo = useCallback(
    (screen: keyof MainStackParamList) => {
      close();
      const state = navigation.getState();
      const currentRoute = state?.routes[state.index ?? 0]?.name;
      if (currentRoute === screen) return;

      if (screen === 'Dashboard') {
        navigation.popToTop();
      } else if (screen === 'Chat') {
        navigation.navigate('Chat', {});
      } else {
        navigation.navigate(screen);
      }
    },
    [close, navigation],
  );

  const handleLogout = useCallback(() => {
    close();
    void logout();
  }, [close, logout]);

  const role = (profile?.role ?? 'seller') as UserRole;
  const menuItems = useMemo(
    () => ALL_MENU_ITEMS.filter(item => item.visibleTo.includes(role)),
    [role],
  );

  if (!isOpen) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Overlay */}
      <Animated.View
        style={[styles.overlay, {opacity: overlayAnim}]}
        pointerEvents={isOpen ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Drawer Panel */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            transform: [{translateX: slideAnim}],
          },
        ]}>
        {/* Profile */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.employeeName ?? 'U')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName} numberOfLines={1}>
            {profile?.employeeName ?? 'Utilisateur'}
          </Text>
          <Text style={styles.profileRole} numberOfLines={1}>
            {profile?.role === 'owner'
              ? 'Propriétaire'
              : profile?.role === 'manager'
                ? 'Manager'
                : 'Vendeur'}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Menu */}
        <View style={styles.menuSection}>
          {menuItems.map(item => (
            <Pressable
              key={item.key}
              onPress={() => navigateTo(item.key)}
              style={({pressed}) => [styles.menuItem, pressed && styles.menuItemPressed]}>
              <Text style={styles.menuEmoji}>{item.emoji}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.divider} />
        <Pressable
          onPress={handleLogout}
          style={({pressed}) => [styles.menuItem, pressed && styles.menuItemPressed]}>
          <Text style={styles.menuEmoji}>🚪</Text>
          <Text style={[styles.menuLabel, {color: theme.colors.error}]}>
            Déconnexion
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    ...theme.shadows.md,
  },
  profileSection: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  menuSection: {
    flex: 1,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginHorizontal: 8,
    borderRadius: theme.radii.md,
    gap: 14,
  },
  menuItemPressed: {
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
  },
  menuEmoji: {
    fontSize: 22,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
});
