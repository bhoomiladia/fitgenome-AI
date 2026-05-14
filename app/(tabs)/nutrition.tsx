/**
 * Nutrition Screen — Real macro data, AI meal plan, food scanning.
 */

import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useGenerateMealPlan, useLatestMealPlan } from '@/hooks/useNutrition';
import { useFoodScan, useFoodScanFromGallery } from '@/hooks/useFoodScan';
import { useLogNutrition, useNutritionLogs } from '@/hooks/useLogs';
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
  const { data: latestMealPlan, isLoading: isLatestLoading } = useLatestMealPlan();
  const scanCamera = useFoodScan();
  const scanGallery = useFoodScanFromGallery();
  const logNutrition = useLogNutrition();
  const { data: nutritionLogs } = useNutritionLogs();
  const { data: dashboard } = useDashboard();
  const { showToast } = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const [logsY, setLogsY] = useState(0);
  const activeMealPlan = genMeal.data || latestMealPlan;

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
  const [scanModal, setScanModal] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [scanMealType, setScanMealType] = useState('lunch');
  const [scanResult, setScanResult] = useState<any>(null);
  const [preferences, setPreferences] = useState('');
  const [showPrefs, setShowPrefs] = useState(false);

  // Manual form state
  const [foodItem, setFoodItem] = useState('');
  const [calories, setCalories] = useState('');
  const [mProtein, setMProtein] = useState('');
  const [mCarbs, setMCarbs] = useState('');
  const [mFat, setMFat] = useState('');
  const [completedDays, setCompletedDays] = useState<string[]>([]);

  const handleManualLog = () => {
    if (!foodItem || !calories) {
      showToast('Food name and calories are required', 'error');
      return;
    }
    logNutrition.mutate({
      food_item: foodItem,
      calories: parseFloat(calories),
      protein_g: mProtein ? parseFloat(mProtein) : 0,
      carbs_g: mCarbs ? parseFloat(mCarbs) : 0,
      fat_g: mFat ? parseFloat(mFat) : 0,
      meal_type: scanMealType,
    }, {
      onSuccess: () => {
        showToast('Meal logged! 🍽️', 'success');
        setFoodItem('');
        setCalories('');
        setMProtein('');
        setMCarbs('');
        setMFat('');
        setShowManualForm(false);
        setScanModal(false);
        
        // Auto-scroll to history
        setTimeout(() => {
          scrollRef.current?.scrollTo({ y: logsY, animated: true });
        }, 500);
      },
      onError: () => showToast('Failed to log meal', 'error'),
    });
  };

  const handleFollowDayPlan = async (day: any) => {
    if (completedDays.includes(day.day)) return;
    
    try {
      showToast(`Logging meals for ${day.day}...`, 'info');
      for (const meal of day.meals) {
        for (const item of meal.items) {
          await logNutrition.mutateAsync({
            food_item: item.name,
            calories: item.calories,
            protein_g: item.protein_g || 0,
            carbs_g: item.carbs_g || 0,
            fat_g: item.fat_g || 0,
            meal_type: meal.meal_type,
          });
        }
      }
      setCompletedDays(prev => [...prev, day.day]);
      showToast(`Day "${day.day}" meals logged! +50 XP 🍽️`, 'success');

      // Auto-scroll to history
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: logsY, animated: true });
      }, 500);
    } catch {
      showToast('Failed to log some meals', 'error');
    }
  };

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
    genMeal.mutate({ 
      cuisine_preference: preferences || 'Indian',
    }, {
      onSuccess: () => {
        showToast('Meal plan generated! +25 XP 🍽️', 'success');
        setShowPrefs(false);
      },
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
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={st.header}>
          <Text style={st.title}>Nutrition</Text>
          <Text style={st.subtitle}>Track meals & generate Indian-focused plans</Text>
        </View>

        <Pressable onPress={() => setShowPrefs(!showPrefs)} style={st.prefsToggle}>
          <Ionicons name={showPrefs ? 'chevron-up' : 'options-outline'} size={16} color={Colors.textMuted} />
          <Text style={st.prefsToggleText}>{showPrefs ? 'Hide preferences' : 'Add dietary preferences'}</Text>
        </Pressable>

        {showPrefs && (
          <TextInput 
            style={st.prefsInput} 
            placeholder="e.g. Vegetarian, No Dairy, Keto style" 
            placeholderTextColor={Colors.textMuted} 
            value={preferences} 
            onChangeText={setPreferences} 
            multiline 
            maxLength={500} 
          />
        )}

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
        {isLatestLoading && !genMeal.data && (
          <ActivityIndicator color={Colors.mint} style={{ marginVertical: 20 }} />
        )}
        {activeMealPlan && (
          <View style={st.plan}>
            <Text style={st.planTitle}>{activeMealPlan.plan_name}</Text>
            <Text style={st.planMeta}>🎯 {activeMealPlan.daily_calorie_target} kcal  📊 {activeMealPlan.macro_split}</Text>
            {activeMealPlan.days.map((day: any, i: number) => (
              <View key={i} style={st.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={st.dayTitle}>{day.day}</Text>
                  <Pressable 
                    onPress={() => handleFollowDayPlan(day)} 
                    style={[st.followBtn, completedDays.includes(day.day) && { backgroundColor: 'rgba(126,222,196,0.2)' }]}
                  >
                    <Ionicons 
                      name={completedDays.includes(day.day) ? "checkbox" : "square-outline"} 
                      size={18} 
                      color={completedDays.includes(day.day) ? Colors.mint : Colors.textMuted} 
                    />
                    <Text style={[st.followText, completedDays.includes(day.day) && { color: Colors.mint }]}>
                      {completedDays.includes(day.day) ? "Followed" : "Follow Day"}
                    </Text>
                  </Pressable>
                </View>
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

        {/* Day-wise Nutrition History */}
        <View onLayout={(e) => setLogsY(e.nativeEvent.layout.y)} style={{ marginTop: 24, paddingHorizontal: Spacing.lg }}>
          <Text style={st.sectionTitle}>Your History</Text>
          {nutritionLogs && nutritionLogs.length > 0 ? (
            groupLogs(nutritionLogs).map(([date, entries]) => {
              const dayTotal = entries.reduce((acc, curr) => acc + (curr.calories || 0), 0);
              return (
                <View key={date} style={st.dayGroup}>
                  <View style={st.dayHeader}>
                    <Text style={st.dateHeader}>{new Date(date).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
                    <Text style={st.dayTotal}>{Math.round(dayTotal)} kcal</Text>
                  </View>
                  {entries.map((log: any) => (
                    <View key={log.id} style={st.historyItem}>
                      <Text style={{ fontSize: 20, marginRight: 12 }}>{getMealEmoji(log.meal_type)}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={st.historyFood}>{log.food_item}</Text>
                          <Text style={st.historyCals}>{Math.round(log.calories)} kcal</Text>
                        </View>
                        <View style={st.historyFooter}>
                          <Text style={st.historyMeta}>
                            {new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text style={st.historyMacros}>P:{log.protein_g}g C:{log.carbs_g}g F:{log.fat_g}g</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })
          ) : (
            <Text style={st.emptyText}>No meals logged yet. Start today!</Text>
          )}
        </View>
      </ScrollView>

      {/* Scan Modal */}
      <Modal visible={scanModal} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, showManualForm && { height: '80%' }]}>
            <Text style={st.modalTitle}>{showManualForm ? 'Manual Log' : 'Scan Food'} — {scanMealType}</Text>
            
            {!showManualForm ? (
              <>
                <Pressable onPress={() => handleScan('camera', scanMealType)} style={st.modalBtn}>
                  <Ionicons name="camera" size={22} color={Colors.textPrimary} />
                  <Text style={st.modalBtnText}>Take Photo</Text>
                </Pressable>
                <Pressable onPress={() => handleScan('gallery', scanMealType)} style={st.modalBtn}>
                  <Ionicons name="images" size={22} color={Colors.textPrimary} />
                  <Text style={st.modalBtnText}>Choose from Gallery</Text>
                </Pressable>
                <Pressable onPress={() => setShowManualForm(true)} style={[st.modalBtn, { backgroundColor: 'rgba(126,222,196,0.1)' }]}>
                  <Ionicons name="create-outline" size={22} color={Colors.mint} />
                  <Text style={[st.modalBtnText, { color: Colors.mint }]}>Log Manually</Text>
                </Pressable>
              </>
            ) : (
              <ScrollView style={{ gap: Spacing.md }}>
                <View style={st.manualField}>
                  <Text style={st.manualLabel}>Food Item</Text>
                  <TextInput style={st.manualInput} value={foodItem} onChangeText={setFoodItem} placeholder="e.g. Paneer Tikka" placeholderTextColor={Colors.textMuted} />
                </View>
                <View style={st.manualRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.manualLabel}>Calories</Text>
                    <TextInput style={st.manualInput} value={calories} onChangeText={setCalories} placeholder="kcal" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.manualLabel}>Protein (g)</Text>
                    <TextInput style={st.manualInput} value={mProtein} onChangeText={setMProtein} placeholder="g" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
                  </View>
                </View>
                <View style={st.manualRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.manualLabel}>Carbs (g)</Text>
                    <TextInput style={st.manualInput} value={mCarbs} onChangeText={setMCarbs} placeholder="g" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.manualLabel}>Fat (g)</Text>
                    <TextInput style={st.manualInput} value={mFat} onChangeText={setMFat} placeholder="g" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
                  </View>
                </View>
                <Pressable onPress={handleManualLog} style={st.submitBtn}>
                  <Text style={st.submitText}>{logNutrition.isPending ? 'Logging...' : 'Save Meal Entry'}</Text>
                </Pressable>
                <Pressable onPress={() => setShowManualForm(false)} style={{ alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ color: Colors.textMuted }}>Back to Scan</Text>
                </Pressable>
              </ScrollView>
            )}

            <Pressable onPress={() => { setScanModal(false); setShowManualForm(false); }} style={st.modalCancel}>
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
  prefsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  prefsToggleText: { fontSize: FontSize.sm, color: Colors.textMuted },
  prefsInput: { marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.cardBorder, minHeight: 60, textAlignVertical: 'top' },
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
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.md },
  followText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
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
  
  // Manual Log styles
  manualField: { marginBottom: Spacing.md },
  manualLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase' },
  manualInput: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, padding: 12, fontSize: FontSize.sm, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.cardBorder },
  manualRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  submitBtn: { backgroundColor: Colors.mint, padding: 16, borderRadius: BorderRadius.lg, alignItems: 'center', marginTop: Spacing.md },
  submitText: { color: '#000', fontWeight: 'bold', fontSize: FontSize.md },

  // History styles
  dayGroup: { marginBottom: Spacing.xl },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder, paddingBottom: 8 },
  dateHeader: { fontSize: 13, fontWeight: '700', color: Colors.mint, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayTotal: { fontSize: 13, fontWeight: '600', color: Colors.gold },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceLight, padding: 14, borderRadius: BorderRadius.md, marginBottom: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  historyFood: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  historyCals: { fontSize: 14, fontWeight: '600', color: Colors.gold },
  historyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  historyMeta: { fontSize: 11, color: Colors.textMuted },
  historyMacros: { fontSize: 11, color: Colors.mint },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 20 },
});
