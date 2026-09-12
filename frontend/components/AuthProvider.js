'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '@/lib/api';
import { ROLES, STAFF_ROLES } from '@/lib/constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // "loading" until we know whether the stored token is still valid, so guards
  // don't redirect a signed-in user away on first paint.
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();

    if (!getToken()) {
      setLoading(false);
      return () => controller.abort();
    }

    api.auth
      .me(controller.signal)
      .then(({ user: me }) => setUser(me))
      .catch((error) => {
        // An expired or revoked token: clear it rather than retrying forever.
        if (error.name !== 'AbortError') {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const login = useCallback(async (credentials) => {
    const { token, user: me } = await api.auth.login(credentials);
    setToken(token);
    setUser(me);
    return me;
  }, []);

  const register = useCallback(async (payload) => {
    const { token, user: me } = await api.auth.register(payload);
    setToken(token);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    router.push('/');
  }, [router]);

  const refresh = useCallback(async () => {
    const { user: me } = await api.auth.me();
    setUser(me);
    return me;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refresh,
      isAuthenticated: !!user,
      isAdmin: user?.role === ROLES.ADMIN,
      isReceptionist: user?.role === ROLES.RECEPTIONIST,
      isStaff: STAFF_ROLES.includes(user?.role),
      isCustomer: user?.role === ROLES.CUSTOMER,
    }),
    [user, loading, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
