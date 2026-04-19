import {useCallback, useEffect, useMemo, useState} from 'react';
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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useAuth} from '../auth/auth-context';
import {createTransaction, fetchTransactions, fetchProducts} from '../api/mobile-api';
import {Transaction, Product} from '../api/types';
import {PrimaryButton} from '../components/PrimaryButton';
import {theme} from '../theme';
import {shareTransactionInvoice} from '../utils/invoice-utils';

type TabType = 'all' | 'sale' | 'expense';

const TABS: {key: TabType; label: string}[] = [
  {key: 'all', label: 'Tous'},
  {key: 'sale', label: 'Ventes'},
  {key: 'expense', label: 'Dépenses'},
];

const toLocalDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDisplayDate = (d: Date): string =>
  d.toLocaleDateString('fr-FR', {weekday: 'short', day: 'numeric', month: 'short'});

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const getIsCreditSale = (t: Transaction): boolean =>
  !!(t.isCreditSale ?? (t as {is_credit_sale?: boolean}).is_credit_sale);

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
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [saleOnCredit, setSaleOnCredit] = useState(false);
  const [debtorName, setDebtorName] = useState('');

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const dateLabel = useMemo(() => {
    const today = new Date();
    if (isSameDay(selectedDate, today)) return "Aujourd'hui";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(selectedDate, yesterday)) return 'Hier';
    return formatDisplayDate(selectedDate);
  }, [selectedDate]);

  const goToPreviousDay = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  };

  const goToNextDay = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      if (d > tomorrow) return prev;
      return d;
    });
  };

  const goToToday = () => setSelectedDate(new Date());

  const isToday = isSameDay(selectedDate, new Date());

  const loadTransactions = useCallback(async () => {
    if (!accessToken || !profile?.businessId) return;
    try {
      const type =
        tab === 'sale' ? 'sale' : tab === 'expense' ? 'expense' : undefined;
      const startDate = toLocalDateStr(selectedDate);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const endDate = toLocalDateStr(nextDay);

      const data = await fetchTransactions(accessToken, profile.businessId, {
        type,
        startDate,
        endDate,
        limit: 100,
      });
      setTransactions(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les transactions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, profile?.businessId, tab, selectedDate]);

  useEffect(() => {
    setLoading(true);
    void loadTransactions();
  }, [loadTransactions]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadTransactions();
  };

  const handleAdd = async () => {
    if (!accessToken || !profile?.businessId) return;

    let finalAmount: number;
    let saleQuantity: number | undefined;

    if (addType === 'sale') {
      const selectedProduct = products.find((p) => p.product === product) ?? null;
      const hasUnitPrice =
        selectedProduct &&
        selectedProduct.unitPrice != null &&
        !isNaN(Number(selectedProduct.unitPrice));

      if (hasUnitPrice) {
        const qty = parseInt(quantity.replace(/\s/g, ''), 10);
        if (isNaN(qty) || qty < 1) {
          Alert.alert('Erreur', 'Veuillez saisir une quantité valide.');
          return;
        }
        saleQuantity = qty;
        const amt = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
        finalAmount =
          !isNaN(amt) && amt > 0 ? amt : qty * Number(selectedProduct!.unitPrice);
      } else {
        const amt = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
        if (isNaN(amt) || amt <= 0) {
          Alert.alert('Erreur', 'Veuillez saisir un montant valide.');
          return;
        }
        finalAmount = amt;
      }
    } else {
      const amt = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
      if (isNaN(amt) || amt <= 0) {
        Alert.alert('Erreur', 'Montant invalide.');
        return;
      }
      finalAmount = amt;
    }

    if (addType === 'sale' && saleOnCredit && !debtorName.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le nom du client pour une vente à crédit.');
      return;
    }

    setSubmitting(true);
    try {
      await createTransaction(accessToken, profile.businessId, {
        type: addType,
        amount: finalAmount,
        product: product.trim() || undefined,
        quantity: saleQuantity,
        description: description.trim() || undefined,
        creditSale:
          addType === 'sale' && saleOnCredit && debtorName.trim()
            ? { debtorName: debtorName.trim() }
            : undefined,
      });
      setAddModalVisible(false);
      setAmount('');
      setProduct('');
      setQuantity('');
      setDescription('');
      setSaleOnCredit(false);
      setDebtorName('');
      void loadTransactions();
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer la transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  const openAddModal = async (type: 'sale' | 'expense') => {
    setAddType(type);
    setAmount('');
    setProduct('');
    setQuantity('');
    setDescription('');
    setSaleOnCredit(false);
    setDebtorName('');

    if (type === 'sale' && accessToken && profile?.businessId) {
      try {
        const list = await fetchProducts(accessToken, profile.businessId);
        setProducts(list);
        if (list.length === 0) {
          Alert.alert(
            'Aucun produit',
            'Créez d\'abord des produits dans Produits & Stock avant d\'enregistrer une vente.',
            [{text: 'OK'}],
          );
          return;
        }
      } catch {
        Alert.alert('Erreur', 'Impossible de charger les produits.');
        return;
      }
    }

    setAddModalVisible(true);
  };

  const handleShareInvoice = async () => {
    if (!detailTransaction) return;
    const businessName = profile?.business?.name ?? 'Mon entreprise';
    setInvoiceLoading(true);
    try {
      await shareTransactionInvoice(detailTransaction, businessName);
    } catch (err) {
      Alert.alert(
        'Erreur',
        err instanceof Error ? err.message : 'Impossible de générer ou partager la facture.',
      );
    } finally {
      setInvoiceLoading(false);
    }
  };

  const formatXof = (n: number) =>
    `${(Number(n) || 0).toLocaleString('fr-FR')} F`;

  const formatTime = (s: string) =>
    new Date(s).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const totals = useMemo(() => {
    let sales = 0;
    let expenses = 0;
    for (const t of transactions) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'sale') sales += amt;
      else expenses += amt;
    }
    return {sales, expenses, net: sales - expenses};
  }, [transactions]);

  const formatFullDate = (s: string) =>
    new Date(s).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const renderItem = ({item}: {item: Transaction}) => {
    const isSale = item.type === 'sale';
    const isCreditSale = isSale && getIsCreditSale(item);
    return (
      <Pressable
        style={({pressed}) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => setDetailTransaction(item)}>
        <View
          style={[
            styles.cardIndicator,
            isCreditSale
              ? styles.indicatorCreditSale
              : isSale
                ? styles.indicatorSale
                : styles.indicatorExpense,
          ]}
        />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View
              style={[
                styles.typeBadge,
                isCreditSale
                  ? styles.badgeCreditSale
                  : isSale
                    ? styles.badgeSale
                    : styles.badgeExpense,
              ]}>
              <Text
                style={[
                  styles.typeText,
                  isCreditSale
                    ? styles.typeTextCreditSale
                    : isSale
                      ? styles.typeTextSale
                      : styles.typeTextExpense,
                ]}>
                {isCreditSale ? 'Vente à crédit' : isSale ? 'Vente' : 'Dépense'}
              </Text>
            </View>
            <Text style={styles.cardDate}>{formatTime(item.createdAt)}</Text>
          </View>
          <Text
            style={[
              styles.cardAmount,
              isCreditSale && {color: theme.colors.error},
            ]}>
            {isSale ? '+' : '-'}{formatXof(item.amount)}
          </Text>
          {item.product ? (
            <Text style={styles.cardProduct}>{item.product}</Text>
          ) : null}
        </View>
      </Pressable>
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
      {/* Date Picker */}
      <View style={styles.dateRow}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.dateArrow} hitSlop={12}>
          <Text style={styles.dateArrowText}>{'‹'}</Text>
        </TouchableOpacity>

        <Pressable onPress={goToToday} style={styles.dateLabelWrap}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          {!isToday && <Text style={styles.dateFull}>{toLocalDateStr(selectedDate)}</Text>}
        </Pressable>

        <TouchableOpacity
          onPress={goToNextDay}
          style={[styles.dateArrow, isToday && styles.dateArrowDisabled]}
          disabled={isToday}
          hitSlop={12}>
          <Text style={[styles.dateArrowText, isToday && styles.dateArrowTextDisabled]}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      {/* Day Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Ventes</Text>
          <Text style={[styles.summaryValue, {color: theme.colors.success}]}>
            {formatXof(totals.sales)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Dépenses</Text>
          <Text style={[styles.summaryValue, {color: theme.colors.error}]}>
            {formatXof(totals.expenses)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Net</Text>
          <Text
            style={[
              styles.summaryValue,
              {color: totals.net >= 0 ? theme.colors.success : theme.colors.error},
            ]}>
            {formatXof(totals.net)}
          </Text>
        </View>
      </View>

      {/* Type Tabs */}
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
              {isToday
                ? 'Appuyez sur les boutons ci-dessous pour en ajouter'
                : `Pas de transactions le ${formatDisplayDate(selectedDate)}`}
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

                {addType === 'sale' && (
                  <>
                    <Text style={styles.label}>Produit</Text>
                    <TouchableOpacity
                      style={styles.productSelector}
                      onPress={() => setProductPickerVisible(true)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.productSelectorText,
                          !product && styles.productSelectorPlaceholder,
                        ]}
                        numberOfLines={1}>
                        {product || 'Sélectionner un produit'}
                      </Text>
                      <Text style={styles.productSelectorArrow}>{'›'}</Text>
                    </TouchableOpacity>

                    {(() => {
                      const sel = products.find((p) => p.product === product) ?? null;
                      const hasUnitPrice =
                        sel &&
                        sel.unitPrice != null &&
                        !isNaN(Number(sel.unitPrice));
                      if (hasUnitPrice) {
                        return (
                          <>
                            <Text style={styles.label}>Quantité *</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="ex: 2"
                              placeholderTextColor={theme.colors.textMuted}
                              value={quantity}
                              onChangeText={setQuantity}
                              keyboardType="number-pad"
                            />
                            <Text style={styles.label}>
                              Montant (F CFA) — optionnel
                            </Text>
                            <Text style={styles.inputHint}>
                              Vide = quantité × {Number(sel!.unitPrice).toLocaleString('fr-FR')} F
                            </Text>
                            <TextInput
                              style={styles.input}
                              placeholder="ex: 1 500 (ou laisser vide)"
                              placeholderTextColor={theme.colors.textMuted}
                              value={amount}
                              onChangeText={setAmount}
                              keyboardType="decimal-pad"
                            />
                          </>
                        );
                      }
                      return (
                        <>
                          <Text style={styles.label}>Montant (F CFA) *</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="ex: 1 500"
                            placeholderTextColor={theme.colors.textMuted}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="decimal-pad"
                          />
                        </>
                      );
                    })()}

                    <Modal
                      visible={productPickerVisible}
                      transparent
                      animationType="slide"
                      onRequestClose={() => setProductPickerVisible(false)}>
                      <Pressable
                        style={styles.pickerOverlay}
                        onPress={() => setProductPickerVisible(false)}>
                        <Pressable
                          style={styles.pickerModal}
                          onPress={(e) => e.stopPropagation()}>
                          <View style={styles.pickerHandle} />
                          <Text style={styles.pickerTitle}>Choisir un produit</Text>
                          <ScrollView
                            style={styles.pickerList}
                            keyboardShouldPersistTaps="handled">
                            {products.map((p) => (
                              <TouchableOpacity
                                key={p.id}
                                style={[
                                  styles.pickerItem,
                                  product === p.product && styles.pickerItemActive,
                                ]}
                                onPress={() => {
                                  setProduct(p.product);
                                  setQuantity('');
                                  setAmount('');
                                  setProductPickerVisible(false);
                                }}
                                activeOpacity={0.7}>
                                <Text
                                  style={[
                                    styles.pickerItemText,
                                    product === p.product && styles.pickerItemTextActive,
                                  ]}
                                  numberOfLines={1}>
                                  {p.product}
                                </Text>
                                {p.unitPrice != null && (
                                  <Text style={styles.pickerItemPrice}>
                                    {Number(p.unitPrice).toLocaleString('fr-FR')} F
                                  </Text>
                                )}
                              </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                              style={[
                                styles.pickerItem,
                                product && !products.some((p) => p.product === product) && styles.pickerItemActive,
                              ]}
                              onPress={() => {
                                setProduct('');
                                setQuantity('');
                                setAmount('');
                                setProductPickerVisible(false);
                              }}
                              activeOpacity={0.7}>
                              <Text style={styles.pickerItemText}>— Aucun</Text>
                            </TouchableOpacity>
                          </ScrollView>
                          <PrimaryButton
                            label="Fermer"
                            variant="outline"
                            onPress={() => setProductPickerVisible(false)}
                          />
                        </Pressable>
                      </Pressable>
                    </Modal>
                  </>
                )}

                {addType === 'expense' && (
                  <>
                    <Text style={styles.label}>Montant (F CFA) *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="ex: 1 500"
                      placeholderTextColor={theme.colors.textMuted}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                    />
                  </>
                )}

                {addType === 'sale' && (
                  <>
                    <View style={styles.creditRow}>
                      <Text style={styles.label}>Vente à crédit</Text>
                      <Switch
                        value={saleOnCredit}
                        onValueChange={setSaleOnCredit}
                        trackColor={{ false: '#C4C4C4', true: theme.colors.primaryLight }}
                        thumbColor={saleOnCredit ? '#FFFFFF' : '#FFFFFF'}
                        ios_backgroundColor="#C4C4C4"
                      />
                    </View>
                    {saleOnCredit && (
                      <>
                        <Text style={styles.label}>Nom du client *</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="ex: Marie Diallo"
                          placeholderTextColor={theme.colors.textMuted}
                          value={debtorName}
                          onChangeText={setDebtorName}
                          autoCapitalize="words"
                        />
                      </>
                    )}
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

      {/* Transaction Detail Modal */}
      <Modal
        visible={!!detailTransaction}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailTransaction(null)}>
        <Pressable
          style={styles.detailOverlay}
          onPress={() => setDetailTransaction(null)}>
          <Pressable
            style={styles.detailModal}
            onPress={(e) => e.stopPropagation()}>
            {detailTransaction && (
              <>
                <View
                  style={[
                    styles.detailHeader,
                    detailTransaction.type === 'sale'
                      ? getIsCreditSale(detailTransaction)
                        ? styles.detailHeaderCreditSale
                        : styles.detailHeaderSale
                      : styles.detailHeaderExpense,
                  ]}>
                  <Text style={styles.detailType}>
                    {detailTransaction.type === 'sale'
                      ? getIsCreditSale(detailTransaction)
                        ? 'Vente à crédit'
                        : 'Vente'
                      : 'Dépense'}
                  </Text>
                  <Text
                    style={[
                      styles.detailAmount,
                      detailTransaction.type === 'sale'
                        ? getIsCreditSale(detailTransaction)
                          ? {color: theme.colors.error}
                          : {color: theme.colors.success}
                        : {color: theme.colors.error},
                    ]}>
                    {detailTransaction.type === 'sale' ? '+' : '-'}
                    {formatXof(detailTransaction.amount)}
                  </Text>
                </View>
                <View style={styles.detailBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>
                      {formatFullDate(detailTransaction.createdAt)}
                    </Text>
                  </View>
                  {detailTransaction.product ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Produit</Text>
                      <Text style={styles.detailValue}>
                        {detailTransaction.product}
                      </Text>
                    </View>
                  ) : null}
                  {detailTransaction.quantity != null && detailTransaction.quantity > 0 ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Quantité</Text>
                      <Text style={styles.detailValue}>
                        {detailTransaction.quantity}
                      </Text>
                    </View>
                  ) : null}
                  {detailTransaction.description ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Description</Text>
                      <Text style={styles.detailValue}>
                        {detailTransaction.description}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.detailFooter}>
                  <View style={styles.detailFooterButtons}>
                    <PrimaryButton
                      label={invoiceLoading ? 'Génération…' : 'Facture'}
                      variant="filled"
                      onPress={handleShareInvoice}
                      disabled={invoiceLoading}
                    />
                    <PrimaryButton
                      label="Fermer"
                      variant="outline"
                      onPress={() => setDetailTransaction(null)}
                    />
                  </View>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
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

  // Date picker
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  dateArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  dateArrowDisabled: {
    opacity: 0.3,
  },
  dateArrowText: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: -2,
  },
  dateArrowTextDisabled: {
    color: theme.colors.textMuted,
  },
  dateLabelWrap: {
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  dateFull: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },

  // Day summary
  summaryRow: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: theme.colors.borderLight,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
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
    fontSize: 13,
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
  cardPressed: {
    opacity: 0.9,
  },
  cardIndicator: {
    width: 4,
  },
  indicatorSale: {
    backgroundColor: theme.colors.success,
  },
  indicatorCreditSale: {
    backgroundColor: theme.colors.error,
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
    backgroundColor: 'rgba(52, 211, 153, 0.18)',
  },
  badgeCreditSale: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.5)',
  },
  badgeExpense: {
    backgroundColor: 'rgba(248, 113, 113, 0.18)',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeTextSale: {
    color: theme.colors.success,
  },
  typeTextCreditSale: {
    color: '#B91C1C',
    fontWeight: '700',
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
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  inputHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
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
  productSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.md,
    padding: 14,
    marginBottom: theme.spacing.md,
  },
  productSelectorText: {
    fontSize: 16,
    color: theme.colors.text,
    flex: 1,
  },
  productSelectorPlaceholder: {
    color: theme.colors.textMuted,
  },
  productSelectorArrow: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginLeft: 8,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: theme.colors.bgCard,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    maxHeight: '70%',
  },
  pickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  pickerList: {
    maxHeight: 280,
    marginBottom: theme.spacing.md,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: theme.radii.md,
    marginBottom: 4,
  },
  pickerItemActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  pickerItemText: {
    fontSize: 16,
    color: theme.colors.text,
    flex: 1,
  },
  pickerItemTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  pickerItemPrice: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },

  detailOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  detailModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radii.xl,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  detailHeader: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  detailHeaderSale: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 211, 153, 0.2)',
  },
  detailHeaderCreditSale: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(220, 38, 38, 0.2)',
  },
  detailHeaderExpense: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(248, 113, 113, 0.2)',
  },
  detailType: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailAmount: {
    fontSize: 24,
    fontWeight: '800',
  },
  detailBody: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  detailRow: {
    gap: 4,
  },
  detailFooter: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    color: theme.colors.text,
  },
});
