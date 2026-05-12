/**
 * Animated Macro Progress Ring — triple ring for Protein / Carbs / Fat.
 *
 * Each ring animates from 0 to the current percentage with smooth easing.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface MacroRingProps {
  protein: number;
  proteinTarget: number;
  carbs: number;
  carbsTarget: number;
  fat: number;
  fatTarget: number;
}

interface RingConfig {
  label: string;
  value: number;
  target: number;
  color: string;
  radius: number;
}

const CENTER = 80;
const STROKE = 10;

export default function MacroProgressRing({
  protein,
  proteinTarget,
  carbs,
  carbsTarget,
  fat,
  fatTarget,
}: MacroRingProps) {
  const rings: RingConfig[] = [
    { label: 'Protein', value: protein, target: proteinTarget, color: Colors.protein, radius: 65 },
    { label: 'Carbs', value: carbs, target: carbsTarget, color: Colors.carbs, radius: 50 },
    { label: 'Fat', value: fat, target: fatTarget, color: Colors.fat, radius: 35 },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.ringContainer}>
        <Svg width={CENTER * 2} height={CENTER * 2}>
          {rings.map((ring, index) => (
            <AnimatedRing key={ring.label} ring={ring} delay={index * 200} />
          ))}
        </Svg>
        <View style={styles.centerText}>
          <Text style={styles.centerValue}>
            {Math.round(((protein + carbs + fat) / (proteinTarget + carbsTarget + fatTarget)) * 100)}%
          </Text>
          <Text style={styles.centerLabel}>macros</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {rings.map((ring) => (
          <View key={ring.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ring.color }]} />
            <View>
              <Text style={styles.legendLabel}>{ring.label}</Text>
              <Text style={styles.legendValue}>
                {ring.value}g / {ring.target}g
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function AnimatedRing({ ring, delay }: { ring: RingConfig; delay: number }) {
  const circumference = 2 * Math.PI * ring.radius;
  const progress = useSharedValue(0);
  const percentage = Math.min(ring.value / ring.target, 1);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(percentage, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [percentage]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <>
      {/* Background track */}
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={ring.radius}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={STROKE}
        fill="none"
      />
      {/* Animated progress */}
      <AnimatedCircle
        cx={CENTER}
        cy={CENTER}
        r={ring.radius}
        stroke={ring.color}
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={circumference}
        animatedProps={animatedProps}
        strokeLinecap="round"
        rotation="-90"
        origin={`${CENTER}, ${CENTER}`}
      />
    </>
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
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
  },
  centerValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  centerLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  legendValue: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
