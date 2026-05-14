/**
 * Home / Dashboard Screen
 *
 * Glassmorphic Fitness Score card + Animated Macro Progress Ring
 * + XP/Streak gamification display + quick stats.
 *
 * All data powered by GET /dashboard.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useDashboard } from '@/hooks/useDashboard';
import { useAuth } from '@/lib/auth';
import FitnessScoreCard from '@/components/FitnessScoreCard';
import MacroProgressRing from '@/components/MacroProgressRing';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { data, isLoading, refetch } = useDashboard();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const gam = data?.gamification;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.lavender}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.userName}>
              {user?.full_name || 'Athlete'} 💪
            </Text>
          </View>
          <Pressable onPress={logout}>
            <LinearGradient
              colors={Colors.gradientPurpleCyan}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {(user?.full_name || 'A')[0].toUpperCase()}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* XP / Streak Bar */}
        {gam && (
          <View style={styles.xpBar}>
            <View style={styles.xpRow}>
              <View style={styles.xpBadge}>
                <LinearGradient
                  colors={Colors.gradientPurpleCyan}
                  style={styles.levelBadge}
                >
                  <Text style={styles.levelText}>Lv {gam.level}</Text>
                </LinearGradient>
              </View>
              <View style={styles.xpInfo}>
                <Text style={styles.xpLabel}>
                  {gam.total_xp} XP • {gam.xp_to_next_level} to next level
                </Text>
                <View style={styles.xpTrack}>
                  <LinearGradient
                    colors={Colors.gradientPurpleCyan}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.xpFill,
                      {
                        width: `${Math.min(
                          ((gam.level * 100 - gam.xp_to_next_level) / (gam.level * 100)) * 100,
                          100
                        )}%`,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.streakContainer}>
                <Text style={styles.streakFlame}>🔥</Text>
                <Text style={styles.streakCount}>{gam.current_streak}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Fitness Score Card */}
        <View style={styles.section}>
          <FitnessScoreCard
            score={data?.fitness_score ?? 0}
            calories={data?.calories_consumed ?? 0}
            steps={data?.steps ?? 0}
            sleepHours={data?.sleep_hours ?? 0}
            workoutsThisWeek={data?.workouts_this_week ?? 0}
          />
        </View>

        {/* Macro Progress Ring */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Macros</Text>
          <MacroProgressRing
            protein={data?.protein_g ?? 0}
            proteinTarget={data?.protein_target_g ?? 150}
            carbs={data?.carbs_g ?? 0}
            carbsTarget={data?.carbs_target_g ?? 220}
            fat={data?.fat_g ?? 0}
            fatTarget={data?.fat_target_g ?? 73}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <Pressable onPress={() => router.push('/(tabs)/workout')}>
              <ActionCard icon="🏋️" label="Log Workout" color={Colors.lavender} />
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/nutrition')}>
              <ActionCard icon="🥗" label="Log Meal" color={Colors.mint} />
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/coach')}>
              <ActionCard icon="🤖" label="Ask Coach" color={Colors.coral} />
            </Pressable>
          </View>
        </View>

        {/* Calorie Summary */}
        {data && (
          <View style={styles.section}>
            <View style={styles.calCard}>
              <View style={styles.calHeader}>
                <Text style={styles.calTitle}>Calorie Budget</Text>
                <Text style={styles.calTarget}>{data.calories_target} kcal target</Text>
              </View>
              <View style={styles.calBarTrack}>
                <LinearGradient
                  colors={
                    data.calories_consumed > data.calories_target
                      ? ['#E87878', '#C0392B']
                      : (Colors.gradientMintSky as any)
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.calBarFill,
                    {
                      width: `${Math.min(
                        (data.calories_consumed / data.calories_target) * 100,
                        100
                      )}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.calStats}>
                <View>
                  <Text style={styles.calStatValue}>{data.calories_consumed}</Text>
                  <Text style={styles.calStatLabel}>consumed</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.calStatValue, { color: Colors.mint }]}>
                    {Math.max(0, data.calories_target - data.calories_consumed)}
                  </Text>
                  <Text style={styles.calStatLabel}>remaining</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.calStatValue}>{data.calories_target}</Text>
                  <Text style={styles.calStatLabel}>target</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionCard({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={[styles.actionCard, { borderColor: color + '30' }]}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  greeting: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#000',
  },

  // XP Bar
  xpBar: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  xpBadge: {},
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  levelText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#000',
  },
  xpInfo: {
    flex: 1,
    gap: 4,
  },
  xpLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  xpTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpFill: {
    height: 4,
    borderRadius: 2,
  },
  streakContainer: {
    alignItems: 'center',
    minWidth: 40,
  },
  streakFlame: {
    fontSize: 20,
  },
  streakCount: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.gold,
  },

  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  actionCard: {
    width: 105,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },

  // Calorie card
  calCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  calTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  calTarget: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  calBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  calBarFill: {
    height: 8,
    borderRadius: 4,
  },
  calStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calStatValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  calStatLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
