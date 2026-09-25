'use client';

/**
 * SHEHSWAR ONE360 - Authentication & Permission Context
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, Action, Resource, SecurityContext } from '@shehswar/types';
import { ApiClient } from '../lib/api-client';

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

  useEffect(() => {
    // Check initial session
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('shehswar_token');
        if (token) {
          const res = await ApiClient.get<AuthUser>('/api/v1/auth/me');
          if (res.success && res.data) {
            setUser(res.data);
          }
        }
      } catch (err) {
        localStorage.removeItem('shehswar_token');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await ApiClient.post<{ tokens: { accessToken: string }; user: AuthUser }>(
        '/api/v1/auth/login',
        { email, password },
      );
      if (res.data) {
        localStorage.setItem('shehswar_token', res.data.tokens.accessToken);
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
      localStorage.removeItem('shehswar_active_company');
      setUser(null);
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
