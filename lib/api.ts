/**
 * Axios instance with JWT auth interceptor + typed API helpers for every backend endpoint.
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api/v1'
  : 'https://api.fitgenome.ai/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: inject Bearer token ──────────
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // SecureStore not available (web), skip
  }
  return config;
});

// ── Response interceptor: handle 401 ──────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('access_token').catch(() => {});
    }
    return Promise.reject(error);
  }
);

// ── Typed API helpers ─────────────────────────────────

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; full_name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// ── Onboarding ───────────────────────────────────────
export const onboardingApi = {
  submit: (data: {
    age: number;
    gender: string;
    height_cm: number;
    weight_kg: number;
    activity_level: string;
    fitness_goal: string;
  }) => api.post('/onboarding', data),
};

// ── Dashboard ────────────────────────────────────────
export const dashboardApi = {
  get: () => api.get('/dashboard'),
};

// ── AI Generation ────────────────────────────────────
export const aiApi = {
  generateWorkout: (data: { preferences?: string }) =>
    api.post('/ai/generate-workout', data),
  generateMealPlan: (data: {
    dietary_restrictions?: string[];
    cuisine_preference?: string;
  }) => api.post('/ai/generate-meal-plan', data),
  submitFeedback: (data: { difficulty_rating: number; notes?: string }) =>
    api.post('/ai/workout-feedback', data),
};

// ── Vision / Food Scanning ───────────────────────────
export const visionApi = {
  scanFood: (data: { image_base64: string; meal_type: string }) =>
    api.post('/vision/scan-food', data),
};

// ── Gamification ─────────────────────────────────────
export const gamificationApi = {
  status: () => api.get('/gamification/status'),
  award: (data: { source: string; description?: string }) =>
    api.post('/gamification/award', data),
};

// ── Progress / Digital Twin ──────────────────────────
export const progressApi = {
  digitalTwin: () => api.get('/progress/digital-twin'),
};

// ── AI Coach Chat ────────────────────────────────────
export const chatApi = {
  send: (data: { message: string }) =>
    api.post('/chat', data),
};
