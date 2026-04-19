import {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {useAuth} from '../auth/auth-context';
import {
  fetchEmployees,
  generateEmployeeCode,
  removeEmployee,
  updateEmployeeRole,
} from '../api/mobile-api';
import {Employee, EmployeeCode} from '../api/types';
import {PrimaryButton} from '../components/PrimaryButton';
import {GlassCard} from '../components/GlassCard';
import {SectionHeader} from '../components/SectionHeader';
import {theme} from '../theme';

const ROLE_LABELS: Record<string, string> = {
  seller: 'Vendeur',
  manager: 'Gérant',
};

export const EmployeesScreen = () => {
  const {accessToken} = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [currentCode, setCurrentCode] = useState<EmployeeCode | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await fetchEmployees(accessToken);
      setEmployees(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les employés.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadEmployees().finally(() => setRefreshing(false));
  };

  const handleGenerateCode = async () => {
    if (!accessToken) return;
    setGeneratingCode(true);
    try {
      const code = await generateEmployeeCode(accessToken);
      setCurrentCode(code);
    } catch {
      Alert.alert('Erreur', 'Impossible de générer le code.');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = async () => {
    if (!currentCode) return;
    await Clipboard.setStringAsync(currentCode.code);
    Alert.alert('Copié', 'Le code a été copié dans le presse-papier.');
  };

  const handleUpdateRole = async (employee: Employee) => {
    if (!accessToken) return;
    const newRole = employee.role === 'seller' ? 'manager' : 'seller';
    const newRoleLabel = ROLE_LABELS[newRole];

    Alert.alert(
      'Modifier le rôle',
      `Changer le rôle de ${employee.employeeName || employee.phoneNumber} en ${newRoleLabel} ?`,
      [
        {text: 'Annuler', style: 'cancel'},
        {
          text: 'Confirmer',
          onPress: async () => {
            setUpdatingRole(employee.id);
            try {
              await updateEmployeeRole(accessToken, employee.phoneNumber, newRole);
              setEmployees(prev =>
                prev.map(e =>
                  e.id === employee.id ? {...e, role: newRole} : e,
                ),
              );
            } catch {
              Alert.alert('Erreur', 'Impossible de modifier le rôle.');
            } finally {
              setUpdatingRole(null);
            }
          },
        },
      ],
    );
  };

  const handleRemoveEmployee = (employee: Employee) => {
    if (!accessToken) return;
    Alert.alert(
      'Supprimer l\'employé',
      `Êtes-vous sûr de vouloir supprimer ${employee.employeeName || employee.phoneNumber} ?`,
      [
        {text: 'Annuler', style: 'cancel'},
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeEmployee(accessToken, employee.phoneNumber);
              setEmployees(prev => prev.filter(e => e.id !== employee.id));
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer l\'employé.');
            }
          },
        },
      ],
    );
  };

  const getTimeRemaining = (expiresAt: string): string => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expiré';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `Expire dans ${hours}h${minutes.toString().padStart(2, '0')}`;
  };

  const renderEmployee = ({item}: {item: Employee}) => {
    const isUpdating = updatingRole === item.id;
    const displayName = item.employeeName || 'Sans nom';

    return (
      <GlassCard style={styles.employeeCard}>
        <View style={styles.employeeRow}>
          <View style={styles.employeeInfo}>
            <Text style={styles.employeeName}>{displayName}</Text>
            <Text style={styles.employeePhone}>{item.phoneNumber}</Text>
          </View>
          {!item.isActive && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>Inactif</Text>
            </View>
          )}
        </View>
        <View style={styles.employeeActions}>
          <View style={styles.roleChips}>
            <Pressable
              style={[
                styles.roleChip,
                item.role === 'seller' && styles.roleChipActive,
              ]}
              onPress={() => item.role !== 'seller' && handleUpdateRole(item)}
              disabled={isUpdating}>
              {isUpdating && item.role !== 'seller' ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Text
                  style={[
                    styles.roleChipText,
                    item.role === 'seller' && styles.roleChipTextActive,
                  ]}>
                  Vendeur
                </Text>
              )}
            </Pressable>
            <Pressable
              style={[
                styles.roleChip,
                item.role === 'manager' && styles.roleChipActive,
              ]}
              onPress={() => item.role !== 'manager' && handleUpdateRole(item)}
              disabled={isUpdating}>
              {isUpdating && item.role !== 'manager' ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Text
                  style={[
                    styles.roleChipText,
                    item.role === 'manager' && styles.roleChipTextActive,
                  ]}>
                  Gérant
                </Text>
              )}
            </Pressable>
          </View>
          <Pressable
            style={styles.removeBtn}
            onPress={() => handleRemoveEmployee(item)}>
            <Text style={styles.removeBtnText}>Supprimer</Text>
          </Pressable>
        </View>
      </GlassCard>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const activeEmployees = employees.filter(e => e.isActive);

  return (
    <View style={styles.container}>
      <FlatList
        data={activeEmployees}
        keyExtractor={item => item.id}
        renderItem={renderEmployee}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <SectionHeader
              title="Inviter un employé"
              subtitle="Générez un code à partager"
            />
            <GlassCard style={styles.inviteCard}>
              <PrimaryButton
                label={generatingCode ? 'Génération...' : 'Générer un code d\'invitation'}
                onPress={handleGenerateCode}
                disabled={generatingCode}
              />
              {currentCode && (
                <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>Code :</Text>
                  <Pressable onPress={handleCopyCode} style={styles.codeBadge}>
                    <Text style={styles.codeText}>{currentCode.code}</Text>
                    <Text style={styles.copyHint}>📋 Copier</Text>
                  </Pressable>
                  <Text style={styles.codeExpiry}>
                    {getTimeRemaining(currentCode.expiresAt)}
                  </Text>
                </View>
              )}
            </GlassCard>

            <View style={styles.sectionSpacer} />
            <SectionHeader
              title={`Mes employés (${activeEmployees.length})`}
              subtitle="Gérer les rôles et accès"
            />
          </View>
        }
        ListEmptyComponent={
          <GlassCard>
            <Text style={styles.emptyText}>
              Aucun employé pour le moment.{'\n'}Générez un code d'invitation pour commencer.
            </Text>
          </GlassCard>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  inviteCard: {
    marginBottom: theme.spacing.md,
  },
  codeContainer: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.chipBgActive,
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  codeText: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.primaryDark,
    letterSpacing: 4,
  },
  copyHint: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  codeExpiry: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  sectionSpacer: {
    height: theme.spacing.lg,
  },
  employeeCard: {
    marginBottom: theme.spacing.md,
  },
  employeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  employeePhone: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  inactiveBadge: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.radii.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  inactiveBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  employeeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleChips: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  roleChip: {
    borderRadius: theme.radii.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.chipBg,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
    minWidth: 80,
    alignItems: 'center',
  },
  roleChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  roleChipTextActive: {
    color: '#FFFFFF',
  },
  removeBtn: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  removeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.error,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
});
