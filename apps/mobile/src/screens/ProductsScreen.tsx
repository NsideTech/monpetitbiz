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
import {
  adjustStock,
  createProduct,
  deleteProduct,
  fetchProducts,
  fetchStockMovements,
  updateProduct,
} from '../api/mobile-api';
import {Product, StockMovement} from '../api/types';
import {PrimaryButton} from '../components/PrimaryButton';
import {GlassCard} from '../components/GlassCard';
import {theme} from '../theme';

const LOW_STOCK_THRESHOLD = 5;

export const ProductsScreen = () => {
  const {accessToken, profile} = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!accessToken || !profile?.businessId) return;
    try {
      const data = await fetchProducts(accessToken, profile.businessId);
      setProducts(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les produits.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, profile?.businessId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadProducts().finally(() => setRefreshing(false));
  };

  const isLowStock = (qty: number) => qty <= LOW_STOCK_THRESHOLD;

  const handleAdjustStock = async () => {
    if (!accessToken || !profile?.businessId || !selectedProduct) return;
    const qty = parseInt(adjustQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Erreur', 'Quantité invalide.');
      return;
    }
    setSubmitting(true);
    try {
      await adjustStock(accessToken, profile.businessId, selectedProduct.id, qty);
      setAdjustModalVisible(false);
      setSelectedProduct(null);
      setAdjustQuantity('');
      await loadProducts();
    } catch {
      Alert.alert('Erreur', "Impossible d'ajuster le stock.");
    } finally {
      setSubmitting(false);
    }
  };

  const openAdjustModal = (product: Product) => {
    setSelectedProduct(product);
    setAdjustQuantity(String(product.quantity));
    setAdjustModalVisible(true);
  };

  const openHistoryModal = async (product: Product) => {
    setSelectedProduct(product);
    setHistoryModalVisible(true);
    if (!accessToken || !profile?.businessId) return;
    try {
      const data = await fetchStockMovements(accessToken, profile.businessId, {
        productId: product.id,
        limit: 20,
      });
      setMovements(data);
    } catch {
      Alert.alert('Erreur', "Impossible de charger l'historique.");
      setMovements([]);
    }
  };

  const handleAdd = async () => {
    if (!accessToken || !profile?.businessId || !newName.trim()) {
      Alert.alert('Erreur', 'Le nom du produit est requis.');
      return;
    }
    setSubmitting(true);
    try {
      await createProduct(accessToken, profile.businessId, {
        name: newName.trim(),
        quantity: parseInt(newQuantity, 10) || 0,
        unitPrice: newPrice ? parseFloat(newPrice) : undefined,
      });
      setAddModalVisible(false);
      setNewName('');
      setNewQuantity('');
      setNewPrice('');
      await loadProducts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de l'ajout.";
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPrice = async () => {
    if (!accessToken || !profile?.businessId || !selectedProduct) return;
    const price = parseFloat(editPrice);
    if (isNaN(price) || price < 0) {
      Alert.alert('Erreur', 'Prix invalide.');
      return;
    }
    setSubmitting(true);
    try {
      await updateProduct(accessToken, profile.businessId, selectedProduct.id, {
        unitPrice: price,
      });
      setEditModalVisible(false);
      setSelectedProduct(null);
      setEditPrice('');
      await loadProducts();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Erreur lors de la mise à jour.';
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (product: Product) => {
    Alert.alert('Supprimer', `Supprimer "${product.product}" ?`, [
      {text: 'Annuler', style: 'cancel'},
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (!accessToken || !profile?.businessId) return;
          try {
            await deleteProduct(accessToken, profile.businessId, product.id);
            await loadProducts();
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer le produit.');
          }
        },
      },
    ]);
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setEditPrice(
      product.unitPrice != null ? String(Number(product.unitPrice)) : '',
    );
    setEditModalVisible(true);
  };

  const formatMovementType = (t: string) => {
    switch (t) {
      case 'purchase':
        return 'Achat';
      case 'sale':
        return 'Vente';
      case 'adjustment':
        return 'Ajustement';
      case 'loss':
        return 'Perte';
      default:
        return t;
    }
  };

  const formatPrice = (p: number | string | null) =>
    p != null ? `${Number(p).toLocaleString('fr-FR')} F` : '—';

  const getStockColor = (qty: number) => {
    if (qty === 0) return theme.colors.error;
    if (qty <= LOW_STOCK_THRESHOLD) return theme.colors.warning;
    return theme.colors.success;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primaryLight} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primaryLight}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{'📦'}</Text>
            <Text style={styles.emptyText}>Aucun produit</Text>
            <Text style={styles.emptyHint}>
              Appuyez sur + pour ajouter votre premier produit
            </Text>
          </View>
        }
        renderItem={({item}) => (
          <View style={styles.card}>
            <View
              style={[
                styles.stockBar,
                {backgroundColor: getStockColor(item.quantity)},
              ]}
            />
            <TouchableOpacity
              style={styles.cardBody}
              onPress={() => openEditModal(item)}
              activeOpacity={0.7}>
              <View style={styles.cardTop}>
                <View style={styles.cardInfo}>
                  <Text style={styles.productName}>{item.product}</Text>
                  <Text style={styles.price}>{formatPrice(item.unitPrice)}</Text>
                </View>
                {isLowStock(item.quantity) && (
                  <View
                    style={[
                      styles.badge,
                      item.quantity === 0 && styles.badgeOut,
                    ]}>
                    <Text style={styles.badgeText}>
                      {item.quantity === 0 ? 'Rupture' : 'Stock bas'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.stockRow}>
                <View style={styles.stockGauge}>
                  <View
                    style={[
                      styles.stockGaugeFill,
                      {
                        width: `${Math.min(100, (item.quantity / 50) * 100)}%`,
                        backgroundColor: getStockColor(item.quantity),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.stockQty, {color: getStockColor(item.quantity)}]}>
                  {item.quantity}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openAdjustModal(item)}>
                  <Text style={styles.actionBtnText}>Ajuster</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openHistoryModal(item)}>
                  <Text style={styles.actionBtnText}>Historique</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item)}>
                  <Text style={styles.deleteBtnText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setAddModalVisible(true)}
        activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Product Modal */}
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
                <Text style={styles.modalTitle}>Nouveau produit</Text>
                <Text style={styles.label}>Nom du produit *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ex: Pain, Eau, Riz"
                  placeholderTextColor={theme.colors.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                  autoCapitalize="none"
                />
                <Text style={styles.label}>Quantité en stock</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={theme.colors.textMuted}
                  value={newQuantity}
                  onChangeText={setNewQuantity}
                  keyboardType="number-pad"
                />
                <Text style={styles.label}>Prix unitaire (F CFA)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ex: 500"
                  placeholderTextColor={theme.colors.textMuted}
                  value={newPrice}
                  onChangeText={setNewPrice}
                  keyboardType="decimal-pad"
                />
                <View style={styles.modalActions}>
                  <PrimaryButton
                    label="Annuler"
                    onPress={() => setAddModalVisible(false)}
                    variant="ghost"
                  />
                  <PrimaryButton
                    label={submitting ? 'Ajout...' : 'Ajouter'}
                    onPress={handleAdd}
                    disabled={submitting}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Price Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setEditModalVisible(false)}>
            <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                Modifier le prix — {selectedProduct?.product}
              </Text>
              <Text style={styles.label}>Prix unitaire (F CFA)</Text>
              <TextInput
                style={styles.input}
                placeholder="ex: 500"
                placeholderTextColor={theme.colors.textMuted}
                value={editPrice}
                onChangeText={setEditPrice}
                keyboardType="decimal-pad"
              />
              <View style={styles.modalActions}>
                <PrimaryButton
                  label="Annuler"
                  onPress={() => {
                    setEditModalVisible(false);
                    setSelectedProduct(null);
                  }}
                  variant="ghost"
                />
                <PrimaryButton
                  label={submitting ? 'Enregistrement...' : 'Enregistrer'}
                  onPress={handleEditPrice}
                  disabled={submitting}
                />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        visible={adjustModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAdjustModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setAdjustModalVisible(false)}>
            <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                Ajuster — {selectedProduct?.product}
              </Text>
              <View style={styles.currentStockBanner}>
                <Text style={styles.currentStockLabel}>Stock actuel</Text>
                <Text style={styles.currentStockValue}>
                  {selectedProduct?.quantity ?? 0}
                </Text>
              </View>
              <Text style={styles.label}>Nouvelle quantité</Text>
              <TextInput
                style={styles.input}
                placeholder="ex: 50"
                placeholderTextColor={theme.colors.textMuted}
                value={adjustQuantity}
                onChangeText={setAdjustQuantity}
                keyboardType="number-pad"
              />
              <View style={styles.modalActions}>
                <PrimaryButton
                  label="Annuler"
                  onPress={() => {
                    setAdjustModalVisible(false);
                    setSelectedProduct(null);
                    setAdjustQuantity('');
                  }}
                  variant="ghost"
                />
                <PrimaryButton
                  label={submitting ? 'Enregistrement...' : 'Enregistrer'}
                  onPress={handleAdjustStock}
                  disabled={submitting}
                />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={historyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryModalVisible(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setHistoryModalVisible(false)}>
          <Pressable
            style={[styles.modal, styles.historyModal]}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              Historique — {selectedProduct?.product}
            </Text>
            <ScrollView style={styles.historyScroll}>
              {movements.length === 0 ? (
                <Text style={styles.historyEmpty}>Aucun mouvement</Text>
              ) : (
                movements.map((m) => (
                  <GlassCard key={m.id} style={styles.historyCard}>
                    <View style={styles.historyRow}>
                      <View style={styles.historyLeft}>
                        <Text style={styles.historyType}>
                          {formatMovementType(m.movementType)}
                        </Text>
                        <Text style={styles.historyDate}>
                          {new Date(m.createdAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <View style={styles.historyRight}>
                        <Text style={styles.historyQty}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </Text>
                        <Text style={styles.historyNewStock}>
                          {m.newStock} en stock
                        </Text>
                      </View>
                    </View>
                  </GlassCard>
                ))
              )}
            </ScrollView>
            <PrimaryButton
              label="Fermer"
              onPress={() => {
                setHistoryModalVisible(false);
                setSelectedProduct(null);
                setMovements([]);
              }}
              variant="outline"
            />
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
  list: {
    padding: theme.spacing.md,
    paddingBottom: 100,
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
  stockBar: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    textTransform: 'capitalize',
  },
  price: {
    fontSize: 14,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radii.full,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.30)',
  },
  badgeOut: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderColor: 'rgba(248, 113, 113, 0.30)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.warning,
  },

  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  stockGauge: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.borderLight,
    overflow: 'hidden',
  },
  stockGaugeFill: {
    height: '100%',
    borderRadius: 3,
  },
  stockQty: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 30,
    textAlign: 'right',
  },

  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.chipBg,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
  },
  actionBtnText: {
    fontSize: 13,
    color: theme.colors.primaryLight,
    fontWeight: '500',
  },
  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radii.full,
    backgroundColor: 'rgba(248, 113, 113, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
  },
  deleteBtnText: {
    color: theme.colors.error,
    fontSize: 13,
    fontWeight: '500',
  },

  fab: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.glow,
  },
  fabText: {
    fontSize: 30,
    color: '#FFFFFF',
    fontWeight: '300',
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

  currentStockBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...theme.glass,
    borderRadius: theme.radii.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  currentStockLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  currentStockValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.primaryLight,
  },

  historyModal: {
    maxHeight: '85%',
  },
  historyScroll: {
    maxHeight: 350,
    marginBottom: theme.spacing.md,
  },
  historyEmpty: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    paddingVertical: theme.spacing.xl,
    fontSize: 15,
  },
  historyCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyLeft: {
    gap: 2,
  },
  historyType: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  historyDate: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  historyRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  historyQty: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.accent,
  },
  historyNewStock: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
});
