import {useCallback, useState} from 'react';
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
  View,
} from 'react-native';
import {useAuth} from '../auth/auth-context';
import {
  fetchReceivables,
  fetchReceivable,
  createReceivable,
  recordReceivablePayment,
  recordFullReceivablePayment,
} from '../api/mobile-api';
import {Receivable, ReceivableStatus} from '../api/types';
import {PrimaryButton} from '../components/PrimaryButton';
import {theme} from '../theme';
import {useFocusEffect} from '@react-navigation/native';

type FilterKey = 'all' | 'open' | 'overdue';

const FILTERS: {key: FilterKey; label: string}[] = [
  {key: 'all', label: 'Toutes'},
  {key: 'open', label: 'Ouvertes'},
  {key: 'overdue', label: 'En retard'},
];

const formatXof = (n: number) => `${Number(n).toLocaleString('fr-FR')} F CFA`;

const getStatusLabel = (s: ReceivableStatus): string => {
  switch (s) {
    case 'open':
      return 'Ouverte';
    case 'partial':
      return 'Partiel';
    case 'paid':
      return 'Soldée';
    case 'overdue':
      return 'En retard';
    default:
      return s;
  }
};

const getStatusColor = (s: ReceivableStatus): string => {
  switch (s) {
    case 'overdue':
      return theme.colors.error;
    case 'partial':
      return theme.colors.warning;
    case 'paid':
      return theme.colors.success;
    default:
      return theme.colors.primary;
  }
};

export const ReceivablesScreen = () => {
  const {accessToken, profile} = useAuth();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [detailReceivable, setDetailReceivable] = useState<Receivable | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [debtorName, setDebtorName] = useState('');
  const [debtorPhone, setDebtorPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const loadReceivables = useCallback(async () => {
    if (!accessToken || !profile?.businessId) return;
    try {
      const statusFilter =
        filter === 'open' ? 'open' : filter === 'overdue' ? 'overdue' : undefined;
      const data = await fetchReceivables(accessToken, profile.businessId, {
        status: statusFilter,
        limit: 100,
      });
      setReceivables(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les créances.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, profile?.businessId, filter]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadReceivables();
    }, [loadReceivables]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    void loadReceivables();
  };

  const resetAddForm = () => {
    setDebtorName('');
    setDebtorPhone('');
    setAmount('');
    setDescription('');
    setDueDate('');
  };

  const handleAdd = async () => {
    if (!accessToken || !profile?.businessId) return;
    const name = debtorName.trim();
    if (!name) {
      Alert.alert('Erreur', 'Le nom du débiteur est requis.');
      return;
    }
    const amt = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Erreur', 'Le montant doit être positif.');
      return;
    }
    setSubmitting(true);
    try {
      await createReceivable(accessToken, profile.businessId, {
        debtorName: name,
        debtorPhone: debtorPhone.trim() || undefined,
        amount: amt,
        description: description.trim() || undefined,
        dueDate: dueDate.trim() ? dueDate : undefined,
      });
      setAddModalVisible(false);
      resetAddForm();
      void loadReceivables();
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer la créance.");
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (r: Receivable) => {
    if (!accessToken || !profile?.businessId) return;
    try {
      const full = await fetchReceivable(accessToken, profile.businessId, r.id);
      setDetailReceivable(full);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger le détail.');
    }
  };

  const openPaymentModal = () => {
    if (!detailReceivable) return;
    const outstanding =
      Number(detailReceivable.amount) - Number(detailReceivable.amountPaid);
    setPaymentAmount(String(outstanding));
    setPaymentNotes('');
    setPaymentModalVisible(true);
  };

  const handleRecordPayment = async (fullPayment: boolean) => {
    if (!accessToken || !profile?.businessId || !detailReceivable) return;
    if (!fullPayment) {
      const amt = parseFloat(paymentAmount.replace(/\s/g, '').replace(',', '.'));
      if (isNaN(amt) || amt <= 0) {
        Alert.alert('Erreur', 'Le montant doit être positif.');
        return;
      }
      const outstanding =
        Number(detailReceivable.amount) - Number(detailReceivable.amountPaid);
      if (amt > outstanding) {
        Alert.alert(
          'Erreur',
          `Le montant ne peut pas dépasser le solde restant (${formatXof(outstanding)}).`,
        );
        return;
      }
    }
    setSubmitting(true);
    try {
      if (fullPayment) {
        await recordFullReceivablePayment(
          accessToken,
          profile.businessId,
          detailReceivable.id,
          {notes: paymentNotes.trim() || undefined},
        );
      } else {
        const amt = parseFloat(paymentAmount.replace(/\s/g, '').replace(',', '.'));
        await recordReceivablePayment(
          accessToken,
          profile.businessId,
          detailReceivable.id,
          {amount: amt, notes: paymentNotes.trim() || undefined},
        );
      }
      setPaymentModalVisible(false);
      const updated = await fetchReceivable(
        accessToken,
        profile.businessId,
        detailReceivable.id,
      );
      setDetailReceivable(updated);
      void loadReceivables();
    } catch (e: any) {
      Alert.alert(
        'Erreur',
        e?.message || "Impossible d'enregistrer le paiement.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredList = receivables;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}>
            <Text
              style={[
                styles.filterText,
                filter === f.key && styles.filterTextActive,
              ]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primaryLight}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {filter === 'all'
                ? 'Aucune créance enregistrée.'
                : `Aucune créance ${filter === 'open' ? 'ouverte' : 'en retard'}.`}
            </Text>
          </View>
        }
        renderItem={({item}) => {
          const outstanding =
            Number(item.amount) - Number(item.amountPaid);
          return (
            <Pressable
              style={styles.card}
              onPress={() => openDetail(item)}
              android_ripple={{color: 'rgba(0,0,0,0.05)'}}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{item.debtorName}</Text>
                <View style={[styles.statusBadge, {backgroundColor: getStatusColor(item.status) + '20'}]}>
                  <Text style={[styles.statusText, {color: getStatusColor(item.status)}]}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardAmount}>{formatXof(Number(item.amount))}</Text>
              {outstanding > 0 && (
                <Text style={styles.cardOutstanding}>
                  Reste: {formatXof(outstanding)}
                </Text>
              )}
              {item.description ? (
                <Text style={styles.cardDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />

      <Pressable
        style={styles.fab}
        onPress={() => {
          resetAddForm();
          setAddModalVisible(true);
        }}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      {/* Add Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setAddModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouvelle créance</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Nom du débiteur *</Text>
              <TextInput
                style={styles.input}
                value={debtorName}
                onChangeText={setDebtorName}
                placeholder="Ex: Marie Diallo"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="words"
              />
              <Text style={styles.inputLabel}>Téléphone</Text>
              <TextInput
                style={styles.input}
                value={debtorPhone}
                onChangeText={setDebtorPhone}
                placeholder="Optionnel"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
              />
              <Text style={styles.inputLabel}>Montant (F CFA) *</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="Ex: 5000"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
              />
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Ex: Vente riz 10kg"
                placeholderTextColor={theme.colors.textMuted}
                multiline
              />
              <Text style={styles.inputLabel}>Date d'échéance (AAAA-MM-JJ)</Text>
              <TextInput
                style={styles.input}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="Optionnel"
                placeholderTextColor={theme.colors.textMuted}
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <PrimaryButton
                label="Annuler"
                onPress={() => setAddModalVisible(false)}
                variant="outline"
              />
              <PrimaryButton
                label={submitting ? 'Enregistrement...' : 'Enregistrer'}
                onPress={handleAdd}
                disabled={submitting}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail Modal */}
      <Modal
        visible={!!detailReceivable && !paymentModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailReceivable(null)}>
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setDetailReceivable(null)}
          />
          {detailReceivable && (
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{detailReceivable.debtorName}</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Montant total</Text>
                <Text style={styles.detailValue}>
                  {formatXof(Number(detailReceivable.amount))}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Déjà payé</Text>
                <Text style={styles.detailValue}>
                  {formatXof(Number(detailReceivable.amountPaid))}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Solde restant</Text>
                <Text style={[styles.detailValue, {color: theme.colors.primary, fontWeight: '700'}]}>
                  {formatXof(
                    Number(detailReceivable.amount) - Number(detailReceivable.amountPaid),
                  )}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Statut</Text>
                <Text style={[styles.detailValue, {color: getStatusColor(detailReceivable.status)}]}>
                  {getStatusLabel(detailReceivable.status)}
                </Text>
              </View>
              {detailReceivable.description ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailValue}>{detailReceivable.description}</Text>
                </View>
              ) : null}
              {detailReceivable.payments && detailReceivable.payments.length > 0 ? (
                <View style={styles.paymentsSection}>
                  <Text style={styles.paymentsTitle}>Paiements</Text>
                  {detailReceivable.payments.map((p) => (
                    <View key={p.id} style={styles.paymentRow}>
                      <Text style={styles.paymentAmount}>
                        {formatXof(Number(p.amount))}
                      </Text>
                      <Text style={styles.paymentDate}>
                        {new Date(p.paymentDate).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {Number(detailReceivable.amount) - Number(detailReceivable.amountPaid) > 0 && (
                <PrimaryButton
                  label="Enregistrer un paiement"
                  onPress={openPaymentModal}
                  style={styles.paymentButton}
                />
              )}
              <PrimaryButton
                label="Fermer"
                onPress={() => setDetailReceivable(null)}
                variant="outline"
              />
            </View>
          )}
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPaymentModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setPaymentModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enregistrer un paiement</Text>
            {detailReceivable && (
              <>
                <Text style={styles.inputLabel}>Montant (F CFA) *</Text>
                <TextInput
                  style={styles.input}
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholder="Montant reçu"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                />
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={paymentNotes}
                  onChangeText={setPaymentNotes}
                  placeholder="Optionnel"
                  placeholderTextColor={theme.colors.textMuted}
                />
                <View style={styles.modalActions}>
                  <PrimaryButton
                    label={submitting ? 'Enregistrement...' : 'Montant partiel'}
                    onPress={() => handleRecordPayment(false)}
                    disabled={submitting}
                  />
                  <PrimaryButton
                    label="Soldé (tout)"
                    onPress={() => handleRecordPayment(true)}
                    disabled={submitting}
                  />
                </View>
              </>
            )}
          </View>
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FFF',
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterTextActive: {
    color: '#FFF',
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 100,
  },
  empty: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radii.xs,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  cardOutstanding: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    backgroundColor: '#FFF',
  },
  inputMultiline: {
    minHeight: 60,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  detailLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  paymentsSection: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  paymentsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  paymentDate: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  paymentButton: {
    marginTop: theme.spacing.lg,
  },
});
