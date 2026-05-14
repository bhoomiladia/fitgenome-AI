/**
 * Digital Twin / Progress hook — fetches 30-day trajectory prediction.
 */

import { useQuery } from '@tanstack/react-query';
import { progressApi } from '@/lib/api';

interface TrajectoryPoint {
  day: number;
  date: string;
  weight_kg: number;
  body_fat_pct: number;
  muscle_mass_kg: number;
  cumulative_deficit_kcal: number;
}

interface DigitalTwinSummary {
  total_weight_change_kg: number;
  weekly_rate_kg: number;
  projected_end_weight_kg: number;
  adherence_required: number;
  recommendation: string;
}

export interface DigitalTwinData {
  trajectory: TrajectoryPoint[];
  summary: DigitalTwinSummary;
  input_params: {
    current_weight_kg: number;
    tdee: number;
    avg_daily_calories: number;
    adherence_rate: number;
    fitness_goal: string;
  };
}

export function useDigitalTwin() {
  return useQuery<DigitalTwinData>({
    queryKey: ['digital-twin'],
    queryFn: async () => {
      const { data } = await progressApi.digitalTwin();
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
