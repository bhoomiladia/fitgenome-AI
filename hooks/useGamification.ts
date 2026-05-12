/**
 * Gamification hook — XP status, streak, and award.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gamificationApi } from '@/lib/api';

interface XPStatus {
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  xp_to_next_level: number;
  recent_xp: Array<{ xp: number; source: string; description: string }>;
}

export function useGamificationStatus() {
  return useQuery<XPStatus>({
    queryKey: ['gamification'],
    queryFn: async () => {
      const { data } = await gamificationApi.status();
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useAwardXP() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { source: string; description?: string }) =>
      gamificationApi.award(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
