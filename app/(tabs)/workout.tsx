/**
 * Workout Screen — Generate AI plans + difficulty feedback.
 * Connected to real backend with XP awards and toast notifications.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DifficultySlider from '@/components/DifficultySlider';
import { useGenerateWorkout } from '@/hooks/useWorkout';
import { useToast } from '@/components/ToastProvider';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

export default function WorkoutScreen() {
  const generateWorkout = useGenerateWorkout();
  const { showToast } = useToast();
  const [preferences, setPreferences] = useState('');
  const [showPrefs, setShowPrefs] = useState(false);

  const handleGenerate = () => {
    generateWorkout.mutate(preferences, {
      onSuccess: () => showToast('Workout plan generated! +25 XP 🎉', 'success'),
      onError: (error: any) => {
        showToast(error.response?.data?.detail || 'Generation failed', 'error', {
          action: { label: 'Retry', onPress: handleGenerate },
        });
      },
    });
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>Workout</Text>
          <Text style={s.sub}>Track & generate personalized plans</Text>
        </View>

        <Pressable onPress={() => setShowPrefs(!showPrefs)} style={s.prefsToggle}>
          <Ionicons name={showPrefs ? 'chevron-up' : 'options-outline'} size={16} color={Colors.textMuted} />
          <Text style={s.prefsToggleText}>{showPrefs ? 'Hide preferences' : 'Add preferences'}</Text>
        </Pressable>

        {showPrefs && (
          <TextInput style={s.prefsInput} placeholder="e.g. dumbbells only, skip legs" placeholderTextColor={Colors.textMuted} value={preferences} onChangeText={setPreferences} multiline maxLength={500} />
        )}

        <Pressable onPress={handleGenerate} style={s.genBtn} disabled={generateWorkout.isPending}>
          <LinearGradient colors={Colors.gradientPurpleCyan} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.genGrad}>
            {generateWorkout.isPending ? <ActivityIndicator color="#000" /> : <Ionicons name="sparkles" size={20} color="#000" />}
            <Text style={s.genText}>{generateWorkout.isPending ? 'Generating...' : 'Generate AI Workout Plan'}</Text>
          </LinearGradient>
        </Pressable>

        {generateWorkout.isError && (
          <View style={s.errCard}>
            <Ionicons name="alert-circle" size={20} color={Colors.error} />
            <Text style={s.errText}>{(generateWorkout.error as any)?.response?.data?.detail || 'Failed'}</Text>
            <Pressable onPress={handleGenerate} style={s.retryBtn}><Text style={s.retryText}>Retry</Text></Pressable>
          </View>
        )}

        {generateWorkout.data && (
          <View style={s.plan}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.planTitle}>{generateWorkout.data.plan_name}</Text>
              <View style={s.xpBadge}><Text style={s.xpText}>+25 XP</Text></View>
            </View>
            <Text style={s.planGoal}>{generateWorkout.data.goal}</Text>

            {generateWorkout.data.weekly_schedule.map((day: any, i: number) => (
              <View key={i} style={s.dayCard}>
                <View style={s.dayHead}>
                  <Text style={s.dayTitle}>{day.day}</Text>
                  <Text style={s.dayFocus}>{day.focus}</Text>
                  <Text style={s.dayDur}>{day.estimated_duration_min} min</Text>
                </View>
                {day.exercises.map((ex: any, j: number) => (
                  <View key={j} style={s.exRow}>
                    <Text style={s.exName}>{ex.name}</Text>
                    <Text style={s.exDetail}>{ex.sets} × {ex.reps}{ex.weight_kg ? ` @ ${ex.weight_kg}kg` : ''} • {ex.rest_seconds}s rest</Text>
                    {ex.notes ? <Text style={s.exNote}>💡 {ex.notes}</Text> : null}
                  </View>
                ))}
              </View>
            ))}

            {generateWorkout.data.progressive_overload_strategy && (
              <View style={s.stratCard}>
                <Text style={s.stratTitle}>📈 Progressive Overload</Text>
                <Text style={s.stratText}>{generateWorkout.data.progressive_overload_strategy}</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ marginTop: Spacing.lg }}>
          <Text style={s.secTitle}>Post-Workout Feedback</Text>
          <DifficultySlider />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { fontSize: FontSize.hero, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.xs },
  prefsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  prefsToggleText: { fontSize: FontSize.sm, color: Colors.textMuted },
  prefsInput: { marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.cardBorder, minHeight: 60, textAlignVertical: 'top' },
  genBtn: { marginHorizontal: Spacing.md, borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: Spacing.lg },
  genGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },
  genText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#000' },
  errCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.md, marginBottom: Spacing.lg, backgroundColor: 'rgba(232,120,120,0.1)', borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(232,120,120,0.25)', padding: Spacing.md },
  errText: { flex: 1, fontSize: FontSize.sm, color: Colors.error },
  retryBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.sm, backgroundColor: 'rgba(232,120,120,0.2)' },
  retryText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.error },
  plan: { marginHorizontal: Spacing.md, marginBottom: Spacing.lg },
  planTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  xpBadge: { backgroundColor: 'rgba(126,222,196,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  xpText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.mint },
  planGoal: { fontSize: FontSize.sm, color: Colors.lavender, marginBottom: Spacing.md },
  dayCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, marginBottom: Spacing.sm },
  dayHead: { marginBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder, paddingBottom: Spacing.sm },
  dayTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  dayFocus: { fontSize: FontSize.sm, color: Colors.mint, marginTop: 2 },
  dayDur: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  exRow: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  exName: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  exDetail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  exNote: { fontSize: FontSize.xs, color: Colors.gold, marginTop: 4, fontStyle: 'italic' },
  stratCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, marginTop: Spacing.sm },
  stratTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  stratText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  secTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
});
