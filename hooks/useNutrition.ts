/**
 * Nutrition-related hooks using TanStack Query.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi, gamificationApi } from '@/lib/api';

export function useGenerateMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      dietary_restrictions?: string[];
      cuisine_preference?: string;
    }) => {
      const result = await aiApi.generateMealPlan(data).then((r) => r.data);

      // Auto-award XP for generating a plan
      try {
        await gamificationApi.award({
          source: 'plan_generated',
          description: 'Generated AI meal plan',
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
