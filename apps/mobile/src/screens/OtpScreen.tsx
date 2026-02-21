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
} from 'react-native';
import {
  RouteProp,
  useRoute,
  useNavigation,
} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {verifyOtp, fetchDevOtp} from '../api/mobile-api';
import {UserProfile} from '../api/types';
import {PrimaryButton} from '../components/PrimaryButton';
import {GlassCard} from '../components/GlassCard';
import {AuthStackParamList} from '../navigation/types';
import {useAuth} from '../auth/auth-context';
import {tokenStorage} from '../storage/token-storage';
import {theme} from '../theme';

type OtpScreenRouteProp = RouteProp<AuthStackParamList, 'Otp'>;
type OtpScreenNavProp = NativeStackNavigationProp<AuthStackParamList, 'Otp'>;

export const OtpScreen = () => {
  const route = useRoute<OtpScreenRouteProp>();
  const navigation = useNavigation<OtpScreenNavProp>();
  const {setAccessToken, setProfile} = useAuth();
  const [code, setCode] = useState(route.params.devCode ?? '');
  const [loading, setLoading] = useState(false);
  const [fetchingCode, setFetchingCode] = useState(false);

  const handleFetchCode = async () => {
    try {
      setFetchingCode(true);
      const devCode = await fetchDevOtp(route.params.phoneNumber);
      if (devCode) {
        setCode(devCode);
      } else {
        Alert.alert(
          'Info',
          'Aucun code actif. Envoyez d\'abord un nouveau code depuis l\'écran précédent.',
        );
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer le code.');
    } finally {
      setFetchingCode(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le code OTP.');
      return;
    }

    try {
      setLoading(true);
      const result = (await verifyOtp(route.params.phoneNumber, code.trim())) as {
        data?: {accessToken: string; user: unknown};
        needsRegistration?: boolean;
        phoneNumber?: string;
      };
      if (result.needsRegistration && result.phoneNumber) {
        navigation.navigate('RegisterBusiness', {
          phoneNumber: result.phoneNumber,
        });
        return;
      }
      const auth = result.data;
      if (auth?.accessToken && auth?.user) {
        await tokenStorage.setAccessToken(auth.accessToken);
        setAccessToken(auth.accessToken);
        setProfile(auth.user as UserProfile);
      }
    } catch {
      Alert.alert('Erreur', 'Code invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{'🔐'}</Text>
        </View>

        <Text style={styles.title}>Vérification</Text>
        <Text style={styles.label}>
          Code envoyé au{' '}
          <Text style={styles.phone}>{route.params.phoneNumber}</Text>
        </Text>

        <GlassCard style={styles.card}>
          {(route.params.devCode || code) && (
            <View style={styles.devBanner}>
              <Text style={styles.devBannerText}>
                Mode dev — code : {route.params.devCode ?? code}
              </Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="• • • • • •"
            placeholderTextColor={theme.colors.textMuted}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoCapitalize="none"
            textAlign="center"
            maxLength={6}
          />

          <PrimaryButton
            label={loading ? 'Validation...' : 'Valider'}
            onPress={handleVerify}
            disabled={loading}
            size="lg"
          />

          <TouchableOpacity
            onPress={handleFetchCode}
            disabled={fetchingCode || loading}
            style={styles.fetchLink}>
            <Text style={styles.fetchLinkText}>
              {fetchingCode ? 'Récupération...' : 'Récupérer le code (dev)'}
            </Text>
          </TouchableOpacity>
        </GlassCard>
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
  iconContainer: {
    alignSelf: 'center',
    marginBottom: theme.spacing.lg,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  label: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  phone: {
    color: theme.colors.primaryLight,
    fontWeight: '600',
  },
  card: {
    gap: theme.spacing.md,
  },
  devBanner: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: theme.radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  devBannerText: {
    fontSize: 13,
    color: theme.colors.success,
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radii.md,
    padding: 16,
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: 8,
  },
  fetchLink: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  fetchLinkText: {
    fontSize: 13,
    color: theme.colors.accent,
    textDecorationLine: 'underline',
  },
});
