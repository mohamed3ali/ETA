'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'owner' | 'admin' | 'accountant' | 'employee';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId: string;
  locale: 'en' | 'ar';
}

export interface AuthCompany {
  id: string;
  name: string;
  status: string;
  taxRegistrationNumber?: string;
  defaultCurrency?: string;
}

export interface AccessibleCompany {
  id: string;
  name: string;
  status: string;
  taxRegistrationNumber?: string;
  role: UserRole;
  isDefault?: boolean;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  company: AuthCompany | null;
  companies: AccessibleCompany[];
  setSession: (s: {
    tokens: { accessToken: string; refreshToken: string };
    user: AuthUser;
    company: AuthCompany;
    companies?: AccessibleCompany[];
  }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (u: AuthUser) => void;
  setCompany: (c: AuthCompany) => void;
  setCompanies: (companies: AccessibleCompany[]) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      company: null,
      companies: [],
      setSession: ({ tokens, user, company, companies }) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user,
          company,
          companies: companies ?? [],
        }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      setCompany: (company) => set({ company }),
      setCompanies: (companies) => set({ companies }),
      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          company: null,
          companies: [],
        }),
    }),
    {
      name: 'eta-auth',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
