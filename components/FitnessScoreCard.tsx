/**
 * Glassmorphic Daily Fitness Score card.
 *
 * Semi-transparent card with backdrop blur showing an
 * animated fitness score (0-100) with a circular gauge.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
  useDerivedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface FitnessScoreCardProps {
  score: number; // 0-100
  calories: number;
  steps: number;
  sleepHours: number;
  workoutsThisWeek: number;
}

const CIRCLE_RADIUS = 52;
const STROKE_WIDTH = 8;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

export default function FitnessScoreCard({
  score,
  calories,
  steps,
  sleepHours,
  workoutsThisWeek,
}: FitnessScoreCardProps) {
  const progress = useSharedValue(0);
  const displayScore = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(score / 100, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    });
    displayScore.value = withTiming(score, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    });
  }, [score]);

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const scoreText = useDerivedValue(() => `${Math.round(displayScore.value)}`);

  const scoreStyle = useAnimatedStyle(() => ({
    opacity: withTiming(1, { duration: 800 }),
  }));

  const getScoreColor = () => {
    if (score >= 80) return Colors.mint;
    if (score >= 60) return Colors.gold;
    return Colors.coral;
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={25} tint="dark" style={styles.blur}>
        <LinearGradient
          colors={['rgba(184,169,232,0.08)', 'rgba(126,200,227,0.04)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.content}>
            {/* Score Circle */}
            <View style={styles.scoreSection}>
              <View style={styles.circleContainer}>
                <Svg
                  width={CIRCLE_RADIUS * 2 + STROKE_WIDTH * 2}
                  height={CIRCLE_RADIUS * 2 + STROKE_WIDTH * 2}
                  viewBox={`0 0 ${(CIRCLE_RADIUS + STROKE_WIDTH) * 2} ${(CIRCLE_RADIUS + STROKE_WIDTH) * 2}`}
                >
                  {/* Background circle */}
                  <Circle
                    cx={CIRCLE_RADIUS + STROKE_WIDTH}
                    cy={CIRCLE_RADIUS + STROKE_WIDTH}
                    r={CIRCLE_RADIUS}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                  />
                  {/* Animated progress circle */}
                  <AnimatedCircle
                    cx={CIRCLE_RADIUS + STROKE_WIDTH}
                    cy={CIRCLE_RADIUS + STROKE_WIDTH}
                    r={CIRCLE_RADIUS}
                    stroke={getScoreColor()}
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                    strokeDasharray={CIRCUMFERENCE}
                    animatedProps={animatedCircleProps}
                    strokeLinecap="round"
                    rotation="-90"
                    origin={`${CIRCLE_RADIUS + STROKE_WIDTH}, ${CIRCLE_RADIUS + STROKE_WIDTH}`}
                  />
                </Svg>
                <View style={styles.scoreTextContainer}>
                  <Animated.Text style={[styles.scoreValue, scoreStyle, { color: getScoreColor() }]}>
                    {Math.round(score)}
                  </Animated.Text>
                  <Text style={styles.scoreLabel}>Score</Text>
                </View>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsSection}>
              <Text style={styles.title}>Daily Fitness Score</Text>
              <View style={styles.statsGrid}>
                <StatItem icon="🔥" value={`${calories}`} label="kcal" />
                <StatItem icon="👟" value={`${steps.toLocaleString()}`} label="steps" />
                <StatItem icon="😴" value={`${sleepHours}h`} label="sleep" />
                <StatItem icon="💪" value={`${workoutsThisWeek}`} label="workouts" />
              </View>
            </View>
          </View>
        </LinearGradient>
      </BlurView>
    </View>
  );
}

function StatItem({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  blur: {
    overflow: 'hidden',
    borderRadius: BorderRadius.xl,
  },
  gradient: {
    padding: Spacing.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreSection: {
    marginRight: Spacing.lg,
  },
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreTextContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  scoreLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  statsSection: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statItem: {
    width: '45%',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  statIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  statValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
