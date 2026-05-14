/**
 * Dashboard data hook — fetches real aggregated stats from the backend.
 */

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';

interface GamificationSnapshot {
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  xp_to_next_level: number;
}

export interface DashboardStats {
  full_name: string;
  fitness_goal: string | null;
  fitness_score: number;
  calories_consumed: number;
  calories_target: number;
  protein_g: number;
  protein_target_g: number;
  carbs_g: number;
  carbs_target_g: number;
  fat_g: number;
  fat_target_g: number;
  steps: number;
  sleep_hours: number;
  workouts_this_week: number;
  gamification: GamificationSnapshot;
}

export function useDashboard() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await dashboardApi.get();
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
