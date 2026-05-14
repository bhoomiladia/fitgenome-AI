/**
 * Difficulty Slider — Custom gradient slider (1-10) with haptic feedback.
 *
 * Sends real-time difficulty feedback to the API on release.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { useWorkoutFeedback } from '@/hooks/useWorkout';

interface DifficultySliderProps {
  onSubmit?: (rating: number) => void;
}

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const LABELS: Record<number, string> = {
  1: 'Very Easy',
  2: 'Easy',
  3: 'Light',
  4: 'Moderate',
  5: 'Challenging',
  6: 'Hard',
  7: 'Very Hard',
  8: 'Intense',
  9: 'Brutal',
  10: 'Maximal',
};

function getGradientForLevel(level: number): readonly [string, string] {
  if (level <= 3) return [Colors.mint, '#A8E6CF'] as const;
  if (level <= 5) return [Colors.gold, '#F7DC6F'] as const;
  if (level <= 7) return [Colors.coral, '#F0B27A'] as const;
  return ['#E87878', '#C0392B'] as const;
}

export default function DifficultySlider({ onSubmit }: DifficultySliderProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const feedbackMutation = useWorkoutFeedback();
  const scale = useSharedValue(1);

  const handleSelect = useCallback(async (level: number) => {
    await Haptics.impactAsync(
      level <= 3
        ? Haptics.ImpactFeedbackStyle.Light
        : level <= 7
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy
    );
    setSelected(level);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selected) return;

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    feedbackMutation.mutate({ difficulty_rating: selected });
    onSubmit?.(selected);
  }, [selected, feedbackMutation, onSubmit]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value) }],
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How was this workout?</Text>
      <Text style={styles.subtitle}>
        {selected ? LABELS[selected] : 'Rate your perceived difficulty'}
      </Text>

      {/* Level Buttons */}
      <View style={styles.levelsRow}>
        {LEVELS.map((level) => {
          const isSelected = selected === level;
          const gradient = getGradientForLevel(level);

          return (
            <Pressable
              key={level}
              onPress={() => handleSelect(level)}
              style={styles.levelButton}
            >
              {isSelected ? (
                <LinearGradient
                  colors={gradient}
                  style={[styles.levelCircle, styles.levelCircleActive]}
                >
                  <Text style={[styles.levelText, styles.levelTextActive]}>
                    {level}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.levelCircle}>
                  <Text style={styles.levelText}>{level}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Scale labels */}
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabel}>Easy</Text>
        <Text style={styles.scaleLabel}>Maximal</Text>
      </View>

      {/* Submit Button */}
      {selected && (
        <Animated.View style={buttonStyle}>
          <Pressable
            style={styles.submitButton}
            onPress={handleSubmit}
            onPressIn={() => { scale.value = 0.95; }}
            onPressOut={() => { scale.value = 1; }}
          >
            <LinearGradient
              colors={getGradientForLevel(selected)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              <Text style={styles.submitText}>
                {feedbackMutation.isPending ? 'Sending...' : 'Submit Feedback'}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}

      {feedbackMutation.isSuccess && feedbackMutation.data && (
        <Text style={styles.feedbackMessage}>
          {feedbackMutation.data.message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
    minHeight: 18,
  },
  levelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  levelButton: {
    flex: 1,
    alignItems: 'center',
  },
  levelCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  levelCircleActive: {
    borderColor: 'transparent',
    shadowColor: '#fff',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  levelText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textMuted,
  },
  levelTextActive: {
    color: '#000',
    fontWeight: FontWeight.bold,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  scaleLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  submitButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  submitGradient: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  submitText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#000',
  },
  feedbackMessage: {
    fontSize: FontSize.sm,
    color: Colors.mint,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
