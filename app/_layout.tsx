/**
 * Root layout — wraps the entire app with providers.
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { View, StyleSheet } from 'react-native';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/ToastProvider';
import { Colors } from '@/constants/theme';

import { useAuth } from '@/lib/auth';
import { useRouter, useSegments } from 'expo-router';

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const isIndex = segments.length === 0;

    if (!user) {
      if (!inAuthGroup && !isIndex) {
        router.replace('/(auth)/login');
      }
    } else {
      // User is logged in
      if (inAuthGroup && segments[1] !== 'onboarding') {
        if (!user.is_onboarded) {
          router.replace('/(auth)/onboarding');
        } else {
          router.replace('/(tabs)');
        }
      } else if (isIndex) {
        // If on landing page but logged in, go to tabs
        if (!user.is_onboarded) {
          router.replace('/(auth)/onboarding');
        } else {
          router.replace('/(tabs)');
        }
      }
    }
  }, [user, isLoading, segments, router]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'fade',
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RootLayoutNav />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
