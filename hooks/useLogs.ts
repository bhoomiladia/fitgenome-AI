/**
 * Hooks for manual logging of workouts and nutrition.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { logsApi } from '@/lib/api';

export function useWorkoutLogs() {
  return useQuery({
    queryKey: ['workoutLogs'],
    queryFn: async () => {
      const res = await logsApi.getWorkoutLogs();
      return res.data;
    },
  });
}

export function useLogWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      exercise_name: string;
      sets: number;
      reps: number;
      weight_kg?: number;
      duration_minutes?: number;
      notes?: string;
    }) => logsApi.logWorkout(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workoutLogs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useNutritionLogs() {
  return useQuery({
    queryKey: ['nutritionLogs'],
    queryFn: async () => {
      const res = await logsApi.getNutritionLogs();
      return res.data;
    },
  });
}

export function useLogNutrition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      food_item: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      meal_type: string;
    }) => logsApi.logNutrition(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutritionLogs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useLogWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (weight_kg: number) => logsApi.logWeight({ weight_kg }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-twin'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['weightLogs'] });
    },
  });
}

export function useWeightLogs() {
  return useQuery({
    queryKey: ['weightLogs'],
    queryFn: async () => {
      const res = await logsApi.getWeightLogs();
      return res.data;
    },
  });
}
