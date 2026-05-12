/**
 * Nutrition Screen — Real macro data, AI meal plan, food scanning.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useGenerateMealPlan } from '@/hooks/useNutrition';
import { useFoodScan, useFoodScanFromGallery } from '@/hooks/useFoodScan';
import { useDashboard } from '@/hooks/useDashboard';
import { useToast } from '@/components/ToastProvider';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

function getMealEmoji(type: string): string {
  const map: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
  return map[type.toLowerCase()] || '🍽️';
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = Math.min((value / target) * 100, 100);
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '500', color }}>{label}</Text>
        <Text style={{ fontSize: 11, color: Colors.textMuted }}>{value}/{target}g</Text>
      </View>
      <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
        <View style={{ height: 6, borderRadius: 3, width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

export default function NutritionScreen() {
  const genMeal = useGenerateMealPlan();
  const scanCamera = useFoodScan();
  const scanGallery = useFoodScanFromGallery();
  const { data: dashboard } = useDashboard();
  const { showToast } = useToast();
  const [scanModal, setScanModal] = useState(false);
  const [scanMealType, setScanMealType] = useState('lunch');
  const [scanResult, setScanResult] = useState<any>(null);

  const handleScan = (source: 'camera' | 'gallery', mealType: string) => {
    setScanModal(false);
    const mutation = source === 'camera' ? scanCamera : scanGallery;
    mutation.mutate(
      { meal_type: mealType },
      {
        onSuccess: (data) => {
          setScanResult(data);
          showToast(`${data.items_logged} items logged! +25 XP 📸`, 'success');
        },
        onError: (err: any) => {
          const msg = err.message || err.response?.data?.detail || 'Scan failed';
          if (!msg.includes('No image')) showToast(msg, 'error');
        },
      }
    );
  };

  const handleGenMeal = () => {
    genMeal.mutate({ cuisine_preference: 'Indian' }, {
      onSuccess: () => showToast('Meal plan generated! +25 XP 🍽️', 'success'),
      onError: (err: any) => showToast(err.response?.data?.detail || 'Failed', 'error'),
    });
  };

  const protein = dashboard?.protein_g ?? 0;
  const carbs = dashboard?.carbs_g ?? 0;
  const fat = dashboard?.fat_g ?? 0;
  const proteinTarget = dashboard?.protein_target_g ?? 150;
  const carbsTarget = dashboard?.carbs_target_g ?? 220;
  const fatTarget = dashboard?.fat_target_g ?? 73;

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={st.header}>
          <Text style={st.title}>Nutrition</Text>
          <Text style={st.subtitle}>Track meals & generate Indian-focused plans</Text>
        </View>

        {/* Action Buttons Row */}
        <View style={st.actionRow}>
          <Pressable onPress={handleGenMeal} style={[st.actionBtn, { flex: 1 }]}>
            <LinearGradient colors={Colors.gradientMintSky} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.actionGrad}>
              {genMeal.isPending ? <ActivityIndicator color="#000" /> : (
                <><Ionicons name="restaurant" size={18} color="#000" /><Text style={st.actionText}>AI Meal Plan</Text></>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => setScanModal(true)} style={[st.actionBtn, { flex: 1 }]}>
            <LinearGradient colors={Colors.gradientCoralGold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.actionGrad}>
              <Ionicons name="camera" size={18} color="#000" />
              <Text style={st.actionText}>Scan Food</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Real Macro Bars */}
        <View style={st.macroBar}>
          <MacroBar label="Protein" value={protein} target={proteinTarget} color={Colors.protein} />
          <MacroBar label="Carbs" value={carbs} target={carbsTarget} color={Colors.carbs} />
          <MacroBar label="Fat" value={fat} target={fatTarget} color={Colors.fat} />
        </View>

        {/* Scan Result */}
        {scanResult && (
          <View style={st.scanResult}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={st.scanTitle}>📸 Last Scan</Text>
              <View style={st.xpBadge}><Text style={st.xpText}>+25 XP</Text></View>
            </View>
            {scanResult.items.map((item: any, i: number) => (
              <View key={i} style={st.scanItem}>
                <Text style={st.scanItemName}>{item.name} ({item.portion})</Text>
                <Text style={st.scanItemMacros}>{item.calories} kcal • P:{item.protein_g}g C:{item.carbs_g}g F:{item.fat_g}g</Text>
              </View>
            ))}
            <View style={st.scanTotals}>
              <Text style={st.scanTotalText}>Total: {scanResult.total_calories} kcal</Text>
              <Text style={st.scanProvider}>via {scanResult.provider_used}</Text>
            </View>
          </View>
        )}

        {/* Generated Meal Plan */}
        {genMeal.data && (
          <View style={st.plan}>
            <Text style={st.planTitle}>{genMeal.data.plan_name}</Text>
            <Text style={st.planMeta}>🎯 {genMeal.data.daily_calorie_target} kcal  📊 {genMeal.data.macro_split}</Text>
            {genMeal.data.days.map((day: any, i: number) => (
              <View key={i} style={st.card}>
                <Text style={st.dayTitle}>{day.day}</Text>
                {day.meals.map((m: any, j: number) => (
                  <View key={j} style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingTop: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.mint, textTransform: 'capitalize' }}>
                      {getMealEmoji(m.meal_type)} {m.meal_type} — {m.time_suggestion}
                    </Text>
                    {m.items.map((it: any, k: number) => (
                      <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                        <Text style={{ fontSize: 13, color: Colors.textPrimary, flex: 1 }}>{it.name} ({it.portion})</Text>
                        <Text style={{ fontSize: 12, color: Colors.gold }}>{it.calories} kcal</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Today's Log */}
        <View style={{ marginTop: 16 }}>
          <Text style={st.sectionTitle}>Today's Log</Text>
          {['breakfast', 'lunch', 'dinner', 'snack'].map((m) => (
            <Pressable key={m} onPress={() => { setScanMealType(m); setScanModal(true); }} style={st.logCard}>
              <Text style={{ fontSize: 24 }}>{getMealEmoji(m)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: Colors.textPrimary, fontWeight: '500', textTransform: 'capitalize' }}>{m}</Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>Tap to scan or add items</Text>
              </View>
              <Ionicons name="camera-outline" size={22} color={Colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Scan Modal */}
      <Modal visible={scanModal} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Scan Food — {scanMealType}</Text>
            <Pressable onPress={() => handleScan('camera', scanMealType)} style={st.modalBtn}>
              <Ionicons name="camera" size={22} color={Colors.textPrimary} />
              <Text style={st.modalBtnText}>Take Photo</Text>
            </Pressable>
            <Pressable onPress={() => handleScan('gallery', scanMealType)} style={st.modalBtn}>
              <Ionicons name="images" size={22} color={Colors.textPrimary} />
              <Text style={st.modalBtnText}>Choose from Gallery</Text>
            </Pressable>
            <Pressable onPress={() => setScanModal(false)} style={st.modalCancel}>
              <Text style={st.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { fontSize: FontSize.hero, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.xs },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginHorizontal: Spacing.md, marginBottom: Spacing.lg },
  actionBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  actionGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  actionText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#000' },
  macroBar: { marginHorizontal: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, marginBottom: Spacing.lg, gap: 8 },
  scanResult: { marginHorizontal: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, marginBottom: Spacing.lg },
  scanTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: 8 },
  xpBadge: { backgroundColor: 'rgba(126,222,196,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  xpText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.mint },
  scanItem: { paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  scanItemName: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  scanItemMacros: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  scanTotals: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  scanTotalText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold },
  scanProvider: { fontSize: FontSize.xs, color: Colors.textMuted },
  plan: { marginHorizontal: Spacing.md, marginBottom: Spacing.lg },
  planTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 4 },
  planMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, marginBottom: 8 },
  dayTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  logCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, marginBottom: 8, gap: Spacing.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl, gap: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center', textTransform: 'capitalize' },
  modalBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, padding: Spacing.md },
  modalBtnText: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  modalCancel: { alignItems: 'center', paddingVertical: Spacing.md },
  modalCancelText: { fontSize: FontSize.md, color: Colors.textMuted },
});
