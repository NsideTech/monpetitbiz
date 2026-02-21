import {useEffect, useState, useCallback} from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {fetchDashboardSummary, fetchProfile} from '../api/mobile-api';
import {DashboardSummary} from '../api/types';
import {GlassCard} from '../components/GlassCard';
import {SectionHeader} from '../components/SectionHeader';
import {MainStackParamList} from '../navigation/types';
import {useAuth} from '../auth/auth-context';
import {theme} from '../theme';

type DashboardNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'Dashboard'
>;

const QUICK_CMDS = [
  {label: 'vente pain 1500', prefill: 'vente pain 1500', icon: '💰'},
  {label: 'dépense 500', prefill: 'dépense 500', icon: '📤'},
  {label: 'stock pain 50', prefill: 'stock pain 50', icon: '📦'},
  {label: 'bilan jour', prefill: 'bilan jour', icon: '📊'},
];

export const DashboardScreen = () => {
  const navigation = useNavigation<DashboardNavigationProp>();
  const {accessToken, profile, setProfile} = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!accessToken) return;
    try {
      let currentProfile = profile;
      if (!currentProfile) {
        currentProfile = await fetchProfile(accessToken);
        setProfile(currentProfile);
      }
      const data = await fetchDashboardSummary(accessToken, currentProfile.businessId);
      setSummary(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger le tableau de bord.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, profile, setProfile]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const formatXof = (n: number) => `${Number(n).toLocaleString('fr-FR')} F`;

  const daily = summary
    ? {
        totalSales: summary.todaySales,
        totalExpenses: summary.todayExpenses,
        netProfit: summary.todayProfit,
      }
    : undefined;

  const weekly = summary
    ? {totalSales: summary.weekSales, totalExpenses: summary.weekExpenses}
    : undefined;

  const profit = daily?.netProfit ?? 0;
  const isPositive = profit >= 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Bonjour</Text>
        <Text style={styles.userName}>
          {profile?.employeeName ?? 'Utilisateur'}
        </Text>
      </View>

      {/* Today's Summary */}
      <GlassCard glow style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Aujourd'hui</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Ventes</Text>
            <Text style={[styles.metricValue, styles.metricSales]}>
              {formatXof(daily?.totalSales ?? 0)}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Dépenses</Text>
            <Text style={[styles.metricValue, styles.metricExpenses]}>
              {formatXof(daily?.totalExpenses ?? 0)}
            </Text>
          </View>
        </View>
        <View style={styles.profitRow}>
          <Text style={styles.profitLabel}>Profit net</Text>
          <Text
            style={[
              styles.profitValue,
              {color: isPositive ? theme.colors.success : theme.colors.error},
            ]}>
            {isPositive ? '+' : ''}{formatXof(profit)}
          </Text>
        </View>
      </GlassCard>

      {/* Weekly Overview */}
      <GlassCard style={styles.weeklyCard}>
        <Text style={styles.summaryTitle}>Cette semaine</Text>
        <View style={styles.weeklyRow}>
          <View style={styles.weeklyItem}>
            <Text style={styles.weeklyLabel}>Ventes</Text>
            <Text style={[styles.weeklyValue, {color: theme.colors.success}]}>
              {formatXof(weekly?.totalSales ?? 0)}
            </Text>
          </View>
          <View style={styles.weeklyItem}>
            <Text style={styles.weeklyLabel}>Dépenses</Text>
            <Text style={[styles.weeklyValue, {color: theme.colors.error}]}>
              {formatXof(weekly?.totalExpenses ?? 0)}
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* Quick Commands */}
      <SectionHeader title="Commandes rapides" subtitle="Envoyer au chatbot" />
      {[0, 2].map((startIdx) => (
        <View key={startIdx} style={styles.cmdRow}>
          {QUICK_CMDS.slice(startIdx, startIdx + 2).map((cmd) => (
            <View key={cmd.prefill} style={styles.cmdCell}>
              <GlassCard
                onPress={() => navigation.navigate('Chat', {prefill: cmd.prefill})}
                style={styles.cmdCard}>
                <Text style={styles.cmdIcon}>{cmd.icon}</Text>
                <Text style={styles.cmdText}>{cmd.label}</Text>
              </GlassCard>
            </View>
          ))}
        </View>
      ))}
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
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },

  header: {
    marginBottom: theme.spacing.lg,
  },
  greeting: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.3,
  },

  summaryCard: {
    marginBottom: theme.spacing.md,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: theme.spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.sm,
  },
  metricLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  metricSales: {
    color: theme.colors.success,
  },
  metricExpenses: {
    color: theme.colors.error,
  },
  profitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  profitLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  profitValue: {
    fontSize: 22,
    fontWeight: '800',
  },

  weeklyCard: {
    marginBottom: theme.spacing.xl,
  },
  weeklyRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  weeklyItem: {
    flex: 1,
    gap: 4,
  },
  weeklyLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weeklyValue: {
    fontSize: 18,
    fontWeight: '700',
  },

  cmdRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  cmdCell: {
    flex: 1,
    marginHorizontal: theme.spacing.xs,
  },
  cmdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  cmdIcon: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
  },
  cmdText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
    flex: 1,
  },
});
