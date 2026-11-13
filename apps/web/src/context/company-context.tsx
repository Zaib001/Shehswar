'use client';

/**
 * SHEHSWAR ONE360 - Centralized Company Context & Isolation Provider
 *
 * Provides:
 * - Active Company context across the entire ERP frontend.
 * - Enforces authorized company access (superadmins or users with specific company assignments).
 * - Automatic synchronisation with ApiClient (`X-Company-ID` header).
 * - Smooth transition state with loading overlay when switching companies.
 * - Broadcasts change events so dependent views immediately refresh.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../lib/api-client';
import { useAuth } from './auth-context';

export interface CompanyRecord {
  id: string;
  code: string;
  name: string;
  isParent?: boolean;
  companyType?: string;
  currencyCode?: string;
}

export interface CompanyContextType {
  activeCompany: CompanyRecord | null;
  activeCompanyId: string;
  activeCompanyName: string;
  authorizedCompanies: CompanyRecord[];
  isLoading: boolean;
  isSwitchingCompany: boolean;
  switchingCompanyName: string;
  switchCompany: (companyOrId: CompanyRecord | string) => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [authorizedCompanies, setAuthorizedCompanies] = useState<CompanyRecord[]>([]);
  const [activeCompany, setActiveCompany] = useState<CompanyRecord | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [activeCompanyName, setActiveCompanyName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSwitchingCompany, setIsSwitchingCompany] = useState<boolean>(false);
  const [switchingCompanyName, setSwitchingCompanyName] = useState<string>('');

  // 1. Fetch available authorized companies and initialize active company
  const initCompanyContext = useCallback(async () => {
    try {
      const res = await ApiClient.get<CompanyRecord[]>('/api/v1/master-data/companies?all=true');
      const allCompanies = Array.isArray(res.data) ? res.data : [];

      // Determine authorized companies based on user permissions
      let authorized: CompanyRecord[] = allCompanies;
      if (user && !user.isSuperAdmin && !user.permissions?.includes('company:cross_company_view')) {
        // Filter by user's assigned company or authorizedCompanyIds if present
        const allowedIds = new Set<string>([user.companyId]);
        if ((user as any).authorizedCompanyIds) {
          (user as any).authorizedCompanyIds.forEach((id: string) => allowedIds.add(id));
        }
        authorized = allCompanies.filter((c) => allowedIds.has(c.id));
      }

      setAuthorizedCompanies(authorized);

      // Determine initial active company from localStorage or default
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('shehswar_active_company') : null;
      let targetComp: CompanyRecord | undefined;

      if (savedId && savedId !== 'ALL') {
        targetComp = authorized.find((c) => c.id === savedId);
      }

      // Default to Parent Company (Shehswar) or first available company
      if (!targetComp) {
        targetComp = authorized.find((c) => c.isParent || c.code === 'COMP-SHEHSWAR') || authorized[0];
      }

      if (targetComp) {
        setActiveCompany(targetComp);
        setActiveCompanyId(targetComp.id);
        setActiveCompanyName(targetComp.name);
        if (typeof window !== 'undefined') {
          localStorage.setItem('shehswar_active_company', targetComp.id);
          localStorage.setItem('shehswar_active_company_name', targetComp.name);
        }
      }
    } catch (err) {
      console.error('Failed to initialize company context', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    initCompanyContext();
  }, [initCompanyContext]);

  // 2. Centralized Company Switcher with Transition State
  const switchCompany = async (companyOrId: CompanyRecord | string) => {
    let target: CompanyRecord | undefined;
    if (typeof companyOrId === 'string') {
      target = authorizedCompanies.find((c) => c.id === companyOrId);
    } else {
      target = companyOrId;
    }

    if (!target) return;
    if (target.id === activeCompanyId) return;

    setSwitchingCompanyName(target.name);
    setIsSwitchingCompany(true);

    try {
      // Update state and storage
      setActiveCompany(target);
      setActiveCompanyId(target.id);
      setActiveCompanyName(target.name);

      if (typeof window !== 'undefined') {
        localStorage.setItem('shehswar_active_company', target.id);
        localStorage.setItem('shehswar_active_company_name', target.name);

        // Clear company-specific session filters
        sessionStorage.removeItem('shehswar_active_warehouse');
        sessionStorage.removeItem('shehswar_stock_filter');

        // Dispatch broadcast event for non-reloading components
        window.dispatchEvent(
          new CustomEvent('shehswar-company-context-changed', { detail: target }),
        );
      }

      // Allow 450ms visual transition for user feedback, then reload to refresh all workspace data
      await new Promise((resolve) => setTimeout(resolve, 450));
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } finally {
      setIsSwitchingCompany(false);
    }
  };

  return (
    <CompanyContext.Provider
      value={{
        activeCompany,
        activeCompanyId,
        activeCompanyName,
        authorizedCompanies,
        isLoading,
        isSwitchingCompany,
        switchingCompanyName,
        switchCompany,
      }}
    >
      {/* Visual Company Switching Transition Overlay */}
      {isSwitchingCompany && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontFamily: 'inherit',
          }}
        >
          <div
            style={{
              background: 'var(--surface-primary, #ffffff)',
              color: 'var(--text-primary, #0f172a)',
              padding: '28px 36px',
              borderRadius: '14px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              textAlign: 'center',
              maxWidth: '420px',
              width: '90%',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '3px solid var(--border-color, #e2e8f0)',
                borderTopColor: 'var(--brand-primary, #0d9488)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              Switching Company Context...
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)' }}>
              Loading <strong>{switchingCompanyName}</strong> workspace and isolated records.
            </div>
          </div>
        </div>
      )}
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = (): CompanyContextType => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
