import {createContext, useContext} from 'react';
import {UserProfile} from '../api/types';

type AuthContextValue = {
  accessToken: string | null;
  profile: UserProfile | null;
  setAccessToken: (token: string | null) => void;
  setProfile: (profile: UserProfile | null) => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthContext provider');
  }
  return context;
};
