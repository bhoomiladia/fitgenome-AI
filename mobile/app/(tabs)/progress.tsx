/**
 * Progress Screen — Digital Twin 30-day trajectory visualization.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Dimensions, Modal, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useDigitalTwin } from '@/hooks/useProgress';
import { useUser, useUpdateUser } from '@/hooks/useUser';
import { useLogWeight, useWeightLogs } from '@/hooks/useLogs';
import { useToast } from '@/components/ToastProvider';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');
const CHART_W = width - Spacing.md * 2 - Spacing.lg * 2;
const CHART_H = 180;

function MiniChart({ trajectory, logs, goalWeight }: { trajectory: any[], logs: any[], goalWeight?: number }) {
  if (!trajectory) return null;

  // Actual logs (Past) — limit to last 7 for graph clarity
  const actualPoints = [...(logs || [])]
    .reverse()
    .map((l) => ({ 
      weight: l.weight_kg, 
      type: 'actual' 
    }));

  // Trajectory (Future)
  const projectedPoints = trajectory.map((p) => ({
    weight: p.predicted_weight_kg,
    type: 'projected'
  }));

  const allPoints = [...actualPoints, ...projectedPoints];
  if (allPoints.length < 2) return null;

  const weights = allPoints.map(p => p.weight);
  if (goalWeight) weights.push(goalWeight);
  
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const range = max - min || 1;

  const points = allPoints.map((p, i) => {
    const x = (i / (allPoints.length - 1)) * CHART_W;
    const y = CHART_H - ((p.weight - min) / range) * CHART_H;
    return { ...p, x, y };
  });

  const goalY = goalWeight ? CHART_H - ((goalWeight - min) / range) * CHART_H : null;

  return (
    <View style={cs.chartContainer}>
      <View style={cs.yAxis}>
        <Text style={cs.axisLabel}>{max.toFixed(1)}</Text>
        <Text style={cs.axisLabel}>{((max + min) / 2).toFixed(1)}</Text>
        <Text style={cs.axisLabel}>{min.toFixed(1)}</Text>
      </View>

      <View style={[cs.chartArea, { width: CHART_W, height: CHART_H }]}>
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <View key={pct} style={[cs.gridLine, { top: pct * CHART_H }]} />
        ))}

        {goalY !== null && (
          <View style={[cs.goalLine, { top: goalY }]}>
            <View style={cs.goalTag}><Text style={cs.goalTagText}>TARGET</Text></View>
          </View>
        )}

        {points.map((pt, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <View
                style={[
                  cs.lineSegment,
                  {
                    left: points[i - 1].x,
                    top: Math.min(points[i - 1].y, pt.y),
                    width: Math.sqrt(
                      Math.pow(pt.x - points[i - 1].x, 2) +
                      Math.pow(pt.y - points[i - 1].y, 2)
                    ),
                    backgroundColor: pt.type === 'actual' ? Colors.mint : 'rgba(255,255,255,0.2)',
                    height: pt.type === 'actual' ? 3 : 2,
                    transform: [
                      {
                        rotate: `${Math.atan2(
                          pt.y - points[i - 1].y,
                          pt.x - points[i - 1].x
                        )}rad`,
                      },
                    ],
                    transformOrigin: 'left center',
                  },
                ]}
              />
            )}
            {pt.type === 'actual' && (
              <View style={[cs.dot, { left: pt.x - 4, top: pt.y - 4, backgroundColor: Colors.mint, width: 8, height: 8, borderRadius: 4 }]} />
            )}
          </React.Fragment>
        ))}

        {/* Legend */}
        <View style={cs.legend}>
          <View style={cs.legendItem}>
            <View style={[cs.legendColor, { backgroundColor: Colors.mint }]} />
            <Text style={cs.legendText}>Actual</Text>
          </View>
          <View style={cs.legendItem}>
            <View style={[cs.legendColor, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
            <Text style={cs.legendText}>Projected</Text>
          </View>
        </View>
      </View>

      <View style={[cs.xAxis, { width: CHART_W, marginLeft: 32 }]}>
        <Text style={cs.axisLabel}>History</Text>
        <Text style={cs.axisLabel}>Today</Text>
        <Text style={cs.axisLabel}>+30 Days</Text>
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const { data, isLoading, refetch } = useDigitalTwin();
  const { data: user, refetch: refetchUser } = useUser();
  const { data: weightLogs, refetch: refetchLogs } = useWeightLogs();
  const updateProfile = useUpdateUser();
  const logWeight = useLogWeight();
  const { showToast } = useToast();

  const currentWeight = user?.weight_kg;
  const goalWeight = user?.goal_weight_kg;

  const [refreshing, setRefreshing] = useState(false);
  const [weightModal, setWeightModal] = useState(false);
  const [goalModal, setGoalModal] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchUser(), refetchLogs()]);
    setRefreshing(false);
  };

  const handleWeightUpdate = () => {
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid weight', 'error');
      return;
    }
    logWeight.mutate(val, {
      onSuccess: () => {
        showToast('Weight logged successfully! ⚖️', 'success');
        setWeightModal(false);
        setInputValue('');
      },
      onError: () => showToast('Failed to log weight', 'error'),
    });
  };

  const handleGoalUpdate = () => {
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid goal weight', 'error');
      return;
    }
    updateProfile.mutate({ goal_weight_kg: val }, {
      onSuccess: () => {
        showToast('Goal weight updated! 🎯', 'success');
        setGoalModal(false);
        setInputValue('');
      },
      onError: () => showToast('Failed to update goal', 'error'),
    });
  };

  const summary = data?.summary;
  const params = data?.input_params;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lavender} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Progress</Text>
          <Text style={s.sub}>Digital Twin — 30-day projection</Text>
        </View>

        {/* Action Buttons */}
        <View style={s.actionGrid}>
          <Pressable style={s.actionBtn} onPress={() => {
            setInputValue(currentWeight?.toString() || '');
            setWeightModal(true);
          }}>
            <LinearGradient colors={['#7EDE8C', '#5DBE8C']} style={s.actionGrad}>
              <Ionicons name="scale-outline" size={20} color="#000" />
              <Text style={s.actionText}>Log Weight</Text>
            </LinearGradient>
          </Pressable>
          <Pressable style={s.actionBtn} onPress={() => {
            setInputValue(goalWeight?.toString() || '');
            setGoalModal(true);
          }}>
            <LinearGradient colors={['#B8A9E8', '#9B8ADE']} style={s.actionGrad}>
              <Ionicons name="flag-outline" size={20} color="#000" />
              <Text style={s.actionText}>Set Goal</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Goals Tracker */}
        {user && (
          <View style={s.goalsCard}>
            <View style={s.goalRow}>
              <View>
                <Text style={s.goalLabel}>Current Weight</Text>
                <Text style={s.goalValue}>{currentWeight ?? '--'} kg</Text>
              </View>
              <View style={s.goalDivider} />
              <View>
                <Text style={s.goalLabel}>Goal Weight</Text>
                <Text style={[s.goalValue, { color: Colors.mint }]}>{goalWeight ?? '--'} kg</Text>
              </View>
            </View>
            {currentWeight && goalWeight && (
              <View style={s.progressContainer}>
                <View style={s.progressBarBg}>
                  <View style={[s.progressBarFill, { width: `${Math.max(5, Math.min(100, (1 - Math.abs(currentWeight - goalWeight) / 10) * 100))}%` }]} />
                </View>
                <Text style={s.progressSub}>
                  {currentWeight > goalWeight 
                    ? `${(currentWeight - goalWeight).toFixed(1)}kg to go`
                    : currentWeight < goalWeight
                      ? `${(goalWeight - currentWeight).toFixed(1)}kg to gain`
                      : "Target Reached! 🎉"}
                </Text>
              </View>
            )}
          </View>
        )}

        {isLoading && !data && (
          <View style={s.loadingCard}>
            <ActivityIndicator color={Colors.lavender} />
            <Text style={s.loadingText}>Simulating your digital twin...</Text>
          </View>
        )}

        {data && (
          <>
            {/* Summary Card */}
            <View style={s.summaryCard}>
              <LinearGradient
                colors={['rgba(184,169,232,0.08)', 'rgba(126,200,227,0.04)']}
                style={s.summaryGrad}
              >
                <Text style={s.summaryTitle}>30-Day Projection</Text>
                <View style={s.summaryGrid}>
                  <SummaryStat
                    label="Weight Change"
                    value={`${(summary as any)?.total_weight_change_kg > 0 ? '+' : ''}${(summary as any)?.total_weight_change_kg?.toFixed(1)} kg`}
                    color={(summary as any)?.total_weight_change_kg <= 0 ? Colors.mint : Colors.coral}
                  />
                  <SummaryStat
                    label="Weekly Rate"
                    value={`${(summary as any)?.weekly_rate_kg?.toFixed(2)} kg/wk`}
                    color={Colors.lavender}
                  />
                  <SummaryStat
                    label="End Weight"
                    value={`${(summary as any)?.predicted_weight_30d?.toFixed(1)} kg`}
                    color={Colors.sky}
                  />
                  <SummaryStat
                    label="On Track"
                    value={(summary as any)?.on_track ? 'Yes' : 'Adjusting'}
                    color={(summary as any)?.on_track ? Colors.mint : Colors.gold}
                  />
                </View>
              </LinearGradient>
            </View>

            {/* Chart */}
            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Weight Trajectory (kg)</Text>
              <MiniChart 
                trajectory={data.trajectory} 
                logs={weightLogs} 
                goalWeight={goalWeight} 
              />
            </View>

            {/* Weight History */}
            <View style={s.historyCard}>
              <Text style={s.historyTitle}>Weight History</Text>
              {weightLogs && weightLogs.length > 0 ? (
                weightLogs.slice(0, 7).map((log: any, i: number) => (
                  <View key={i} style={s.historyRow}>
                    <Text style={s.historyDate}>
                      {new Date(log.logged_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={s.historyWeight}>{log.weight_kg} kg</Text>
                  </View>
                ))
              ) : (
                <Text style={s.emptyHistory}>No weight entries yet.</Text>
              )}
            </View>

            {/* Input Parameters */}
            <View style={s.paramsCard}>
              <Text style={s.paramsTitle}>Model Inputs</Text>
              <View style={s.paramRow}>
                <Text style={s.paramLabel}>Current Weight</Text>
                <Text style={s.paramValue}>{params?.current_weight_kg} kg</Text>
              </View>
              <View style={s.paramRow}>
                <Text style={s.paramLabel}>TDEE</Text>
                <Text style={s.paramValue}>{params?.tdee} kcal</Text>
              </View>
              <View style={s.paramRow}>
                <Text style={s.paramLabel}>Avg Daily Intake</Text>
                <Text style={s.paramValue}>{params?.avg_daily_calories} kcal</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modals */}
      <Modal visible={weightModal || goalModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>{weightModal ? 'Log Current Weight' : 'Set Goal Weight'}</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. 75.5"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={inputValue}
              onChangeText={setInputValue}
              autoFocus
            />
            <View style={s.modalBtns}>
              <Pressable style={s.modalCancel} onPress={() => { setWeightModal(false); setGoalModal(false); setInputValue(''); }}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={s.modalSubmit} 
                onPress={weightModal ? handleWeightUpdate : handleGoalUpdate}
                disabled={logWeight.isPending || updateProfile.isPending}
              >
                <Text style={s.modalSubmitText}>
                  {logWeight.isPending || updateProfile.isPending ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.statItem}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const cs = StyleSheet.create({
  chartContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  yAxis: { width: 32, height: CHART_H, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 4 },
  chartArea: { position: 'relative', overflow: 'hidden' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  lineSegment: { position: 'absolute', height: 2, backgroundColor: Colors.lavender, borderRadius: 1 },
  dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.lavender },
  marker: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  markerGrad: { width: 10, height: 10, borderRadius: 5 },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisLabel: { fontSize: 10, color: Colors.textMuted },

  goalLine: { position: 'absolute', left: 0, right: 0, height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.mint, opacity: 0.6 },
  goalTag: { position: 'absolute', right: 0, top: -14, backgroundColor: Colors.mint, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  goalTagText: { fontSize: 8, fontWeight: 'bold', color: '#000' },

  legend: { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendColor: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 8, color: Colors.textMuted },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  title: { fontSize: FontSize.hero, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.xs },
  
  actionGrid: { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  actionBtn: { flex: 1, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  actionGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  actionText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#000' },

  goalsCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.lg, marginBottom: Spacing.lg },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: Spacing.md },
  goalLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  goalValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginTop: 4, textAlign: 'center' },
  goalDivider: { width: 1, height: 30, backgroundColor: Colors.cardBorder },
  
  progressContainer: { gap: 8 },
  progressBarBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: Colors.mint, borderRadius: 4 },
  progressSub: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },

  loadingCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: FontSize.md, color: Colors.textMuted },
  
  summaryCard: { marginHorizontal: Spacing.md, borderRadius: BorderRadius.xl, overflow: 'hidden', borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: Spacing.lg },
  summaryGrad: { padding: Spacing.lg },
  summaryTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statItem: { width: '46%', alignItems: 'center', paddingVertical: Spacing.sm },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  
  chartCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.lg, marginBottom: Spacing.lg },
  chartTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.md },
  
  historyCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.lg, marginBottom: Spacing.lg },
  historyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.md },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  historyDate: { fontSize: FontSize.sm, color: Colors.textMuted },
  historyWeight: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyHistory: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: 10 },
  
  paramsCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, marginBottom: Spacing.xl },
  paramsTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  paramRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  paramLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  paramValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: Spacing.xl },
  modalContent: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.cardBorder, gap: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  modalInput: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, padding: 16, fontSize: 24, fontWeight: '700', color: Colors.mint, textAlign: 'center', borderWidth: 1, borderColor: Colors.cardBorder },
  modalBtns: { flexDirection: 'row', gap: Spacing.md },
  modalCancel: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { fontSize: FontSize.md, color: Colors.textMuted, fontWeight: '600' },
  modalSubmit: { flex: 2, backgroundColor: Colors.mint, borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: 'center' },
  modalSubmitText: { fontSize: FontSize.md, fontWeight: 'bold', color: '#000' },
});
