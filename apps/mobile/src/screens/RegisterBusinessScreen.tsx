import {useState} from 'react';
import {Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View, ScrollView} from 'react-native';
import {RouteProp, useRoute} from '@react-navigation/native';
import {registerBusinessOwner} from '../api/mobile-api';
import {PrimaryButton} from '../components/PrimaryButton';
import {GlassCard} from '../components/GlassCard';
import {useAuth} from '../auth/auth-context';
import {tokenStorage} from '../storage/token-storage';
import {AuthStackParamList} from '../navigation/types';
import {theme} from '../theme';

type RegisterBusinessRouteProp = RouteProp<
  AuthStackParamList,
  'RegisterBusiness'
>;

export const RegisterBusinessScreen = () => {
  const route = useRoute<RegisterBusinessRouteProp>();
  const {setAccessToken, setProfile} = useAuth();
  const [phoneNumber, setPhoneNumber] = useState(
    route.params?.phoneNumber ?? '',
  );
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!phoneNumber.trim() || !businessName.trim() || !ownerName.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }

    try {
      setLoading(true);
      const result = await registerBusinessOwner({
        phoneNumber: phoneNumber.trim(),
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        language: 'fr',
      });
      await tokenStorage.setAccessToken(result.accessToken);
      setAccessToken(result.accessToken);
      setProfile(result.user);
      Alert.alert('Succès', result.message);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('[RegisterBusiness] failed', message);
      Alert.alert(
        'Erreur',
        "Impossible d'enregistrer l'entreprise. Vérifiez les informations.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.headerIcon}>{'🏪'}</Text>
        <Text style={styles.title}>Nouvelle entreprise</Text>
        <Text style={styles.subtitle}>
          Créez votre espace de gestion en quelques secondes
        </Text>
      </View>

      <GlassCard style={styles.formCard}>
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
          <Text style={styles.label}>Nom de l'entreprise</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Boutique Fatou"
            placeholderTextColor={theme.colors.textMuted}
            value={businessName}
            onChangeText={setBusinessName}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Nom du propriétaire</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Fabrice Ilboudo"
            placeholderTextColor={theme.colors.textMuted}
            value={ownerName}
            onChangeText={setOwnerName}
          />
        </View>

        <PrimaryButton
          label={loading ? 'Création...' : 'Créer mon entreprise'}
          onPress={handleRegister}
          disabled={loading}
          size="lg"
        />
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
});
