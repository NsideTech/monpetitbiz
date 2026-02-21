import {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {GlassCard} from '../components/GlassCard';
import {PrimaryButton} from '../components/PrimaryButton';
import {SectionHeader} from '../components/SectionHeader';
import {useAuth} from '../auth/auth-context';
import {fetchBusinessInfo, updateBusinessInfo} from '../api/mobile-api';
import {BusinessInfo} from '../api/types';
import {tokenStorage} from '../storage/token-storage';
import {theme} from '../theme';

const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '1';

const CURRENCIES = ['XOF'];
const COUNTRIES = [
  {code: 'BFA', label: 'Burkina Faso'},
  // {code: 'SEN', label: 'Sénégal'},
  // {code: 'MLI', label: 'Mali'},
  // {code: 'CIV', label: "Côte d'Ivoire"},
  // {code: 'GIN', label: 'Guinée'},
  // {code: 'NER', label: 'Niger'},
  // {code: 'TGO', label: 'Togo'},
  // {code: 'BEN', label: 'Bénin'},
];

export const MoreScreen = () => {
  const {accessToken, profile, setProfile, setAccessToken} = useAuth();

  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [loadingBiz, setLoadingBiz] = useState(true);
  const [bizName, setBizName] = useState('');
  const [bizOwner, setBizOwner] = useState('');
  const [bizCurrency, setBizCurrency] = useState('');
  const [bizCountry, setBizCountry] = useState('');
  const [savingBiz, setSavingBiz] = useState(false);
  const [bizEditing, setBizEditing] = useState(false);

  const [contactName, setContactName] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [sending, setSending] = useState(false);

  const loadBusinessInfo = useCallback(async () => {
    if (!accessToken) return;
    try {
      const info = await fetchBusinessInfo(accessToken);
      setBusinessInfo(info);
      setBizName(info.name ?? '');
      setBizOwner(info.ownerName ?? '');
      setBizCurrency(info.currency ?? 'XOF');
      setBizCountry(info.country ?? '');
    } catch {
      // silently fail -- info will be blank
    } finally {
      setLoadingBiz(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadBusinessInfo();
  }, [loadBusinessInfo]);

  const bizHasChanges =
    businessInfo &&
    (bizName.trim() !== (businessInfo.name ?? '') ||
      bizOwner.trim() !== (businessInfo.ownerName ?? '') ||
      bizCurrency !== (businessInfo.currency ?? 'XOF') ||
      bizCountry !== (businessInfo.country ?? ''));

  const handleSaveBusiness = async () => {
    if (!accessToken || !businessInfo) return;

    if (bizName.trim().length < 2) {
      Alert.alert('Erreur', "Le nom de l'entreprise doit contenir au moins 2 caractères.");
      return;
    }

    setSavingBiz(true);
    try {
      const updates: Record<string, string> = {};
      if (bizName.trim() !== (businessInfo.name ?? '')) updates.name = bizName.trim();
      if (bizOwner.trim() !== (businessInfo.ownerName ?? '')) updates.ownerName = bizOwner.trim();
      if (bizCurrency !== (businessInfo.currency ?? 'XOF')) updates.currency = bizCurrency;
      if (bizCountry !== (businessInfo.country ?? '')) updates.country = bizCountry;

      const updated = await updateBusinessInfo(accessToken, updates);
      setBusinessInfo(updated);
      setBizEditing(false);
      Alert.alert('Succès', 'Les informations ont été mises à jour.');
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder les modifications.');
    } finally {
      setSavingBiz(false);
    }
  };

  const handleCancelEdit = () => {
    if (businessInfo) {
      setBizName(businessInfo.name ?? '');
      setBizOwner(businessInfo.ownerName ?? '');
      setBizCurrency(businessInfo.currency ?? 'XOF');
      setBizCountry(businessInfo.country ?? '');
    }
    setBizEditing(false);
  };

  const handleSendMessage = async () => {
    if (!contactName.trim() || !contactMessage.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir votre nom et votre message.');
      return;
    }

    setSending(true);
    try {
      const subject = encodeURIComponent(`[MonPetitBiz App] Message de ${contactName.trim()}`);
      const body = encodeURIComponent(
        `Nom: ${contactName.trim()}\n` +
        `Téléphone: ${profile?.phoneNumber ?? 'N/A'}\n` +
        `Entreprise: ${businessInfo?.name ?? profile?.businessId ?? 'N/A'}\n` +
        `Version: ${APP_VERSION} (${BUILD_NUMBER})\n\n` +
        `Message:\n${contactMessage.trim()}`
      );
      const url = `mailto:support@monpetitbiz.com?subject=${subject}&body=${body}`;

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        setContactName('');
        setContactMessage('');
      } else {
        Alert.alert(
          'Email non disponible',
          'Aucune application email configurée. Contactez-nous à support@monpetitbiz.com',
        );
      }
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir l'application email.");
    } finally {
      setSending(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      {text: 'Annuler', style: 'cancel'},
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: async () => {
          await tokenStorage.clear();
          setProfile(null);
          setAccessToken(null);
        },
      },
    ]);
  };

  const countryLabel = (code: string) =>
    COUNTRIES.find(c => c.code === code)?.label ?? code;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">

      {/* App Info */}
      <SectionHeader title="À propos" />
      <GlassCard style={styles.card}>
        <View style={styles.appHeader}>
          <View style={styles.appIconContainer}>
            <Text style={styles.appIcon}>{'💼'}</Text>
          </View>
          <View style={styles.appInfo}>
            <Text style={styles.appName}>MonPetitBiz</Text>
            <Text style={styles.appTagline}>
              Gestion simplifiée pour votre entreprise
            </Text>
          </View>
        </View>

        <View style={styles.versionRow}>
          <View style={styles.versionItem}>
            <Text style={styles.versionLabel}>Version</Text>
            <Text style={styles.versionValue}>{APP_VERSION}</Text>
          </View>
          <View style={styles.versionItem}>
            <Text style={styles.versionLabel}>Build</Text>
            <Text style={styles.versionValue}>{BUILD_NUMBER}</Text>
          </View>
        </View>
      </GlassCard>

      {/* User Info */}
      {profile && (
        <>
          <SectionHeader title="Mon compte" />
          <GlassCard style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nom</Text>
              <Text style={styles.infoValue}>
                {profile.employeeName || '—'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Téléphone</Text>
              <Text style={styles.infoValue}>{profile.phoneNumber}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Rôle</Text>
              <Text style={styles.infoValue}>
                {profile.role === 'owner'
                  ? 'Propriétaire'
                  : profile.role === 'manager'
                    ? 'Gérant'
                    : 'Vendeur'}
              </Text>
            </View>
          </GlassCard>
        </>
      )}

      {/* Business Info */}
      {profile?.role === 'owner' && (
        <>
          <SectionHeader
            title="Mon entreprise"
            subtitle="Modifier les informations de votre entreprise"
          />

          {loadingBiz ? (
            <GlassCard style={styles.card}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </GlassCard>
          ) : bizEditing ? (
            <GlassCard style={styles.card}>
              <Text style={styles.fieldLabel}>Nom de l'entreprise</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Boulangerie Koudougou"
                placeholderTextColor={theme.colors.textMuted}
                value={bizName}
                onChangeText={setBizName}
              />

              <Text style={styles.fieldLabel}>Nom du propriétaire</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Fatou Ouédraogo"
                placeholderTextColor={theme.colors.textMuted}
                value={bizOwner}
                onChangeText={setBizOwner}
              />

              <Text style={styles.fieldLabel}>Devise</Text>
              <View style={styles.chipRow}>
                {CURRENCIES.map(c => (
                  <PrimaryButton
                    key={c}
                    label={c}
                    size="sm"
                    variant={bizCurrency === c ? 'filled' : 'outline'}
                    onPress={() => setBizCurrency(c)}
                  />
                ))}
              </View>

              <Text style={styles.fieldLabel}>Pays</Text>
              <View style={styles.chipRow}>
                {COUNTRIES.map(c => (
                  <PrimaryButton
                    key={c.code}
                    label={c.label}
                    size="sm"
                    variant={bizCountry === c.code ? 'filled' : 'outline'}
                    onPress={() => setBizCountry(c.code)}
                  />
                ))}
              </View>

              <View style={styles.editActions}>
                <View style={styles.editActionBtn}>
                  <PrimaryButton
                    label="Annuler"
                    variant="outline"
                    onPress={handleCancelEdit}
                    size="md"
                  />
                </View>
                <View style={styles.editActionBtn}>
                  <PrimaryButton
                    label={savingBiz ? 'Sauvegarde...' : 'Enregistrer'}
                    onPress={handleSaveBusiness}
                    disabled={savingBiz || !bizHasChanges}
                    size="md"
                  />
                </View>
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nom</Text>
                <Text style={styles.infoValue}>
                  {businessInfo?.name ?? '—'}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Propriétaire</Text>
                <Text style={styles.infoValue}>
                  {businessInfo?.ownerName ?? '—'}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Code</Text>
                <Text style={[styles.infoValue, styles.codeValue]}>
                  {businessInfo?.businessCode ?? '—'}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Devise</Text>
                <Text style={styles.infoValue}>
                  {businessInfo?.currency ?? 'XOF'}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Pays</Text>
                <Text style={styles.infoValue}>
                  {businessInfo?.country
                    ? countryLabel(businessInfo.country)
                    : '—'}
                </Text>
              </View>

              <View style={styles.editBtnContainer}>
                <PrimaryButton
                  label="Modifier"
                  variant="outline"
                  onPress={() => setBizEditing(true)}
                  size="lg"
                />
              </View>
            </GlassCard>
          )}
        </>
      )}

      {/* Read-only business info for non-owners */}
      {profile && profile.role !== 'owner' && businessInfo && (
        <>
          <SectionHeader title="Mon entreprise" />
          <GlassCard style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nom</Text>
              <Text style={styles.infoValue}>{businessInfo.name}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Code</Text>
              <Text style={[styles.infoValue, styles.codeValue]}>
                {businessInfo.businessCode}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Devise</Text>
              <Text style={styles.infoValue}>{businessInfo.currency}</Text>
            </View>
          </GlassCard>
        </>
      )}

      {/* Contact Form */}
      <SectionHeader
        title="Nous contacter"
        subtitle="Une question, un bug, une suggestion ?"
      />
      <GlassCard style={styles.card}>
        <Text style={styles.fieldLabel}>Votre nom</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Fatou Ouédraogo"
          placeholderTextColor={theme.colors.textMuted}
          value={contactName}
          onChangeText={setContactName}
        />

        <Text style={styles.fieldLabel}>Votre message</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Décrivez votre demande..."
          placeholderTextColor={theme.colors.textMuted}
          value={contactMessage}
          onChangeText={setContactMessage}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <PrimaryButton
          label={sending ? 'Ouverture...' : 'Envoyer le message'}
          onPress={handleSendMessage}
          disabled={sending}
          size="lg"
        />
      </GlassCard>

      {/* Logout */}
      <View style={styles.logoutSection}>
        <PrimaryButton
          label="Se déconnecter"
          onPress={handleLogout}
          variant="outline"
        />
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        MonPetitBiz v{APP_VERSION} — Fait avec ❤️ au Burkina Faso
      </Text>
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },

  card: {
    marginBottom: theme.spacing.lg,
  },

  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  appIconContainer: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.chipBg,
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIcon: {
    fontSize: 28,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.3,
  },
  appTagline: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  versionRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  versionItem: {
    gap: 2,
  },
  versionLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  versionValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  codeValue: {
    fontFamily: 'monospace',
    letterSpacing: 2,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: theme.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.md,
    padding: 14,
    fontSize: 16,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  textArea: {
    minHeight: 120,
    marginBottom: theme.spacing.md,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },

  editActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  editActionBtn: {
    flex: 1,
  },
  editBtnContainer: {
    marginTop: theme.spacing.md,
  },

  logoutSection: {
    marginBottom: theme.spacing.xl,
  },

  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
});
