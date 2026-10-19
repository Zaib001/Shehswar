'use client';

import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Select,
  Switch,
  Tabs,
} from '../ui';
import { IconSettings, IconCheck } from '../icons';
import { useToast } from '../../context/toast-context';

export const SystemSettingsView: React.FC = () => {
  const { showToast } = useToast();
  const [activeScope, setActiveScope] = useState<'PLATFORM' | 'ORGANIZATION' | 'COMPANY' | 'BRANCH'>('PLATFORM');
  const [isSaving, setIsSaving] = useState(false);

  // Settings State by Scope
  const [settings, setSettings] = useState({
    // General
    language: 'en-US',
    timezone: 'Asia/Karachi',
    currency: 'PKR',
    dateFormat: 'DD/MM/YYYY',
    // Security
    sessionDurationHours: 12,
    passwordMinLength: 10,
    mfaEnforced: true,
    maxFailedAttempts: 5,
    // Notifications
    emailAlertsEnabled: true,
    smsAlertsEnabled: true,
    whatsappDispatches: true,
    // Appearance
    defaultTheme: 'dark',
    companyLogoBranding: true,
  });

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showToast({
        title: 'Settings Applied',
        message: `Hierarchy configuration updated for scope [${activeScope}]`,
        type: 'success',
      });
    }, 500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconSettings size={22} style={{ color: 'var(--color-primary)' }} />
                Hierarchical System Settings Framework
              </CardTitle>
              <CardDescription>
                Cascading configuration inheritance: Platform Default → Organization Override → Company Override → Branch Override.
              </CardDescription>
            </div>
            <Button variant="primary" icon={<IconCheck size={16} />} onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardHeader>
        <CardContent style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          {/* Scope Hierarchy Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>Configuration Level:</span>
            {(['PLATFORM', 'ORGANIZATION', 'COMPANY', 'BRANCH'] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => setActiveScope(scope)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: activeScope === scope ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                  background: activeScope === scope ? 'var(--color-primary)' : 'var(--bg-card-subtle)',
                  color: activeScope === scope ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {scope === 'PLATFORM' && '1. Platform Default'}
                {scope === 'ORGANIZATION' && '2. Organization (Shehswar Group)'}
                {scope === 'COMPANY' && '3. Company Override (Chemicals Ltd)'}
                {scope === 'BRANCH' && '4. Branch Override'}
              </button>
            ))}
          </div>

          <Tabs
            tabs={[
              {
                id: 'general',
                label: 'General Regional',
                content: (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', paddingTop: '1rem' }}>
                    <Select
                      label="System Default Language"
                      value={settings.language}
                      onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                      options={[
                        { value: 'en-US', label: 'English (United States)' },
                        { value: 'ur-PK', label: 'Urdu (Pakistan) - اردُو' },
                        { value: 'ar-AE', label: 'Arabic (UAE) - العَرَبِية' },
                      ]}
                    />
                    <Select
                      label="Standard Operating Timezone"
                      value={settings.timezone}
                      onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                      options={[
                        { value: 'Asia/Karachi', label: 'Asia/Karachi (PKT GMT+5)' },
                        { value: 'Asia/Dubai', label: 'Asia/Dubai (GST GMT+4)' },
                        { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
                      ]}
                    />
                    <Select
                      label="Base Operating Currency"
                      value={settings.currency}
                      onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                      options={[
                        { value: 'PKR', label: 'PKR - Pakistani Rupee' },
                        { value: 'USD', label: 'USD - US Dollar' },
                        { value: 'AED', label: 'AED - UAE Dirham' },
                      ]}
                    />
                    <Select
                      label="Standard Date Representation"
                      value={settings.dateFormat}
                      onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
                      options={[
                        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 26/09/2026)' },
                        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO 8601)' },
                      ]}
                    />
                  </div>
                ),
              },
              {
                id: 'security',
                label: 'Security & Access Policy',
                content: (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', paddingTop: '1rem' }}>
                    <Input
                      label="JWT Session Lifetime (Hours)"
                      type="number"
                      value={settings.sessionDurationHours}
                      onChange={(e) => setSettings({ ...settings, sessionDurationHours: parseInt(e.target.value, 10) || 12 })}
                    />
                    <Input
                      label="Minimum Password Complexity Length"
                      type="number"
                      value={settings.passwordMinLength}
                      onChange={(e) => setSettings({ ...settings, passwordMinLength: parseInt(e.target.value, 10) || 8 })}
                    />
                    <Input
                      label="Max Failed Attempts Before Lockout"
                      type="number"
                      value={settings.maxFailedAttempts}
                      onChange={(e) => setSettings({ ...settings, maxFailedAttempts: parseInt(e.target.value, 10) || 5 })}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Multi-Factor Authentication (MFA)</span>
                      <Switch
                        checked={settings.mfaEnforced}
                        onChange={(checked) => setSettings({ ...settings, mfaEnforced: checked })}
                        label="Enforce for all Admin & Manager roles"
                      />
                    </div>
                  </div>
                ),
              },
              {
                id: 'notifications',
                label: 'Notifications & Dispatch Channels',
                content: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>Transactional Email Alerts</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Purchase order approvals, invoices, and payment confirmations via SMTP / SendGrid.</div>
                      </div>
                      <Switch
                        checked={settings.emailAlertsEnabled}
                        onChange={(checked) => setSettings({ ...settings, emailAlertsEnabled: checked })}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>SMS Security & Urgent Dispatch</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Emergency QC holds and high-value approvals dispatched via local SMS gateway.</div>
                      </div>
                      <Switch
                        checked={settings.smsAlertsEnabled}
                        onChange={(checked) => setSettings({ ...settings, smsAlertsEnabled: checked })}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>WhatsApp Business API Notifications</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Dealer delivery dispatch status and credit approval alerts.</div>
                      </div>
                      <Switch
                        checked={settings.whatsappDispatches}
                        onChange={(checked) => setSettings({ ...settings, whatsappDispatches: checked })}
                      />
                    </div>
                  </div>
                ),
              },
              {
                id: 'appearance',
                label: 'Appearance & Branding',
                content: (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', paddingTop: '1rem' }}>
                    <Select
                      label="Platform Color Theme Default"
                      value={settings.defaultTheme}
                      onChange={(e) => setSettings({ ...settings, defaultTheme: e.target.value })}
                      options={[
                        { value: 'dark', label: 'Dark Mode (Midnight Teal & Emerald)' },
                        { value: 'light', label: 'Light Mode (Enterprise Crisp Paper)' },
                      ]}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sub-Company Co-Branding</span>
                      <Switch
                        checked={settings.companyLogoBranding}
                        onChange={(checked) => setSettings({ ...settings, companyLogoBranding: checked })}
                        label="Display company subsidiary logo on invoice headers"
                      />
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
};
