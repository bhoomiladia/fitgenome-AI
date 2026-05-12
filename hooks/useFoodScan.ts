/**
 * Food scanning hook — picks image, converts to base64, sends to vision API.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { visionApi, gamificationApi } from '@/lib/api';

interface ScanResult {
  items: Array<{
    name: string;
    portion: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  provider_used: string;
  image_quality_score: number;
  items_logged: number;
}

export function useFoodScan() {
  const queryClient = useQueryClient();

  return useMutation<ScanResult, Error, { meal_type: string }>({
    mutationFn: async ({ meal_type }) => {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Camera permission is required to scan food');
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (result.canceled || !result.assets[0]?.base64) {
        throw new Error('No image captured');
      }

      const base64 = result.assets[0].base64;

      // Send to vision API
      const { data } = await visionApi.scanFood({
        image_base64: base64,
        meal_type,
      });

      // Auto-award XP
      try {
        await gamificationApi.award({
          source: 'scan_food',
          description: `Scanned ${data.items.length} food item(s)`,
        });
      } catch {
        // Non-critical
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });
}

export function useFoodScanFromGallery() {
  const queryClient = useQueryClient();

  return useMutation<ScanResult, Error, { meal_type: string }>({
    mutationFn: async ({ meal_type }) => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Gallery permission is required');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (result.canceled || !result.assets[0]?.base64) {
        throw new Error('No image selected');
      }

      const { data } = await visionApi.scanFood({
        image_base64: result.assets[0].base64,
        meal_type,
      });

      try {
        await gamificationApi.award({
          source: 'scan_food',
          description: `Scanned ${data.items.length} food item(s)`,
        });
      } catch {
        // Non-critical
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });
}
