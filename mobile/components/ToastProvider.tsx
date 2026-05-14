/**
 * Toast notification system — lightweight provider for success/error/info toasts.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast('Workout generated!', 'success');
 *   showToast('Network error', 'error');
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
} from 'react-native';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing } from '@/constants/theme';

type ToastType = 'success' | 'error' | 'info';

interface ToastConfig {
  message: string;
  type: ToastType;
  duration?: number;
  action?: { label: string; onPress: () => void };
}

interface ToastContextType {
  showToast: (
    message: string,
    type?: ToastType,
    options?: { duration?: number; action?: { label: string; onPress: () => void } }
  ) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: 'rgba(126, 222, 196, 0.12)',
    border: 'rgba(126, 222, 196, 0.30)',
    text: Colors.mint,
    icon: '✅',
  },
  error: {
    bg: 'rgba(232, 120, 120, 0.12)',
    border: 'rgba(232, 120, 120, 0.30)',
    text: Colors.error,
    icon: '⚠️',
  },
  info: {
    bg: 'rgba(126, 200, 227, 0.12)',
    border: 'rgba(126, 200, 227, 0.30)',
    text: Colors.sky,
    icon: 'ℹ️',
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  }, [translateY, opacity]);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = 'info',
      options?: { duration?: number; action?: { label: string; onPress: () => void } }
    ) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      setToast({ message, type, duration: options?.duration, action: options?.action });

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      timeoutRef.current = setTimeout(hideToast, options?.duration ?? 3500);
    },
    [translateY, opacity, hideToast]
  );

  const colors = toast ? TOAST_COLORS[toast.type] : TOAST_COLORS.info;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: colors.bg,
              borderColor: colors.border,
              transform: [{ translateY }],
              opacity,
            },
          ]}
          pointerEvents="box-none"
        >
          <Pressable onPress={hideToast} style={styles.content}>
            <Text style={styles.icon}>{colors.icon}</Text>
            <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.action && (
              <Pressable
                onPress={() => {
                  toast.action?.onPress();
                  hideToast();
                }}
                style={[styles.actionBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.actionText, { color: colors.text }]}>
                  {toast.action.label}
                </Text>
              </Pressable>
            )}
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: Spacing.md,
    right: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  icon: {
    fontSize: 18,
  },
  message: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    lineHeight: 18,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});
