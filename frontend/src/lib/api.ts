import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth-store';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  withCredentials: false,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

const refreshAccess = async (): Promise<string | null> => {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) return null;
      const res = await axios.post(
        `${api.defaults.baseURL}/auth/refresh`,
        { refreshToken },
        { timeout: 10000 },
      );
      const tokens = res.data?.data?.tokens;
      if (!tokens) return null;
      useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
      return tokens.accessToken as string;
    } catch {
      useAuthStore.getState().clear();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
};

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry && original.url !== '/auth/refresh') {
      original._retry = true;
      const newToken = await refreshAccess();
      if (newToken) {
        original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${newToken}` };
        return api.request(original);
      }
    }
    return Promise.reject(error);
  },
);

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
  items?: T extends Array<infer U> ? U[] : never;
}

export interface PaginatedResponse<T> {
  success: boolean;
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
