/**
 * Progress Screen — Digital Twin 30-day trajectory visualization.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useDigitalTwin } from '@/hooks/useProgress';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');
const CHART_W = width - Spacing.md * 2 - Spacing.lg * 2;
const CHART_H = 180;

function MiniChart({ trajectory }: { trajectory: any[] }) {
  if (!trajectory || trajectory.length < 2) return null;

  const weights = trajectory.map((p: any) => p.weight_kg);
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const range = max - min || 1;

  const points = trajectory.map((p: any, i: number) => {
    const x = (i / (trajectory.length - 1)) * CHART_W;
    const y = CHART_H - ((p.weight_kg - min) / range) * CHART_H;
    return { x, y, day: p.day, weight: p.weight_kg };
  });

  return (
    <View style={cs.chartContainer}>
      {/* Y-axis labels */}
      <View style={cs.yAxis}>
        <Text style={cs.axisLabel}>{max.toFixed(1)}</Text>
        <Text style={cs.axisLabel}>{((max + min) / 2).toFixed(1)}</Text>
        <Text style={cs.axisLabel}>{min.toFixed(1)}</Text>
      </View>

      {/* Chart area */}
      <View style={[cs.chartArea, { width: CHART_W, height: CHART_H }]}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <View
            key={pct}
            style={[cs.gridLine, { top: pct * CHART_H }]}
          />
        ))}

        {/* Data points + connecting lines */}
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
            {i % 5 === 0 && (
              <View
                style={[cs.dot, { left: pt.x - 3, top: pt.y - 3 }]}
              />
            )}
          </React.Fragment>
        ))}

        {/* Start & end markers */}
        <View style={[cs.marker, { left: points[0].x - 5, top: points[0].y - 5 }]}>
          <LinearGradient colors={Colors.gradientMintSky} style={cs.markerGrad} />
        </View>
        <View style={[cs.marker, { left: points[points.length - 1].x - 5, top: points[points.length - 1].y - 5 }]}>
          <LinearGradient colors={Colors.gradientCoralGold} style={cs.markerGrad} />
        </View>
      </View>

      {/* X-axis labels */}
      <View style={[cs.xAxis, { width: CHART_W, marginLeft: 32 }]}>
        <Text style={cs.axisLabel}>Day 1</Text>
        <Text style={cs.axisLabel}>Day 15</Text>
        <Text style={cs.axisLabel}>Day 30</Text>
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const { data, isLoading, refetch } = useDigitalTwin();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
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

        {isLoading && !data && (
          <View style={s.loadingCard}>
            <Text style={s.loadingText}>Calculating your trajectory...</Text>
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
                    value={`${(summary as any)?.projected_end_weight_kg?.toFixed(1)} kg`}
                    color={Colors.sky}
                  />
                  <SummaryStat
                    label="Adherence"
                    value={`${Math.round((params?.adherence_rate ?? 0) * 100)}%`}
                    color={Colors.gold}
                  />
                </View>
              </LinearGradient>
            </View>

            {/* Chart */}
            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Weight Trajectory (kg)</Text>
              <MiniChart trajectory={data.trajectory} />
            </View>

            {/* Recommendation */}
            {(summary as any)?.recommendation && (
              <View style={s.recCard}>
                <Text style={s.recTitle}>💡 AI Recommendation</Text>
                <Text style={s.recText}>{(summary as any).recommendation}</Text>
              </View>
            )}

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
              <View style={s.paramRow}>
                <Text style={s.paramLabel}>Fitness Goal</Text>
                <Text style={[s.paramValue, { textTransform: 'capitalize' }]}>
                  {params?.fitness_goal?.replace('_', ' ')}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
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
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  title: { fontSize: FontSize.hero, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.xs },
  loadingCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center' },
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
  recCard: { marginHorizontal: Spacing.md, backgroundColor: 'rgba(126,222,196,0.08)', borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(126,222,196,0.2)', padding: Spacing.md, marginBottom: Spacing.lg },
  recTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.mint, marginBottom: Spacing.sm },
  recText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  paramsCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md },
  paramsTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  paramRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  paramLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  paramValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary },
});
