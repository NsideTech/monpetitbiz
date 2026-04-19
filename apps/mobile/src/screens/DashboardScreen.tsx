import {useState, useCallback, useRef, useMemo} from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {fetchDashboardSummary, fetchProfile, fetchStockWarnings, fetchReceivablesSummary, fetchLoansSummary} from '../api/mobile-api';
import {DashboardSummary} from '../api/types';
import {useAuth} from '../auth/auth-context';
import {theme} from '../theme';
import {MainStackParamList} from '../navigation/types';

type DashboardNav = NativeStackNavigationProp<MainStackParamList, 'Dashboard'>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const PAGE_PADDING = theme.spacing.lg;
const GRID_GAP = 14;
const COLUMNS = 3;
const ROWS_PER_PAGE = 2;
const ITEMS_PER_PAGE = COLUMNS * ROWS_PER_PAGE;
const CARD_WIDTH = (SCREEN_WIDTH - PAGE_PADDING * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

type UserRole = 'owner' | 'manager' | 'seller';

type ModuleItem = {
  key: string;
  emoji: string;
  bgColor: string;
  label: string;
  subtitle: string;
  screen: keyof MainStackParamList;
  visibleTo: UserRole[];
};

const ALL_ROLES: UserRole[] = ['owner', 'manager', 'seller'];

const ALL_MODULES: ModuleItem[] = [
  {key: 'sales', emoji: '💰', bgColor: '#E8F5E9', label: 'Ventes', subtitle: 'Factures & devis', screen: 'Transactions', visibleTo: ALL_ROLES},
  {key: 'stock', emoji: '📦', bgColor: '#FFF3E0', label: 'Produits', subtitle: 'Catalogue & stock', screen: 'Products', visibleTo: ALL_ROLES},
  // {key: 'reports', emoji: '📊', bgColor: '#FCE4EC', label: 'Rapports', subtitle: 'Analytics & stats', screen: 'Reports', visibleTo: ['owner', 'manager']},
  {key: 'chatbot', emoji: '💬', bgColor: '#E3F2FD', label: 'Chatbot', subtitle: 'Assistant IA', screen: 'Chat', visibleTo: ALL_ROLES},
  // {key: 'employees', emoji: '👥', bgColor: '#F3E5F5', label: 'Employés', subtitle: 'Équipe & rôles', screen: 'Employees', visibleTo: ['owner']},
  // {key: 'settings', emoji: '⚙️', bgColor: '#ECEFF1', label: 'Paramètres', subtitle: 'Configuration', screen: 'More', visibleTo: ALL_ROLES},
];

function paginateModules(modules: ModuleItem[]): ModuleItem[][] {
  const pages: ModuleItem[][] = [];
  for (let i = 0; i < modules.length; i += ITEMS_PER_PAGE) {
    pages.push(modules.slice(i, i + ITEMS_PER_PAGE));
  }
  return pages;
}

type PeriodKey = 'today' | 'week' | 'month';

const PERIOD_OPTIONS: {key: PeriodKey; label: string}[] = [
  {key: 'today', label: "Aujourd'hui"},
  {key: 'week', label: 'Cette semaine'},
  {key: 'month', label: 'Ce mois'},
];

export const DashboardScreen = () => {
  const navigation = useNavigation<DashboardNav>();
  const {accessToken, profile, setProfile} = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [stockAlertCount, setStockAlertCount] = useState(0);
  const [receivablesOutstanding, setReceivablesOutstanding] = useState(0);
  const [loansOutstanding, setLoansOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePeriod, setActivePeriod] = useState<PeriodKey>('month');
  const [activeModulePage, setActiveModulePage] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const role = (profile?.role ?? 'seller') as UserRole;
  const modules = useMemo(
    () => ALL_MODULES.filter(m => m.visibleTo.includes(role)),
    [role],
  );
  const modulePages = useMemo(() => paginateModules(modules), [modules]);

  const loadDashboard = useCallback(async () => {
    if (!accessToken) return;
    try {
      let currentProfile = profile;
      if (!currentProfile) {
        currentProfile = await fetchProfile(accessToken);
        setProfile(currentProfile);
      }
      const [data, warnings, receivablesSummary, loansSummary] = await Promise.all([
        fetchDashboardSummary(accessToken, currentProfile.businessId),
        fetchStockWarnings(accessToken, currentProfile.businessId).catch(() => []),
        fetchReceivablesSummary(accessToken, currentProfile.businessId).catch(() => ({totalOutstanding: 0, count: 0, overdueCount: 0})),
        fetchLoansSummary(accessToken, currentProfile.businessId).catch(() => ({totalOutstanding: 0, count: 0, overdueCount: 0})),
      ]);
      setSummary(data);
      setStockAlertCount(warnings.length);
      setReceivablesOutstanding(receivablesSummary.totalOutstanding ?? 0);
      setLoansOutstanding(loansSummary.totalOutstanding ?? 0);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger le tableau de bord.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, profile, setProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  const formatXof = (n: number) => `${Number(n).toLocaleString('fr-FR')} F CFA`;

  const periodData = (period: PeriodKey) => {
    if (!summary) return {sales: 0, expenses: 0, profit: 0, margin: 0, salesCount: 0};
    switch (period) {
      case 'today':
        return {
          sales: summary.todaySales,
          expenses: summary.todayExpenses,
          profit: summary.todayProfit,
          margin: summary.todaySales > 0 ? Math.round((summary.todayProfit / summary.todaySales) * 100) : 0,
          salesCount: 0,
        };
      case 'week':
        return {
          sales: summary.weekSales,
          expenses: summary.weekExpenses,
          profit: summary.weekProfit,
          margin: summary.weekSales > 0 ? Math.round((summary.weekProfit / summary.weekSales) * 100) : 0,
          salesCount: 0,
        };
      case 'month':
        return {
          sales: summary.monthSales,
          expenses: summary.monthExpenses,
          profit: summary.monthProfit,
          margin: summary.monthSales > 0 ? Math.round((summary.monthProfit / summary.monthSales) * 100) : 0,
          salesCount: 0,
        };
    }
  };

  const handleModulePress = (mod: ModuleItem) => {
    if (mod.screen === 'Chat') {
      navigation.navigate('Chat', {});
    } else {
      navigation.navigate(mod.screen);
    }
  };

  const onModuleScroll = (e: {nativeEvent: {contentOffset: {x: number}}}) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - PAGE_PADDING * 2));
    setActiveModulePage(page);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const data = periodData(activePeriod);
  const firstName = profile?.employeeName?.split(' ')[0] ?? 'Utilisateur';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadDashboard();
          }}
          tintColor={theme.colors.primaryLight}
        />
      }>
      {/* Welcome Banner */}
      <View style={styles.banner}>
        {profile?.business?.name && (
          <Text style={styles.bannerBusinessName}>Entreprise: {profile.business.name}</Text>
        )}
        
        <Text style={styles.bannerTitle}>Bienvenue — {firstName}</Text>
        <Text style={styles.bannerSubtitle}>Accédez rapidement aux modules</Text>
      </View>

      {/* Module Grid Carousel */}
      <FlatList
        ref={flatListRef}
        data={modulePages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onModuleScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => `page-${i}`}
        contentContainerStyle={styles.carouselContent}
        renderItem={({item: page}) => (
          <View style={styles.modulePage}>
            {Array.from({length: ROWS_PER_PAGE}).map((_, rowIdx) => (
              <View key={rowIdx} style={styles.moduleRow}>
                {page.slice(rowIdx * COLUMNS, (rowIdx + 1) * COLUMNS).map((mod: ModuleItem) => (
                  <Pressable
                    key={mod.key}
                    onPress={() => handleModulePress(mod)}
                    style={({pressed}) => [styles.moduleCard, pressed && styles.moduleCardPressed]}>
                    <View style={[styles.moduleIconWrap, {backgroundColor: mod.bgColor}]}>
                      <Text style={styles.moduleEmoji}>{mod.emoji}</Text>
                    </View>
                    <Text style={styles.moduleLabel} numberOfLines={1}>{mod.label}</Text>
                    <Text style={styles.moduleSubtitle} numberOfLines={1}>{mod.subtitle}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        )}
      />

      {/* Page Dots */}
      {modulePages.length > 1 && (
        <View style={styles.dotsRow}>
          {modulePages.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeModulePage && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* KPI Section */}
      <Text style={styles.kpiSectionTitle}>
        Aperçu rapide de vos indicateurs clés. Faites défiler pour voir plus.
      </Text>

      {/* Period Filter Chips */}
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map(opt => (
          <Pressable
            key={opt.key}
            onPress={() => setActivePeriod(opt.key)}
            style={[styles.periodChip, activePeriod === opt.key && styles.periodChipActive]}>
            <Text
              style={[styles.periodText, activePeriod === opt.key && styles.periodTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* KPI Cards Grid */}
      <View style={styles.kpiGrid}>
        {/* Ventes */}
        <Pressable
          style={styles.kpiCard}
          onPress={() => navigation.navigate('Transactions')}>
          <Text style={styles.kpiIcon}>💰</Text>
          <Text style={styles.kpiLabel}>Ventes</Text>
          <Text style={[styles.kpiValue, {color: theme.colors.primary}]}>
            {formatXof(data.sales)}
          </Text>
          <Text style={styles.kpiMeta}>
            {activePeriod === 'today' ? "aujourd'hui" : activePeriod === 'week' ? 'cette semaine' : 'ce mois'}
          </Text>
        </Pressable>

        {/* Dépenses */}
        <Pressable
          style={styles.kpiCard}
          onPress={() => navigation.navigate('Transactions')}>
          <Text style={styles.kpiIcon}>🧾</Text>
          <Text style={styles.kpiLabel}>Dépenses</Text>
          <Text style={[styles.kpiValue, {color: theme.colors.error}]}>
            {formatXof(data.expenses)}
          </Text>
          <Text style={styles.kpiMeta}>Frais & charges</Text>
        </Pressable>

        {/* Bénéfice */}
        <Pressable
          style={styles.kpiCard}
          onPress={() => navigation.navigate('Reports')}>
          <Text style={styles.kpiIcon}>📈</Text>
          <Text style={styles.kpiLabel}>Bénéfice</Text>
          <Text
            style={[
              styles.kpiValue,
              {color: data.profit >= 0 ? theme.colors.primary : theme.colors.error},
            ]}>
            {formatXof(data.profit)}
          </Text>
          <Text style={styles.kpiMeta}>Marge: {data.margin}%</Text>
        </Pressable>

        {/* Créances (à recevoir) */}
        <Pressable
          style={styles.kpiCard}
          onPress={() => navigation.navigate('Receivables')}>
          <Text style={styles.kpiIcon}>📥</Text>
          <Text style={styles.kpiLabel}>Créances</Text>
          <Text
            style={[styles.kpiValue, {color: theme.colors.primary}]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}>
            {formatXof(receivablesOutstanding)}
          </Text>
          <Text style={styles.kpiMeta}>À recevoir</Text>
        </Pressable>

        {/* Dettes (à payer) */}
        <Pressable
          style={styles.kpiCard}
          onPress={() => navigation.navigate('Loans')}>
          <Text style={styles.kpiIcon}>📤</Text>
          <Text style={styles.kpiLabel}>Dettes</Text>
          <Text
            style={[styles.kpiValue, {color: theme.colors.error}]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}>
            {formatXof(loansOutstanding)}
          </Text>
          <Text style={styles.kpiMeta}>À payer</Text>
        </Pressable>

        {/* Caisse */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiIcon}>💵</Text>
          <Text style={styles.kpiLabel}>Caisse</Text>
          <Text style={[styles.kpiValue, {color: theme.colors.primary}]}>
            {formatXof(data.sales - data.expenses)}
          </Text>
          <Text style={styles.kpiMeta}>Solde courant</Text>
        </View>

        {/* Alertes Stock */}
        <Pressable
          style={styles.kpiCard}
          onPress={() => navigation.navigate('Products')}>
          <Text style={styles.kpiIcon}>📦</Text>
          <Text style={styles.kpiLabel}>Alertes Stock</Text>
          <Text style={[styles.kpiValue, {color: stockAlertCount > 0 ? theme.colors.warning : theme.colors.primary}]}>
            {stockAlertCount}
          </Text>
          <Text style={styles.kpiMeta}>Produits en alerte</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
  },
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    paddingBottom: theme.spacing.xxl,
  },

  // Banner
  banner: {
    marginHorizontal: PAGE_PADDING,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 22,
  },
  bannerBusinessName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },

  // Module Carousel
  carouselContent: {},
  modulePage: {
    width: SCREEN_WIDTH - PAGE_PADDING * 2,
    marginHorizontal: PAGE_PADDING,
    gap: GRID_GAP,
  },
  moduleRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  moduleCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radii.lg,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  moduleCardPressed: {
    opacity: 0.8,
    transform: [{scale: 0.96}],
  },
  moduleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  moduleEmoji: {
    fontSize: 24,
  },
  moduleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  moduleSubtitle: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },

  // KPI Section
  kpiSectionTitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginHorizontal: PAGE_PADDING,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },

  // Period Filter
  periodRow: {
    flexDirection: 'row',
    marginHorizontal: PAGE_PADDING,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  periodChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.10)',
    backgroundColor: '#FFFFFF',
  },
  periodChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  periodTextActive: {
    color: '#FFFFFF',
  },

  // KPI Cards
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: PAGE_PADDING,
    gap: 12,
  },
  kpiCard: {
    width: (SCREEN_WIDTH - PAGE_PADDING * 2 - 12) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  kpiIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  kpiMeta: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
});
