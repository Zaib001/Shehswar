'use client';

/**
 * SHEHSWAR ONE360 - Enterprise Authentication Gateway
 *
 * Real production login page connecting directly to the local backend API:
 * POST http://localhost:4000/api/v1/auth/login
 *
 * Verifies credentials against local PostgreSQL database, creates real sessions,
 * acquires signed JWT access tokens, and loads RBAC permission contexts.
 */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { useTheme } from '../../context/theme-context';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from '../../components/ui';
import {
  IconShield,
  IconSun,
  IconMoon,
  IconCheck,
  IconAlertTriangle,
} from '../../components/icons';

interface PresetUser {
  label: string;
  role: string;
  email: string;
  badgeVariant: 'primary' | 'warning' | 'info' | 'secondary';
  description: string;
}

const PRESET_USERS: PresetUser[] = [
  {
    label: 'Super Admin',
    role: 'ROLE_SUPER_ADMIN',
    email: 'admin@shehswar.com',
    badgeVariant: 'danger' as any,
    description: 'Unrestricted system-wide access across all companies and platform domains',
  },
  {
    label: 'Procurement Manager',
    role: 'ROLE_PROCUREMENT_MGR',
    email: 'procurement.manager@shehswar.com',
    badgeVariant: 'primary',
    description: 'Full procurement suite: Vendors, PR, RFQ, Quotes, Comparison, PO, GRN, Scorecards',
  },
  {
    label: 'Finance Manager',
    role: 'ROLE_FINANCE_MGR',
    email: 'finance.manager@shehswar.com',
    badgeVariant: 'warning',
    description: 'Financial controls: PO approvals, vendor fiscal verification, costing clearance',
  },
  {
    label: 'Department User',
    role: 'ROLE_DEPT_USER',
    email: 'dept.user@shehswar.com',
    badgeVariant: 'info',
    description: 'Plant requisition requester: PR create, edit, submit, and PO status tracking',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('procurement.manager@shehswar.com');
  const [password, setPassword] = useState('Shehswar@2026!');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already authenticated, redirect to root dashboard
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      // Success! Next navigation handled by useEffect or router push
      router.push('/');
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPreset = (preset: PresetUser) => {
    setEmail(preset.email);
    setPassword('Shehswar@2026!');
    setErrorMessage(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Subtle Gradient Blobs */}
      <div
        style={{
          position: 'absolute',
          top: '-150px',
          right: '-150px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(13, 148, 136, 0.12) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-150px',
          left: '-150px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(2, 132, 199, 0.12) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Controls: Theme Toggle */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{
            padding: '8px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>
      </div>

      <div style={{ maxWidth: '480px', width: '100%', zIndex: 1 }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '54px',
              height: '54px',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              marginBottom: '16px',
              boxShadow: '0 8px 24px rgba(13, 148, 136, 0.3)',
            }}
          >
            <IconShield size={28} />
          </div>
          <h1
            style={{
              fontSize: '26px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: '0 0 6px 0',
              color: 'var(--text-primary)',
            }}
          >
            SHEHSWAR ONE360
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              margin: 0,
              fontWeight: 500,
            }}
          >
            Agrochemical & Fertilizer Manufacturing ERP
          </p>
        </div>

        {/* Login Card */}
        <Card
          style={{
            backgroundColor: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
          }}
        >
          <CardHeader style={{ padding: '24px 24px 16px 24px' }}>
            <CardTitle style={{ fontSize: '18px', fontWeight: 600 }}>
              Sign In to Your Workspace
            </CardTitle>
            <CardDescription style={{ fontSize: '13px' }}>
              Enter your enterprise credentials to access Shehswar ONE360.
            </CardDescription>
          </CardHeader>

          <CardContent style={{ padding: '0 24px 24px 24px' }}>
            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--danger-500)',
                  fontSize: '13px',
                  fontWeight: 500,
                  marginBottom: '18px',
                }}
              >
                <IconAlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: 'var(--text-primary)',
                  }}
                >
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="name@shehswar.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                  autoComplete="email"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    Password
                  </label>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Default: Shehswar@2026!
                  </span>
                </div>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                  autoComplete="current-password"
                  style={{ width: '100%' }}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(13, 148, 136, 0.25)',
                }}
              >
                {isSubmitting ? 'Authenticating with API...' : 'Sign In'}
              </Button>
            </form>

            {/* Real Database Quick-Select Test Accounts */}
            <div
              style={{
                marginTop: '24px',
                paddingTop: '20px',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  Real PostgreSQL Test Users
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>
                  Click to populate
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {PRESET_USERS.map((preset) => {
                  const isSelected = email === preset.email;
                  return (
                    <div
                      key={preset.email}
                      onClick={() => handleSelectPreset(preset)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isSelected ? 'var(--bg-canvas)' : 'var(--bg-surface)',
                        border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-default)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {preset.label}
                          </span>
                          <Badge variant={preset.badgeVariant} size="sm">
                            {preset.role.replace('ROLE_', '')}
                          </Badge>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {preset.email}
                        </span>
                      </div>
                      {isSelected && (
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                          }}
                        >
                          <IconCheck size={12} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security & Multi-Company Architecture Footer */}
        <div
          style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          <span>Multi-Company Isolation • PostgreSQL 16 • RFC 9562 UUIDv7</span>
          <br />
          <span>Parent: Shehswar Industries (Pvt) Ltd. | Child: Shehswar Distribution Co.</span>
        </div>
      </div>
    </div>
  );
}
