import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { authApi, getToken, setToken, ApiRequestError } from '@/lib/api';
import type { Locale, User } from '@/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; phone?: string; preferredLocale?: Locale }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled: Boolean(getToken()),
    retry: false,
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password);
      setToken(res.token);
      queryClient.setQueryData(['auth', 'me'], res.user);
      return res.user;
    },
    [queryClient],
  );

  const register = useCallback(
    async (data: { name: string; email: string; password: string; phone?: string; preferredLocale?: Locale }) => {
      const res = await authApi.register({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        locale: data.preferredLocale,
      });
      setToken(res.token);
      queryClient.setQueryData(['auth', 'me'], res.user);
      return res.user;
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    setToken(null);
    queryClient.setQueryData(['auth', 'me'], null);
    queryClient.removeQueries({ queryKey: ['auth'] });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isLoading: Boolean(getToken()) && isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
}
