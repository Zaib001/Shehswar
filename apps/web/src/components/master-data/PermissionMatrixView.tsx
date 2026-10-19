'use client';

import React, { useState } from 'react';
import { INITIAL_ROLES, ERP_MODULES, MODULE_ACTIONS } from './mock-data';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Select,
} from '../ui';
import { IconShield, IconCheck } from '../icons';
import { useToast } from '../../context/toast-context';

export const PermissionMatrixView: React.FC = () => {
  const { showToast } = useToast();
  const [selectedRole, setSelectedRole] = useState(INITIAL_ROLES[1]?.id || 'role-plant-mgr');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize permission matrix state: key = `${roleId}_${moduleId}_${action}`
  const [matrixState, setMatrixState] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    INITIAL_ROLES.forEach((role) => {
      ERP_MODULES.forEach((mod) => {
        (MODULE_ACTIONS as readonly string[]).forEach((action: string) => {
          const key = `${role.id}_${mod.id}_${action}`;
          // Super admin gets everything
          if (role.code === 'SUPER_ADMIN') {
            initial[key] = true;
          } else if (action === 'View') {
            initial[key] = true;
          } else if (role.code === 'PLANT_MGR') {
            initial[key] =
              mod.id === 'production' ||
              mod.id === 'inventory' ||
              (mod.id === 'procurement' && action !== 'Reject');
          } else if (role.code === 'QC_MGR') {
            initial[key] = mod.id === 'qc' || (mod.id === 'production' && (action === 'View' || action === 'Approve'));
          } else if (role.code === 'WH_MGR') {
            initial[key] = mod.id === 'inventory' || (mod.id === 'procurement' && action === 'View');
          } else if (role.code === 'FIN_MGR') {
            initial[key] = mod.id === 'finance' || action === 'Approve' || action === 'Export';
          } else {
            initial[key] = action === 'View';
          }
        });
      });
    });
    return initial;
  });

  const togglePermission = (moduleId: string, action: string) => {
    const key = `${selectedRole}_${moduleId}_${action}`;
    setMatrixState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleRowAll = (moduleId: string, grant: boolean) => {
    setMatrixState((prev) => {
      const next = { ...prev };
      MODULE_ACTIONS.forEach((action) => {
        next[`${selectedRole}_${moduleId}_${action}`] = grant;
      });
      return next;
    });
  };

  const toggleColAll = (action: string, grant: boolean) => {
    setMatrixState((prev) => {
      const next = { ...prev };
      ERP_MODULES.forEach((mod) => {
        next[`${selectedRole}_${mod.id}_${action}`] = grant;
      });
      return next;
    });
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showToast({
        title: 'Permissions Synchronized',
        message: 'Security matrix policy deployed to API gateway and cached authz tokens.',
        type: 'success',
      });
    }, 600);
  };

  const currentRole = INITIAL_ROLES.find((r) => r.id === selectedRole);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner & Control Bar */}
      <Card>
        <CardHeader style={{ paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconShield size={22} style={{ color: 'var(--color-primary)' }} />
                Enterprise RBAC Authorization Matrix
              </CardTitle>
              <CardDescription>
                Granular authority matrix mapping ERP business domains to CRUD and workflow actions.
              </CardDescription>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ width: '260px' }}>
                <Select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  options={INITIAL_ROLES.map((r) => ({ value: r.id, label: r.name }))}
                />
              </div>
              <Button
                variant="primary"
                icon={<IconCheck size={16} />}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Applying Policy...' : 'Save Matrix'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Configuring Role: <strong style={{ color: 'var(--text-primary)' }}>{currentRole?.name}</strong> ({currentRole?.code})
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  ERP_MODULES.forEach((m) => toggleRowAll(m.id, true));
                }}
              >
                Grant All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  ERP_MODULES.forEach((m) => toggleRowAll(m.id, false));
                }}
              >
                Revoke All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desktop Matrix Table (Visible on md and up) */}
      <div className="hidden-mobile">
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card-subtle)', borderBottom: '2px solid var(--border-subtle)' }}>
                  <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary)', width: '220px' }}>
                    Business Domain
                  </th>
                  {MODULE_ACTIONS.map((action) => (
                    <th
                      key={action}
                      style={{
                        padding: '0.75rem',
                        textAlign: 'center',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <div>{action}</div>
                      <button
                        type="button"
                        onClick={() => toggleColAll(action, true)}
                        style={{
                          fontSize: '0.65rem',
                          color: 'var(--color-primary)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.1rem 0.3rem',
                        }}
                      >
                        All
                      </button>
                    </th>
                  ))}
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem' }}>
                    Quick Row
                  </th>
                </tr>
              </thead>
              <tbody>
                {ERP_MODULES.map((mod, idx) => (
                  <tr
                    key={mod.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: idx % 2 === 0 ? 'transparent' : 'var(--bg-card-subtle)',
                    }}
                  >
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {mod.label}
                    </td>
                    {MODULE_ACTIONS.map((action) => {
                      const isChecked = !!matrixState[`${selectedRole}_${mod.id}_${action}`];
                      return (
                        <td key={action} style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(mod.id, action)}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                              accentColor: 'var(--color-primary)',
                            }}
                          />
                        </td>
                      );
                    })}
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => toggleRowAll(mod.id, true)}
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.2rem 0.4rem',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '3px',
                            cursor: 'pointer',
                          }}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleRowAll(mod.id, false)}
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.2rem 0.4rem',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '3px',
                            cursor: 'pointer',
                          }}
                        >
                          None
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile Card-Based Permission View */}
      <div className="visible-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {ERP_MODULES.map((mod) => (
          <Card key={mod.id}>
            <CardHeader style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <CardTitle style={{ fontSize: '1rem' }}>{mod.label}</CardTitle>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button size="sm" variant="ghost" onClick={() => toggleRowAll(mod.id, true)}>
                    All
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleRowAll(mod.id, false)}>
                    None
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent style={{ padding: '0 1rem 1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {MODULE_ACTIONS.map((action) => {
                  const isChecked = !!matrixState[`${selectedRole}_${mod.id}_${action}`];
                  return (
                    <label
                      key={action}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        background: 'var(--bg-card-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePermission(mod.id, action)}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      <span>{action}</span>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
