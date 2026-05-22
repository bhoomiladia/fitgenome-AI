/**
 * Home / Dashboard Screen
 *
 * Glassmorphic Fitness Score card + Animated Macro Progress Ring
 * + XP/Streak gamification display + quick stats.
 *
 * All data powered by GET /dashboard.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useDashboard } from '@/hooks/useDashboard';
import { useAuth } from '@/lib/auth';
import { useUpdateUser } from '@/hooks/useUser';
import { useToast } from '@/components/ToastProvider';
import FitnessScoreCard from '@/components/FitnessScoreCard';
import MacroProgressRing from '@/components/MacroProgressRing';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

const GENDERS = [
  { value: 'male', label: 'Male', emoji: '🧔' },
  { value: 'female', label: 'Female', emoji: '👩' },
  { value: 'other', label: 'Other', emoji: '🧑' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', emoji: '🪑' },
  { value: 'light', label: 'Light', emoji: '🚶' },
  { value: 'moderate', label: 'Moderate', emoji: '🏃' },
  { value: 'active', label: 'Active', emoji: '💪' },
  { value: 'very_active', label: 'Very Active', emoji: '🏆' },
];

const FITNESS_GOALS = [
  { value: 'lose_weight', label: 'Lose Weight', emoji: '🔥' },
  { value: 'maintain', label: 'Maintain', emoji: '⚖️' },
  { value: 'build_muscle', label: 'Build Muscle', emoji: '💪' },
  { value: 'improve_endurance', label: 'Endurance', emoji: '🏃' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function HomeScreen() {
  const { user, logout, refreshUser } = useAuth();
  const { data, isLoading, refetch } = useDashboard();
  const updateUser = useUpdateUser();
  const { showToast } = useToast();

  const [refreshing, setRefreshing] = React.useState(false);
  const [profileModalVisible, setProfileModalVisible] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);

  // Form states
  const [fullName, setFullName] = React.useState('');
  const [age, setAge] = React.useState('');
  const [gender, setGender] = React.useState('');
  const [height, setHeight] = React.useState('');
  const [weight, setWeight] = React.useState('');
  const [activityLevel, setActivityLevel] = React.useState('');
  const [fitnessGoal, setFitnessGoal] = React.useState('');
  const [bloodGroup, setBloodGroup] = React.useState('');

  React.useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setAge(user.age?.toString() || '');
      setGender(user.gender || '');
      setHeight(user.height_cm?.toString() || '');
      setWeight(user.weight_kg?.toString() || '');
      setActivityLevel(user.activity_level || '');
      setFitnessGoal(user.fitness_goal || '');
      setBloodGroup(user.blood_group || '');
    }
  }, [user, profileModalVisible]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleSaveProfile = () => {
    const parsedAge = parseInt(age);
    const parsedHeight = parseFloat(height);
    const parsedWeight = parseFloat(weight);

    if (!fullName.trim()) {
      showToast('Please enter your full name', 'error');
      return;
    }
    if (age && (isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 150)) {
      showToast('Please enter a valid age (1-150)', 'error');
      return;
    }
    if (height && (isNaN(parsedHeight) || parsedHeight <= 0 || parsedHeight > 300)) {
      showToast('Please enter a valid height in cm (1-300)', 'error');
      return;
    }
    if (weight && (isNaN(parsedWeight) || parsedWeight <= 0 || parsedWeight > 500)) {
      showToast('Please enter a valid weight in kg (1-500)', 'error');
      return;
    }

    const updatedData: any = {
      full_name: fullName.trim(),
      gender: gender || null,
      activity_level: activityLevel || null,
      fitness_goal: fitnessGoal || null,
      blood_group: bloodGroup || null,
    };

    if (age) updatedData.age = parsedAge;
    if (height) updatedData.height_cm = parsedHeight;
    if (weight) updatedData.weight_kg = parsedWeight;

    updateUser.mutate(updatedData, {
      onSuccess: async () => {
        await refreshUser();
        showToast('Profile updated successfully! 🎉', 'success');
        setIsEditing(false);
      },
      onError: (err: any) => {
        showToast(
          err.response?.data?.detail || 'Failed to update profile',
          'error'
        );
      },
    });
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out from FitGenome AI?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            setProfileModalVisible(false);
            await logout();
          }
        }
      ]
    );
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
          <Pressable onPress={() => setProfileModalVisible(true)}>
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

      {/* Profile & Settings Modal */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (isEditing) {
            setIsEditing(false);
          } else {
            setProfileModalVisible(false);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditing ? 'Edit Profile' : 'Profile & Biometrics'}
              </Text>
              <Pressable
                onPress={() => {
                  if (isEditing) {
                    setIsEditing(false);
                  } else {
                    setProfileModalVisible(false);
                  }
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {isEditing ? (
                /* EDIT PROFILE MODE */
                <View style={styles.formContainer}>
                  <View style={styles.field}>
                    <Text style={styles.formLabel}>Full Name</Text>
                    <TextInput
                      style={styles.formInput}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Enter full name"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  <View style={styles.formRow}>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.formLabel}>Age (yrs)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={age}
                        onChangeText={setAge}
                        keyboardType="number-pad"
                        placeholder="Age"
                        placeholderTextColor={Colors.textMuted}
                        maxLength={3}
                      />
                    </View>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.formLabel}>Blood Group</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.bloodGroupScroll}
                        style={styles.bloodGroupSelect}
                      >
                        {BLOOD_GROUPS.map((bg) => (
                          <Pressable
                            key={bg}
                            onPress={() => setBloodGroup(bg)}
                            style={[
                              styles.bloodChip,
                              bloodGroup === bg && styles.bloodChipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.bloodChipText,
                                bloodGroup === bg && styles.bloodChipTextActive,
                              ]}
                            >
                              {bg}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.formLabel}>Height (cm)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={height}
                        onChangeText={setHeight}
                        keyboardType="decimal-pad"
                        placeholder="Height"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.formLabel}>Weight (kg)</Text>
                      <TextInput
                        style={styles.formInput}
                        value={weight}
                        onChangeText={setWeight}
                        keyboardType="decimal-pad"
                        placeholder="Weight"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                  </View>

                  <View style={styles.chipsGroup}>
                    <Text style={styles.formLabel}>Gender</Text>
                    <View style={styles.chipsRow}>
                      {GENDERS.map((g) => (
                        <Pressable
                          key={g.value}
                          onPress={() => setGender(g.value)}
                          style={[
                            styles.chip,
                            gender === g.value && styles.chipActive,
                          ]}
                        >
                          <Text style={styles.chipEmoji}>{g.emoji}</Text>
                          <Text
                            style={[
                              styles.chipText,
                              gender === g.value && styles.chipTextActive,
                            ]}
                          >
                            {g.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.chipsGroup}>
                    <Text style={styles.formLabel}>Fitness Goal</Text>
                    <View style={styles.chipsGrid}>
                      {FITNESS_GOALS.map((fg) => (
                        <Pressable
                          key={fg.value}
                          onPress={() => setFitnessGoal(fg.value)}
                          style={[
                            styles.gridChip,
                            fitnessGoal === fg.value && styles.gridChipActive,
                          ]}
                        >
                          <Text style={styles.chipEmoji}>{fg.emoji}</Text>
                          <Text
                            style={[
                              styles.chipText,
                              fitnessGoal === fg.value && styles.chipTextActive,
                            ]}
                          >
                            {fg.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.chipsGroup}>
                    <Text style={styles.formLabel}>Activity Level</Text>
                    <View style={styles.chipsGrid}>
                      {ACTIVITY_LEVELS.map((al) => (
                        <Pressable
                          key={al.value}
                          onPress={() => setActivityLevel(al.value)}
                          style={[
                            styles.gridChip,
                            activityLevel === al.value && styles.gridChipActive,
                          ]}
                        >
                          <Text style={styles.chipEmoji}>{al.emoji}</Text>
                          <Text
                            style={[
                              styles.chipText,
                              activityLevel === al.value && styles.chipTextActive,
                            ]}
                          >
                            {al.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <Pressable
                      style={styles.cancelBtn}
                      onPress={() => setIsEditing(false)}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={styles.saveBtn}
                      onPress={handleSaveProfile}
                      disabled={updateUser.isPending}
                    >
                      {updateUser.isPending ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.saveBtnText}>Save Changes</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                /* VIEW PROFILE MODE */
                <View style={styles.viewContainer}>
                  {/* Big Avatar Display */}
                  <View style={styles.avatarSection}>
                    <LinearGradient
                      colors={Colors.gradientPurpleCyan}
                      style={styles.bigAvatar}
                    >
                      <Text style={styles.bigAvatarText}>
                        {(user?.full_name || 'A')[0].toUpperCase()}
                      </Text>
                    </LinearGradient>
                    <Text style={styles.profileName}>
                      {user?.full_name || 'Athlete'}
                    </Text>
                    <Text style={styles.profileEmail}>
                      {user?.email || 'no-email@fitgenome.ai'}
                    </Text>
                  </View>

                  {/* Biometrics Section */}
                  <Text style={styles.modalSectionTitle}>Biometrics</Text>
                  <View style={styles.biometricsGrid}>
                    <BiometricCard label="Age" value={user?.age ? `${user.age} yrs` : '--'} icon="calendar-outline" />
                    <BiometricCard label="Gender" value={user?.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : '--'} icon="people-outline" />
                    <BiometricCard label="Height" value={user?.height_cm ? `${user.height_cm} cm` : '--'} icon="resize-outline" />
                    <BiometricCard label="Weight" value={user?.weight_kg ? `${user.weight_kg} kg` : '--'} icon="scale-outline" />
                    <BiometricCard label="Blood" value={user?.blood_group || '--'} icon="water-outline" />
                    <BiometricCard label="Goal Wt" value={user?.goal_weight_kg ? `${user.goal_weight_kg} kg` : '--'} icon="flag-outline" />
                  </View>

                  {/* Targets Section */}
                  {(user?.bmr || user?.tdee) && (
                    <>
                      <Text style={styles.modalSectionTitle}>Calculated Targets</Text>
                      <View style={styles.biometricsGrid}>
                        {user.bmr && (
                          <BiometricCard label="BMR (Base)" value={`${Math.round(user.bmr)} kcal`} icon="flame-outline" color={Colors.coral} />
                        )}
                        {user.tdee && (
                          <BiometricCard label="TDEE (Active)" value={`${Math.round(user.tdee)} kcal`} icon="flash-outline" color={Colors.mint} />
                        )}
                      </View>
                    </>
                  )}

                  {/* Preferences Section */}
                  <Text style={styles.modalSectionTitle}>Preferences</Text>
                  <View style={styles.preferenceRow}>
                    <Text style={styles.preferenceLabel}>Fitness Goal</Text>
                    <View style={styles.preferenceBadge}>
                      <Text style={styles.preferenceValue}>
                        {FITNESS_GOALS.find((fg) => fg.value === user?.fitness_goal)?.label || user?.fitness_goal || 'Not set'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.preferenceRow}>
                    <Text style={styles.preferenceLabel}>Activity Level</Text>
                    <View style={styles.preferenceBadge}>
                      <Text style={styles.preferenceValue}>
                        {ACTIVITY_LEVELS.find((al) => al.value === user?.activity_level)?.label || user?.activity_level || 'Not set'}
                      </Text>
                    </View>
                  </View>

                  {/* Primary Buttons */}
                  <View style={styles.viewActions}>
                    <Pressable
                      style={styles.editBtn}
                      onPress={() => setIsEditing(true)}
                    >
                      <LinearGradient
                        colors={Colors.gradientPurpleCyan}
                        style={styles.editBtnGrad}
                      >
                        <Ionicons name="create-outline" size={18} color="#000" />
                        <Text style={styles.editBtnText}>Edit Profile</Text>
                      </LinearGradient>
                    </Pressable>

                    <Pressable
                      style={styles.signOutBtn}
                      onPress={handleSignOut}
                    >
                      <Ionicons name="log-out-outline" size={18} color={Colors.coral} />
                      <Text style={styles.signOutBtnText}>Sign Out</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function BiometricCard({
  label,
  value,
  icon,
  color = Colors.lavender,
}: {
  label: string;
  value: string;
  icon: any;
  color?: string;
}) {
  return (
    <View style={styles.bioCard}>
      <View style={styles.bioCardHeader}>
        <Ionicons name={icon} size={14} color={color} />
        <Text style={styles.bioCardLabel}>{label}</Text>
      </View>
      <Text style={styles.bioCardValue}>{value}</Text>
    </View>
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

  // Modal & Profile styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    maxHeight: '90%',
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  modalScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  formContainer: {
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  field: {
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  formLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSize.md,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  bloodGroupSelect: {
    height: 50,
  },
  bloodGroupScroll: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingRight: Spacing.md,
  },
  bloodChip: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 45,
    alignItems: 'center',
  },
  bloodChipActive: {
    borderColor: Colors.coral,
    backgroundColor: 'rgba(255, 127, 127, 0.1)',
  },
  bloodChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  bloodChipTextActive: {
    color: Colors.coral,
  },
  chipsGroup: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 12,
    gap: Spacing.xs,
  },
  chipActive: {
    borderColor: Colors.lavender,
    backgroundColor: 'rgba(184, 169, 232, 0.1)',
  },
  chipEmoji: {
    fontSize: FontSize.lg,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.lavender,
    fontWeight: FontWeight.semibold,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  gridChip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  gridChipActive: {
    borderColor: Colors.mint,
    backgroundColor: 'rgba(126, 222, 196, 0.08)',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: Colors.mint,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#000',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  viewContainer: {
    paddingTop: Spacing.md,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  bigAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  bigAvatarText: {
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: '#000',
  },
  profileName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  profileEmail: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalSectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  biometricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  bioCard: {
    width: '31%',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.sm,
    gap: 4,
  },
  bioCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bioCardLabel: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  bioCardValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginBottom: Spacing.sm,
  },
  preferenceLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  preferenceBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  preferenceValue: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  viewActions: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  editBtn: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  editBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 14,
  },
  editBtnText: {
    color: '#000',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.coral + '50',
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(232, 120, 120, 0.05)',
  },
  signOutBtnText: {
    color: Colors.coral,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
