import {useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import {RouteProp, useRoute} from '@react-navigation/native';
import {lookupBusinessByCode, registerEmployee} from '../api/mobile-api';
import {PrimaryButton} from '../components/PrimaryButton';
import {GlassCard} from '../components/GlassCard';
import {useAuth} from '../auth/auth-context';
import {tokenStorage} from '../storage/token-storage';
import {AuthStackParamList} from '../navigation/types';
import {theme} from '../theme';

type JoinBusinessRouteProp = RouteProp<AuthStackParamList, 'JoinBusiness'>;

export const JoinBusinessScreen = () => {
  const route = useRoute<JoinBusinessRouteProp>();
  const {setAccessToken, setProfile} = useAuth();

  const [phoneNumber, setPhoneNumber] = useState(
    route.params?.phoneNumber ?? '',
  );
  const [businessCode, setBusinessCode] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [loading, setLoading] = useState(false);

  const [lookupDone, setLookupDone] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [resolvedBusinessCode, setResolvedBusinessCode] = useState('');

  const handleLookup = async () => {
    const code = businessCode.trim().toUpperCase();
    if (code.length !== 6) {
      Alert.alert('Erreur', 'Le code doit contenir 6 caractères.');
      return;
    }
    try {
      setLookingUp(true);
      const info = await lookupBusinessByCode(code);
      setBusinessName(info.businessName);
      setResolvedBusinessCode(info.businessCode);
      setLookupDone(true);
    } catch {
      Alert.alert(
        'Code invalide',
        "Aucune entreprise trouvée pour ce code. Vérifiez avec votre patron.",
      );
      setLookupDone(false);
    } finally {
      setLookingUp(false);
    }
  };

  const handleRegister = async () => {
    if (!phoneNumber.trim() || !employeeName.trim() || !resolvedBusinessCode) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }

    try {
      setLoading(true);
      const result = await registerEmployee({
        phoneNumber: phoneNumber.trim(),
        businessCode: resolvedBusinessCode,
        employeeName: employeeName.trim(),
        role: 'seller',
        language: 'fr',
      });
      await tokenStorage.setAccessToken(result.accessToken);
      setAccessToken(result.accessToken);
      setProfile(result.user);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('[JoinBusiness] failed', message);
      Alert.alert(
        'Erreur',
        "Impossible de rejoindre l'entreprise. Vérifiez le code et vos informations.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerIcon}>{'👥'}</Text>
          <Text style={styles.title}>Rejoindre une entreprise</Text>
          <Text style={styles.subtitle}>
            Entrez le code fourni par votre patron pour rejoindre son entreprise
          </Text>
        </View>

        <GlassCard style={styles.formCard}>
          {/* Step 1: Business code lookup */}
          <View style={styles.field}>
            <Text style={styles.label}>Code de l'entreprise</Text>
            <View style={styles.codeRow}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="Ex: ABC123"
                placeholderTextColor={theme.colors.textMuted}
                value={businessCode}
                onChangeText={text => {
                  setBusinessCode(text.toUpperCase());
                  setLookupDone(false);
                }}
                autoCapitalize="characters"
                maxLength={6}
              />
              <TouchableOpacity
                style={[
                  styles.lookupButton,
                  lookingUp && styles.lookupButtonDisabled,
                ]}
                onPress={handleLookup}
                disabled={lookingUp || businessCode.trim().length < 6}>
                {lookingUp ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.lookupButtonText}>Vérifier</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {lookupDone && (
            <View style={styles.businessBanner}>
              <Text style={styles.businessBannerLabel}>Entreprise trouvée</Text>
              <Text style={styles.businessBannerName}>{businessName}</Text>
            </View>
          )}

          {/* Step 2: Employee info (shown after lookup) */}
          {lookupDone && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Numéro de téléphone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+226 XX XX XX XX"
                  placeholderTextColor={theme.colors.textMuted}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Votre nom</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Abdoul Kader"
                  placeholderTextColor={theme.colors.textMuted}
                  value={employeeName}
                  onChangeText={setEmployeeName}
                />
              </View>

              <PrimaryButton
                label={loading ? 'Inscription...' : "Rejoindre l'entreprise"}
                onPress={handleRegister}
                disabled={loading}
                size="lg"
              />
            </>
          )}
        </GlassCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.xl,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.3,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  formCard: {
    gap: theme.spacing.md,
  },
  field: {
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radii.md,
    padding: 14,
    fontSize: 16,
    color: theme.colors.text,
  },
  codeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  codeInput: {
    flex: 1,
    letterSpacing: 4,
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
  },
  lookupButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.md,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  lookupButtonDisabled: {
    opacity: 0.6,
  },
  lookupButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  businessBanner: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    alignItems: 'center',
  },
  businessBannerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  businessBannerName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
});
