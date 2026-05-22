/**
 * Auth context — manages JWT token and user session state.
 *
 * After login/register, checks `is_onboarded` to route to either
 * the onboarding wizard or the main app tabs.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authApi } from './api';
import { router } from 'expo-router';

interface User {
  id: string;
  email: string;
  full_name: string;
  is_onboarded: boolean;
  age?: number;
  gender?: string;
  weight_kg?: number;
  height_cm?: number;
  goal_weight_kg?: number;
  bmr?: number;
  tdee?: number;
  fitness_goal?: string;
  activity_level?: string;
  blood_group?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        setUser(null);
        return;
      }
      const { data } = await authApi.me();
      setUser(data);
    } catch {
      setUser(null);
      await SecureStore.deleteItemAsync('access_token').catch(() => {});
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const navigateAfterAuth = useCallback((userData: User) => {
    if (!userData.is_onboarded) {
      router.replace('/(auth)/onboarding');
    } else {
      router.replace('/(tabs)');
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login({ email, password });
    await SecureStore.setItemAsync('access_token', data.access_token);
    const { data: userData } = await authApi.me();
    setUser(userData);
    navigateAfterAuth(userData);
  }, [navigateAfterAuth]);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    await authApi.register({ email, password, full_name: fullName });
    // Auto-login after registration
    const { data } = await authApi.login({ email, password });
    await SecureStore.setItemAsync('access_token', data.access_token);
    const { data: userData } = await authApi.me();
    setUser(userData);
    navigateAfterAuth(userData);
  }, [navigateAfterAuth]);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync('access_token').catch(() => {});
    setUser(null);
    router.replace('/(auth)/login');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
