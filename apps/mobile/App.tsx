import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppNavigator} from './src/navigation/AppNavigator';
import {AuthContext} from './src/auth/auth-context';
import {tokenStorage} from './src/storage/token-storage';
import {UserProfile} from './src/api/types';

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      const token = await tokenStorage.getAccessToken();
      setAccessToken(token);
      setLoading(false);
    };

    void loadToken();
  }, []);

  const authValue = useMemo(
    () => ({accessToken, setAccessToken, profile, setProfile}),
    [accessToken, profile],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthContext.Provider value={authValue}>
        <AppNavigator />
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
