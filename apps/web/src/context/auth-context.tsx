'use client';

/**
 * SHEHSWAR ONE360 - Authentication & Permission Context
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, Action, Resource, SecurityContext } from '@shehswar/types';
import { ApiClient, isJwtExpired } from '../lib/api-client';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (action: Action, resource: Resource, context?: SecurityContext) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check initial session & actively monitor 30-day expiration
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('shehswar_token');
        if (!token || isJwtExpired(token)) {
          if (token) {
            // Token has expired
            ApiClient.handleUnauthorized();
          }
          setUser(null);
          return;
        }

        const res = await ApiClient.get<AuthUser>('/api/v1/auth/me');
        if (res.success && res.data) {
          setUser(res.data);
        } else {
          ApiClient.handleUnauthorized();
          setUser(null);
        }
      } catch (err) {
        ApiClient.handleUnauthorized();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for 401 unauthorized / expiration events across all API requests
    const handleExpiredEvent = () => {
      setUser(null);
    };
    window.addEventListener('shehswar:auth:expired', handleExpiredEvent);

    // Active session monitor: check token expiration periodically and on tab focus
    const checkTokenExpiry = () => {
      const token = localStorage.getItem('shehswar_token');
      if (!token) return;
      if (isJwtExpired(token)) {
        ApiClient.handleUnauthorized();
        setUser(null);
      }
    };

    const intervalId = setInterval(checkTokenExpiry, 30000); // Check every 30 seconds
    window.addEventListener('focus', checkTokenExpiry);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkTokenExpiry();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('shehswar:auth:expired', handleExpiredEvent);
      clearInterval(intervalId);
      window.removeEventListener('focus', checkTokenExpiry);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await ApiClient.post<{
        tokens: { accessToken: string; refreshToken?: string; expiresIn?: number };
        user: AuthUser;
      }>('/api/v1/auth/login', { email, password });

      if (res.data) {
        localStorage.setItem('shehswar_token', res.data.tokens.accessToken);
        if (res.data.tokens.refreshToken) {
          localStorage.setItem('shehswar_refresh_token', res.data.tokens.refreshToken);
        }
        setUser(res.data.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await ApiClient.post('/api/v1/auth/logout', {});
    } catch {
      // Ignored on logout
    } finally {
      localStorage.removeItem('shehswar_token');
      localStorage.removeItem('shehswar_refresh_token');
      localStorage.removeItem('shehswar_active_company');
      localStorage.removeItem('shehswar_active_company_name');
      setUser(null);
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  };

  const can = (action: Action, resource: Resource, context?: SecurityContext): boolean => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;

    // Check organization boundary
    if (context?.organizationId && context.organizationId !== user.organizationId) {
      return false;
    }

    // Check permission string
    const specificPerm = `${resource}:${action}`;
    const wildcardPerm = `${resource}:*`;
    return user.permissions.includes(specificPerm) || user.permissions.includes(wildcardPerm);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
