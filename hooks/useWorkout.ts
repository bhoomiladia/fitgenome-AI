/**
 * Workout-related hooks using TanStack Query.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi, gamificationApi } from '@/lib/api';

export function useGenerateWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: string) => {
      const result = await aiApi.generateWorkout({ preferences }).then((r) => r.data);

      // Auto-award XP for generating a plan
      try {
        await gamificationApi.award({
          source: 'plan_generated',
          description: 'Generated AI workout plan',
        });
      } catch {
        // XP award is non-critical
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });
}

export function useWorkoutFeedback() {
  return useMutation({
    mutationFn: (data: { difficulty_rating: number; notes?: string }) =>
      aiApi.submitFeedback(data).then((r) => r.data),
  });
}
