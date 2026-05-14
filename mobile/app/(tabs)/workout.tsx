/**
 * Workout Screen — Generate AI plans + difficulty feedback.
 * Connected to real backend with XP awards and toast notifications.
 */

import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DifficultySlider from '@/components/DifficultySlider';
import { useGenerateWorkout, useLatestWorkout } from '@/hooks/useWorkout';
import { useLogWorkout, useWorkoutLogs } from '@/hooks/useLogs';
import { useToast } from '@/components/ToastProvider';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

export default function WorkoutScreen() {
  const generateWorkout = useGenerateWorkout();
  const { data: latestWorkout, isLoading: isLatestLoading } = useLatestWorkout();
  const logWorkout = useLogWorkout();
  const { data: logs } = useWorkoutLogs();
  const { showToast } = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const [logsY, setLogsY] = useState(0);
  const activePlan = generateWorkout.data || latestWorkout;

  const [preferences, setPreferences] = useState('');
  const [showPrefs, setShowPrefs] = useState(false);
  const [showManualLog, setShowManualLog] = useState(false);
  const [completedDays, setCompletedDays] = useState<string[]>([]);

  // Manual log form
  const [exerciseName, setExerciseName] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');

  const groupLogs = (logs: any[]) => {
    if (!logs) return [];
    const groups: Record<string, any[]> = {};
    logs.forEach(log => {
      const date = log.logged_at.split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const handleManualLog = () => {
    if (!exerciseName || !sets || !reps) {
      showToast('Please fill required fields', 'error');
      return;
    }
    logWorkout.mutate({
      exercise_name: exerciseName,
      sets: parseInt(sets),
      reps: parseInt(reps),
      weight_kg: weight ? parseFloat(weight) : undefined,
    }, {
      onSuccess: () => {
        showToast('Workout logged! 💪', 'success');
        setExerciseName('');
        setSets('');
        setReps('');
        setWeight('');
        setShowManualLog(false);
        
        // Scroll to history
        setTimeout(() => {
          scrollRef.current?.scrollTo({ y: logsY, animated: true });
        }, 500);
      },
      onError: () => showToast('Failed to log workout', 'error'),
    });
  };

  const handleFollowDay = async (day: any) => {
    if (completedDays.includes(day.day)) return;
    
    try {
      showToast(`Logging ${day.exercises.length} exercises...`, 'info');
      for (const ex of day.exercises) {
        const repsNum = parseInt(ex.reps.toString().split('-')[0]) || 10;
        await logWorkout.mutateAsync({
          exercise_name: ex.name,
          sets: ex.sets,
          reps: repsNum,
          weight_kg: ex.weight_kg,
          notes: ex.notes,
        });
      }
      setCompletedDays(prev => [...prev, day.day]);
      showToast(`Day "${day.day}" marked as completed! +50 XP 💪`, 'success');
      
      // Auto-scroll to logs section
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: logsY, animated: true });
      }, 500);
    } catch {
      showToast('Failed to log some exercises', 'error');
    }
  };

  // ... rest of the component

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
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>Workout</Text>
          <Text style={s.sub}>Track & generate personalized plans</Text>
        </View>

        {/* ... Manual Log Section remains similar, just adding some padding ... */}
        <View style={s.manualLogSection}>
          <Pressable onPress={() => setShowManualLog(!showManualLog)} style={s.manualLogToggle}>
            <Ionicons name={showManualLog ? 'close-circle' : 'add-circle'} size={20} color={Colors.mint} />
            <Text style={s.manualLogToggleText}>{showManualLog ? 'Cancel Logging' : 'Log Workout Manually'}</Text>
          </Pressable>

          {showManualLog && (
            <View style={s.manualLogForm}>
              <TextInput
                style={s.logInput}
                placeholder="Exercise Name (e.g. Bench Press)"
                placeholderTextColor={Colors.textMuted}
                value={exerciseName}
                onChangeText={setExerciseName}
              />
              <View style={s.logRow}>
                <TextInput
                  style={[s.logInput, { flex: 1 }]}
                  placeholder="Sets"
                  placeholderTextColor={Colors.textMuted}
                  value={sets}
                  onChangeText={setSets}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[s.logInput, { flex: 1 }]}
                  placeholder="Reps"
                  placeholderTextColor={Colors.textMuted}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[s.logInput, { flex: 1.5 }]}
                  placeholder="Weight (kg)"
                  placeholderTextColor={Colors.textMuted}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                />
              </View>
              <Pressable onPress={handleManualLog} style={s.logSubmitBtn} disabled={logWorkout.isPending}>
                <Text style={s.logSubmitText}>{logWorkout.isPending ? 'Logging...' : 'Save Entry'}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Day-wise History */}
        <View onLayout={(e) => setLogsY(e.nativeEvent.layout.y)} style={s.historySection}>
          <Text style={s.historyTitle}>Your Activity</Text>
          {logs && logs.length > 0 ? (
            groupLogs(logs).map(([date, entries]) => (
              <View key={date} style={s.dayGroup}>
                <Text style={s.dateHeader}>{new Date(date).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
                {entries.map((log: any) => (
                  <View key={log.id} style={s.historyItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.historyExName}>{log.exercise_name}</Text>
                      <Text style={s.historyExDetail}>
                        {log.sets}×{log.reps}{log.weight_kg ? ` • ${log.weight_kg}kg` : ''}
                      </Text>
                    </View>
                    <Text style={s.historyTime}>
                      {new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          ) : (
            <Text style={s.emptyText}>No workouts logged yet. Start today!</Text>
          )}
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

        {isLatestLoading && !generateWorkout.data && (
          <ActivityIndicator color={Colors.mint} style={{ marginVertical: 20 }} />
        )}
        {activePlan && (
          <View style={s.plan}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.planTitle}>{activePlan.plan_name}</Text>
              <View style={s.xpBadge}><Text style={s.xpText}>+25 XP</Text></View>
            </View>
            <Text style={s.planGoal}>{activePlan.goal}</Text>

            {activePlan.weekly_schedule.map((day: any, i: number) => (
              <View key={i} style={s.dayCard}>
                <View style={s.dayHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.dayTitle}>{day.day}</Text>
                    <Text style={s.dayFocus}>{day.focus}</Text>
                    <Text style={s.dayDur}>{day.estimated_duration_min} min</Text>
                  </View>
                  <Pressable 
                    onPress={() => handleFollowDay(day)} 
                    style={[s.followBtn, completedDays.includes(day.day) && { backgroundColor: 'rgba(126,222,196,0.2)' }]}
                  >
                    <Ionicons 
                      name={completedDays.includes(day.day) ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={completedDays.includes(day.day) ? Colors.mint : Colors.textMuted} 
                    />
                    <Text style={[s.followText, completedDays.includes(day.day) && { color: Colors.mint }]}>
                      {completedDays.includes(day.day) ? "Followed" : "Follow Day"}
                    </Text>
                  </Pressable>
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

            {activePlan.progressive_overload_strategy && (
              <View style={s.stratCard}>
                <Text style={s.stratTitle}>📈 Progressive Overload</Text>
                <Text style={s.stratText}>{activePlan.progressive_overload_strategy}</Text>
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
  dayHead: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder, paddingBottom: Spacing.sm },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.md },
  followText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
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
  
  // Manual Log Styles
  manualLogSection: { marginHorizontal: Spacing.md, marginBottom: Spacing.lg },
  manualLogToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(126,222,196,0.08)', padding: 12, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(126,222,196,0.2)' },
  manualLogToggleText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.mint },
  manualLogForm: { marginTop: Spacing.sm, backgroundColor: Colors.card, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, gap: Spacing.sm },
  logInput: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, padding: 12, fontSize: FontSize.sm, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.cardBorder },
  logRow: { flexDirection: 'row', gap: Spacing.sm },
  logSubmitBtn: { backgroundColor: Colors.mint, padding: 14, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.xs },
  logSubmitText: { color: '#000', fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  // History Styles
  historySection: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  historyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  dayGroup: { marginBottom: Spacing.md },
  dateHeader: { fontSize: 12, fontWeight: '700', color: Colors.mint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceLight, padding: 14, borderRadius: BorderRadius.md, marginBottom: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  historyExName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  historyExDetail: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  historyTime: { fontSize: 11, color: Colors.textMuted },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 20 },
});
