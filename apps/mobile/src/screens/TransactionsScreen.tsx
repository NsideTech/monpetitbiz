import {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useAuth} from '../auth/auth-context';
import {createTransaction, fetchTransactions} from '../api/mobile-api';
import {Transaction} from '../api/types';
import {PrimaryButton} from '../components/PrimaryButton';
import {theme} from '../theme';

type TabType = 'all' | 'sale' | 'expense';

const TABS: {key: TabType; label: string}[] = [
  {key: 'all', label: 'Tous'},
  {key: 'sale', label: 'Ventes'},
  {key: 'expense', label: 'Dépenses'},
];

export const TransactionsScreen = () => {
  const {accessToken, profile} = useAuth();
  const [tab, setTab] = useState<TabType>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addType, setAddType] = useState<'sale' | 'expense'>('sale');
  const [amount, setAmount] = useState('');
  const [product, setProduct] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTransactions = useCallback(async () => {
    if (!accessToken || !profile?.businessId) return;
    try {
      const type =
        tab === 'sale' ? 'sale' : tab === 'expense' ? 'expense' : undefined;
      const data = await fetchTransactions(accessToken, profile.businessId, {
        type,
        limit: 50,
      });
      setTransactions(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les transactions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, profile?.businessId, tab]);

  useEffect(() => {
    setLoading(true);
    void loadTransactions();
  }, [loadTransactions]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadTransactions();
  };

  const handleAdd = async () => {
    const amt = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Erreur', 'Montant invalide.');
      return;
    }
    if (!accessToken || !profile?.businessId) return;
    setSubmitting(true);
    try {
      await createTransaction(accessToken, profile.businessId, {
        type: addType,
        amount: amt,
        product: product.trim() || undefined,
        description: description.trim() || undefined,
      });
      setAddModalVisible(false);
      setAmount('');
      setProduct('');
      setDescription('');
      void loadTransactions();
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer la transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  const openAddModal = (type: 'sale' | 'expense') => {
    setAddType(type);
    setAmount('');
    setProduct('');
    setDescription('');
    setAddModalVisible(true);
  };

  const formatXof = (n: number) => `${Number(n).toLocaleString('fr-FR')} F`;

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const renderItem = ({item}: {item: Transaction}) => {
    const isSale = item.type === 'sale';
    return (
      <View style={styles.card}>
        <View style={[styles.cardIndicator, isSale ? styles.indicatorSale : styles.indicatorExpense]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={[styles.typeBadge, isSale ? styles.badgeSale : styles.badgeExpense]}>
              <Text style={[styles.typeText, isSale ? styles.typeTextSale : styles.typeTextExpense]}>
                {isSale ? 'Vente' : 'Dépense'}
              </Text>
            </View>
            <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.cardAmount}>
            {isSale ? '+' : '-'}{formatXof(item.amount)}
          </Text>
          {item.product ? (
            <Text style={styles.cardProduct}>{item.product}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  if (loading && transactions.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primaryLight} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}>
            <Text
              style={[
                styles.tabLabel,
                tab === t.key && styles.tabLabelActive,
              ]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{'📋'}</Text>
            <Text style={styles.emptyText}>Aucune transaction</Text>
            <Text style={styles.emptyHint}>
              Appuyez sur les boutons ci-dessous pour en ajouter
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primaryLight}
          />
        }
      />

      {/* FABs */}
      <View style={styles.fabRow}>
        <TouchableOpacity
          style={[styles.fab, styles.fabSale]}
          onPress={() => openAddModal('sale')}
          activeOpacity={0.8}>
          <Text style={styles.fabIcon}>{'+'}</Text>
          <Text style={styles.fabLabel}>Vente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, styles.fabExpense]}
          onPress={() => openAddModal('expense')}
          activeOpacity={0.8}>
          <Text style={styles.fabIcon}>{'+'}</Text>
          <Text style={styles.fabLabel}>Dépense</Text>
        </TouchableOpacity>
      </View>

      {/* Add Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setAddModalVisible(false)}>
            <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>
                  {addType === 'sale' ? 'Nouvelle vente' : 'Nouvelle dépense'}
                </Text>

                <Text style={styles.label}>Montant (F CFA) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ex: 1 500"
                  placeholderTextColor={theme.colors.textMuted}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />

                {addType === 'sale' && (
                  <>
                    <Text style={styles.label}>Produit (optionnel)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="ex: Pain"
                      placeholderTextColor={theme.colors.textMuted}
                      value={product}
                      onChangeText={setProduct}
                    />
                  </>
                )}

                <Text style={styles.label}>Description (optionnel)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ex: Vente du matin"
                  placeholderTextColor={theme.colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                />

                <View style={styles.modalActions}>
                  <PrimaryButton
                    label="Annuler"
                    onPress={() => setAddModalVisible(false)}
                    variant="ghost"
                  />
                  <PrimaryButton
                    label={submitting ? 'Enregistrement...' : 'Enregistrer'}
                    onPress={handleAdd}
                    disabled={submitting}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },

  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.chipBg,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
  },
  tabActive: {
    backgroundColor: theme.colors.chipBgActive,
    borderColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  tabLabelActive: {
    color: theme.colors.primaryLight,
    fontWeight: '700',
  },

  list: {
    padding: theme.spacing.md,
    paddingBottom: 120,
  },

  emptyContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  emptyHint: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },

  card: {
    flexDirection: 'row',
    ...theme.glass,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  cardIndicator: {
    width: 4,
  },
  indicatorSale: {
    backgroundColor: theme.colors.success,
  },
  indicatorExpense: {
    backgroundColor: theme.colors.error,
  },
  cardBody: {
    flex: 1,
    padding: theme.spacing.md,
    gap: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: theme.radii.full,
  },
  badgeSale: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  badgeExpense: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeTextSale: {
    color: theme.colors.success,
  },
  typeTextExpense: {
    color: theme.colors.error,
  },
  cardAmount: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.colors.text,
  },
  cardProduct: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  cardDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },

  fabRow: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: theme.radii.full,
    ...theme.shadows.md,
  },
  fabSale: {
    backgroundColor: theme.colors.success,
  },
  fabExpense: {
    backgroundColor: theme.colors.error,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  fabLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: theme.colors.bgCard,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: theme.spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.md,
    padding: 14,
    marginBottom: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
});
