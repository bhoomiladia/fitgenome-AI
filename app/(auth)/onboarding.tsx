/**
 * Onboarding Screen — Multi-step wizard to collect biometric data.
 *
 * Steps:
 *   1. Age & Gender
 *   2. Height & Weight
 *   3. Activity Level
 *   4. Fitness Goal
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { onboardingApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

const GENDERS = [
  { value: 'male', label: '♂ Male', emoji: '🧔' },
  { value: 'female', label: '♀ Female', emoji: '👩' },
  { value: 'other', label: '⚧ Other', emoji: '🧑' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, little exercise', emoji: '🪑' },
  { value: 'light', label: 'Light', desc: '1-2 workouts/week', emoji: '🚶' },
  { value: 'moderate', label: 'Moderate', desc: '3-4 workouts/week', emoji: '🏃' },
  { value: 'active', label: 'Active', desc: '5-6 workouts/week', emoji: '💪' },
  { value: 'very_active', label: 'Very Active', desc: 'Athlete / physical job', emoji: '🏆' },
];

const FITNESS_GOALS = [
  { value: 'lose_weight', label: 'Lose Weight', desc: 'Burn fat, calorie deficit', emoji: '🔥', gradient: Colors.gradientCoralGold },
  { value: 'maintain', label: 'Maintain', desc: 'Stay fit, balanced diet', emoji: '⚖️', gradient: Colors.gradientMintSky },
  { value: 'build_muscle', label: 'Build Muscle', desc: 'Gain mass, high protein', emoji: '💪', gradient: Colors.gradientPurpleCyan },
  { value: 'improve_endurance', label: 'Endurance', desc: 'Cardio, stamina focus', emoji: '🏃', gradient: Colors.gradientMintSky },
];

const BLOOD_GROUPS = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
];

export default function OnboardingScreen() {
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Form state
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');

  const totalSteps = 5;

  const canProceed = () => {
    switch (step) {
      case 0: return !!age && !!gender && parseInt(age) > 0;
      case 1: return !!height && !!weight && parseFloat(height) > 0 && parseFloat(weight) > 0;
      case 2: return !!activityLevel;
      case 3: return !!fitnessGoal;
      case 4: return !!bloodGroup;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
      return;
    }

    // Final step — submit
    setLoading(true);
    try {
      await onboardingApi.submit({
        age: parseInt(age),
        gender,
        height_cm: parseFloat(height),
        weight_kg: parseFloat(weight),
        activity_level: activityLevel,
        fitness_goal: fitnessGoal,
        blood_group: bloodGroup,
      });
      await refreshUser();
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Onboarding failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View style={s.progressContainer}>
          <View style={s.progressTrack}>
            <LinearGradient
              colors={Colors.gradientPurpleCyan}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[s.progressFill, { width: `${((step + 1) / totalSteps) * 100}%` }]}
            />
          </View>
          <Text style={s.progressText}>Step {step + 1} of {totalSteps}</Text>
        </View>

        {/* Step Content */}
        {step === 0 && (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Let's get to know you</Text>
            <Text style={s.stepSubtitle}>We'll personalize your fitness journey</Text>

            <View style={s.field}>
              <Text style={s.label}>Your Age</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 25"
                placeholderTextColor={Colors.textMuted}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Gender</Text>
              <View style={s.optionsRow}>
                {GENDERS.map((g) => (
                  <Pressable
                    key={g.value}
                    onPress={() => setGender(g.value)}
                    style={[
                      s.optionCard,
                      gender === g.value && s.optionCardActive,
                    ]}
                  >
                    <Text style={s.optionEmoji}>{g.emoji}</Text>
                    <Text style={[s.optionLabel, gender === g.value && s.optionLabelActive]}>
                      {g.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Your measurements</Text>
            <Text style={s.stepSubtitle}>Used to calculate your calorie needs</Text>

            <View style={s.field}>
              <Text style={s.label}>Height (cm)</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 175"
                placeholderTextColor={Colors.textMuted}
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Weight (kg)</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 72"
                placeholderTextColor={Colors.textMuted}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Activity Level</Text>
            <Text style={s.stepSubtitle}>How active are you on a typical week?</Text>

            <View style={s.optionsList}>
              {ACTIVITY_LEVELS.map((al) => (
                <Pressable
                  key={al.value}
                  onPress={() => setActivityLevel(al.value)}
                  style={[
                    s.listCard,
                    activityLevel === al.value && s.listCardActive,
                  ]}
                >
                  <Text style={s.listEmoji}>{al.emoji}</Text>
                  <View style={s.listTextContainer}>
                    <Text style={[s.listLabel, activityLevel === al.value && s.listLabelActive]}>
                      {al.label}
                    </Text>
                    <Text style={s.listDesc}>{al.desc}</Text>
                  </View>
                  {activityLevel === al.value && (
                    <View style={s.checkCircle}>
                      <Text style={s.checkMark}>✓</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Your Fitness Goal</Text>
            <Text style={s.stepSubtitle}>We'll optimize your plans for this</Text>

            <View style={s.goalsGrid}>
              {FITNESS_GOALS.map((fg) => (
                <Pressable
                  key={fg.value}
                  onPress={() => setFitnessGoal(fg.value)}
                  style={[
                    s.goalCard,
                    fitnessGoal === fg.value && s.goalCardActive,
                  ]}
                >
                  {fitnessGoal === fg.value ? (
                    <LinearGradient
                      colors={fg.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.goalGradient}
                    >
                      <Text style={s.goalEmoji}>{fg.emoji}</Text>
                      <Text style={[s.goalLabel, { color: '#000' }]}>{fg.label}</Text>
                      <Text style={[s.goalDesc, { color: 'rgba(0,0,0,0.6)' }]}>{fg.desc}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={s.goalInner}>
                      <Text style={s.goalEmoji}>{fg.emoji}</Text>
                      <Text style={s.goalLabel}>{fg.label}</Text>
                      <Text style={s.goalDesc}>{fg.desc}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={s.stepContent}>
            <Text style={s.stepTitle}>Blood Group</Text>
            <Text style={s.stepSubtitle}>Helpful for advanced genomic insights</Text>

            <View style={s.bloodGroupGrid}>
              {BLOOD_GROUPS.map((bg) => (
                <Pressable
                  key={bg}
                  onPress={() => setBloodGroup(bg)}
                  style={[
                    s.bloodGroupCard,
                    bloodGroup === bg && s.bloodGroupCardActive,
                  ]}
                >
                  <Text style={[s.bloodGroupText, bloodGroup === bg && s.bloodGroupTextActive]}>
                    {bg}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Navigation Buttons */}
        <View style={s.navRow}>
          {step > 0 && (
            <Pressable onPress={handleBack} style={s.backBtn}>
              <Text style={s.backBtnText}>← Back</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleNext}
            style={[s.nextBtn, !canProceed() && s.btnDisabled]}
            disabled={!canProceed() || loading}
          >
            <LinearGradient
              colors={canProceed() ? Colors.gradientPurpleCyan : ['#333', '#333']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.nextGrad}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={s.nextText}>
                  {step === totalSteps - 1 ? 'Start Journey 🚀' : 'Continue →'}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },

  // Progress
  progressContainer: { marginTop: Spacing.md, marginBottom: Spacing.xl },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 2 },
  progressText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },

  // Steps
  stepContent: { marginBottom: Spacing.xl },
  stepTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },

  // Fields
  field: { marginBottom: Spacing.lg },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },

  // Gender option cards
  optionsRow: { flexDirection: 'row', gap: Spacing.sm },
  optionCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  optionCardActive: {
    borderColor: Colors.lavender,
    backgroundColor: 'rgba(184, 169, 232, 0.10)',
  },
  optionEmoji: { fontSize: 28 },
  optionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  optionLabelActive: { color: Colors.lavender },

  // Activity level list
  optionsList: { gap: Spacing.sm },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  listCardActive: {
    borderColor: Colors.mint,
    backgroundColor: 'rgba(126, 222, 196, 0.08)',
  },
  listEmoji: { fontSize: 24 },
  listTextContainer: { flex: 1 },
  listLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  listLabelActive: { color: Colors.mint },
  listDesc: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#000', fontSize: 14, fontWeight: FontWeight.bold },

  // Goals grid
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  goalCard: {
    width: (width - Spacing.lg * 2 - Spacing.sm) / 2,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  goalCardActive: { borderColor: 'transparent' },
  goalGradient: {
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 130,
    justifyContent: 'center',
  },
  goalInner: {
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.card,
    minHeight: 130,
    justifyContent: 'center',
  },
  goalEmoji: { fontSize: 32 },
  goalLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  goalDesc: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // Navigation
  navRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  backBtn: {
    paddingVertical: 16,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  nextBtn: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  btnDisabled: { opacity: 0.5 },
  nextGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  nextText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#000',
  },

  // Blood group
  bloodGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  bloodGroupCard: {
    width: (width - Spacing.lg * 2 - Spacing.md * 3) / 4,
    aspectRatio: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodGroupCardActive: {
    borderColor: Colors.coral,
    backgroundColor: 'rgba(255, 127, 127, 0.1)',
  },
  bloodGroupText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  bloodGroupTextActive: {
    color: Colors.coral,
  },
});
