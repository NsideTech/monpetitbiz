import {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useAuth} from '../auth/auth-context';
import {fetchReport} from '../api/mobile-api';
import {BalanceReport} from '../api/types';
import {GlassCard} from '../components/GlassCard';
import {SectionHeader} from '../components/SectionHeader';
import {theme} from '../theme';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

const PERIODS: {key: Period; label: string}[] = [
  {key: 'daily', label: 'Jour'},
  {key: 'weekly', label: 'Sem.'},
  {key: 'monthly', label: 'Mois'},
  {key: 'yearly', label: 'Année'},
];

export const ReportsScreen = () => {
  const {accessToken, profile} = useAuth();
  const [period, setPeriod] = useState<Period>('daily');
  const [report, setReport] = useState<BalanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    if (!accessToken || !profile?.businessId) return;
    setLoading(true);
    try {
      const data = await fetchReport(accessToken, profile.businessId, period);
      setReport(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger le bilan.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, profile?.businessId, period]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const formatXof = (n: number) =>
    `${Number(n).toLocaleString('fr-FR')} F`;

  if (loading && !report) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primaryLight} />
      </View>
    );
  }

  const isPositive = (report?.netProfit ?? 0) >= 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={loadReport}
          tintColor={theme.colors.primaryLight}
        />
      }>
      {/* Period tabs */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[
              styles.periodBtn,
              period === p.key && styles.periodBtnActive,
            ]}
            onPress={() => setPeriod(p.key)}>
            <Text
              style={[
                styles.periodLabel,
                period === p.key && styles.periodLabelActive,
              ]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator
          size="small"
          color={theme.colors.primaryLight}
          style={{marginTop: theme.spacing.xl}}
        />
      ) : report ? (
        <>
          {/* Period title */}
          <Text style={styles.periodTitle}>{report.period}</Text>

          {/* KPI cards row */}
          <View style={styles.kpiRow}>
            <GlassCard style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Ventes</Text>
              <Text style={[styles.kpiValue, {color: theme.colors.success}]}>
                {formatXof(report.totalSales)}
              </Text>
              <Text style={styles.kpiCount}>{report.salesCount} op.</Text>
            </GlassCard>
            <GlassCard style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Dépenses</Text>
              <Text style={[styles.kpiValue, {color: theme.colors.error}]}>
                {formatXof(report.totalExpenses)}
              </Text>
              <Text style={styles.kpiCount}>{report.expenseCount} op.</Text>
            </GlassCard>
          </View>

          {/* Profit highlight */}
          <GlassCard glow={isPositive} style={styles.profitCard}>
            <View style={styles.profitRow}>
              <View>
                <Text style={styles.profitLabel}>Bénéfice net</Text>
                <Text style={styles.profitTxCount}>
                  {report.transactionCount} transactions au total
                </Text>
              </View>
              <Text
                style={[
                  styles.profitValue,
                  {color: isPositive ? theme.colors.success : theme.colors.error},
                ]}>
                {isPositive ? '+' : ''}{formatXof(report.netProfit)}
              </Text>
            </View>
          </GlassCard>

          {/* Top products */}
          {report.topProducts && report.topProducts.length > 0 && (
            <View style={styles.topSection}>
              <SectionHeader title="Top produits" />
              {report.topProducts.map((p, i) => (
                <GlassCard key={p.product} style={styles.topItemCard}>
                  <View style={styles.topItem}>
                    <View style={styles.topRankBadge}>
                      <Text style={styles.topRankText}>{i + 1}</Text>
                    </View>
                    <View style={styles.topInfo}>
                      <Text style={styles.topName}>{p.product}</Text>
                      <Text style={styles.topQty}>{p.quantity} vendus</Text>
                    </View>
                    <Text style={styles.topRevenue}>{formatXof(p.revenue)}</Text>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}
        </>
      ) : null}
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

  periodRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.chipBg,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: theme.colors.chipBgActive,
    borderColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  periodLabelActive: {
    color: theme.colors.primaryLight,
    fontWeight: '700',
  },

  periodTitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: theme.spacing.md,
  },

  kpiRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  kpiCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: theme.spacing.lg,
  },
  kpiLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  kpiCount: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },

  profitCard: {
    marginBottom: theme.spacing.xl,
  },
  profitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profitLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  profitTxCount: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  profitValue: {
    fontSize: 22,
    fontWeight: '800',
  },

  topSection: {
    gap: theme.spacing.sm,
  },
  topItemCard: {
    padding: theme.spacing.md,
  },
  topItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  topRankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.chipBg,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRankText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primaryLight,
  },
  topInfo: {
    flex: 1,
  },
  topName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  topQty: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  topRevenue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.accent,
  },
});
