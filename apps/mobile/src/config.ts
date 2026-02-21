import Constants from 'expo-constants';

const defaultApiUrl = 'http://localhost:3000';

export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl ?? defaultApiUrl;
