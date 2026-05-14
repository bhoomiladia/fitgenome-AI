/**
 * User hook — fetches and updates current user profile.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';

export function useUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await authApi.me();
      return res.data;
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => authApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['digital-twin'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
