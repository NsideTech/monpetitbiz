import {useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {sendOtp} from '../api/mobile-api';
import {PrimaryButton} from '../components/PrimaryButton';
import {AuthStackParamList} from '../navigation/types';
import {theme} from '../theme';

type AuthScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Auth'
>;

export const AuthScreen = () => {
  const navigation = useNavigation<AuthScreenNavigationProp>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un numéro de téléphone.');
      return;
    }

    try {
      setLoading(true);
      const result = await sendOtp(phoneNumber.trim());
      navigation.navigate('Otp', {
        phoneNumber: phoneNumber.trim(),
        devCode: result.code,
      });
    } catch (error) {
      const isNetworkError =
        error instanceof TypeError ||
        (error instanceof Error &&
          (/fetch|network|connection|refused/i.test(error.message) ||
            error.message === 'Network request failed'));
      Alert.alert(
        'Erreur',
        isNetworkError
          ? 'Impossible de joindre le serveur. Vérifiez que le backend tourne et que votre téléphone est sur le même WiFi.'
          : "Impossible d'envoyer le code OTP.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterBusiness = () => {
    navigation.navigate('RegisterBusiness', {});
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoGlow} />
          <Text style={styles.logoIcon}>{'💼'}</Text>
        </View>

        <Text style={styles.title}>MonPetitBiz</Text>
        <Text style={styles.subtitle}>
          Gérez vos ventes, stocks et dépenses au quotidien
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Numéro de téléphone</Text>
          <View style={styles.inputContainer}>
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
          <PrimaryButton
            label={loading ? 'Envoi...' : 'Envoyer le code'}
            onPress={handleSendOtp}
            disabled={loading}
            size="lg"
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <PrimaryButton
          label="Créer une nouvelle entreprise"
          onPress={handleRegisterBusiness}
          variant="outline"
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
  },
  content: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  logoContainer: {
    alignSelf: 'center',
    marginBottom: theme.spacing.lg,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    opacity: 0.2,
  },
  logoIcon: {
    fontSize: 36,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radii.md,
    padding: 16,
    fontSize: 17,
    color: theme.colors.text,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
