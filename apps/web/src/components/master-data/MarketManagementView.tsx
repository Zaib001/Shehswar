'use client';

/**
 * SHEHSWAR ONE360 - Market Management & 4-Tier Hierarchy UI
 *
 * Visual, Production-Grade Market Management:
 * Company -> Region (Business Manager) -> Zone (Area Manager) -> Territory (Sales Officer) -> Dealer
 *
 * Full CRUD & Assignment Binding for:
 * - Regions
 * - Zones
 * - Territories
 * - User Market Assignments (Multi-Assignment support)
 * - Visual Hierarchy Drill-down Tree
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  DataTable,
  Button,
  Input,
  Select,
  StatusBadge,
  KpiCard,
  Modal,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  EmptyState,
} from '../ui';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconLayers,
  IconUsers,
  IconBuilding,
  IconMapPin,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export const MarketManagementView: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'regions' | 'zones' | 'territories' | 'assignments'>('hierarchy');

  // Data states
  const [hierarchyData, setHierarchyData] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [territories, setTerritories] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Modals state
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isTerritoryModalOpen, setIsTerritoryModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);

  // Form states
  const [regionForm, setRegionForm] = useState({ id: '', code: '', name: '', managerId: '' });
  const [zoneForm, setZoneForm] = useState({ id: '', code: '', name: '', regionId: '', managerId: '' });
  const [territoryForm, setTerritoryForm] = useState({ id: '', code: '', name: '', zoneId: '', managerId: '' });
  const [assignmentForm, setAssignmentForm] = useState({
    userId: '',
    roleScope: 'TERRITORY',
    regionId: '',
    zoneId: '',
    territoryId: '',
    isPrimary: true,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
  });

  const loadAll = useCallback(async () => {
    try {
      const [hRes, rRes, zRes, tRes, aRes, uRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/market-hierarchy').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/regions').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/zones').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/territories').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/market-assignments').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/users').catch(() => ({ data: [] })),
      ]);

      const rawH = (hRes as any)?.data?.regions || (hRes as any)?.regions || (hRes as any)?.data || hRes;
      const rData = Array.isArray(rRes.data) ? rRes.data : rRes.data?.data || [];
      let hData = Array.isArray(rawH) ? rawH : Array.isArray(rawH?.regions) ? rawH.regions : [];
      if (hData.length === 0 && rData.length > 0) {
        hData = rData;
      }

      setHierarchyData(hData);
      setRegions(rData);
      setZones(Array.isArray(zRes.data) ? zRes.data : zRes.data?.data || []);
      setTerritories(Array.isArray(tRes.data) ? tRes.data : tRes.data?.data || []);
      setAssignments(Array.isArray(aRes.data) ? aRes.data : aRes.data?.data || []);
      setUsers(Array.isArray(uRes.data) ? uRes.data : uRes.data?.data || []);
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load market data', type: 'error' });
    }
  }, [showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Handlers for Region
  const handleSaveRegion = async () => {
    if (!regionForm.code || !regionForm.name) {
      showToast({ title: 'Validation Error', message: 'Code and Name are required', type: 'error' });
      return;
    }
    try {
      if (regionForm.id) {
        await ApiClient.put(`/api/v1/master-data/regions/${regionForm.id}`, regionForm);
        showToast({ title: 'Success', message: 'Region updated successfully', type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/regions', regionForm);
        showToast({ title: 'Success', message: 'Region created successfully', type: 'success' });
      }
      setIsRegionModalOpen(false);
      setRegionForm({ id: '', code: '', name: '', managerId: '' });
      loadAll();
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save region', type: 'error' });
    }
  };

  // Handlers for Zone
  const handleSaveZone = async () => {
    if (!zoneForm.code || !zoneForm.name || !zoneForm.regionId) {
      showToast({ title: 'Validation Error', message: 'Code, Name, and Region are required', type: 'error' });
      return;
    }
    try {
      if (zoneForm.id) {
        await ApiClient.put(`/api/v1/master-data/zones/${zoneForm.id}`, zoneForm);
        showToast({ title: 'Success', message: 'Zone updated successfully', type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/zones', zoneForm);
        showToast({ title: 'Success', message: 'Zone created successfully', type: 'success' });
      }
      setIsZoneModalOpen(false);
      setZoneForm({ id: '', code: '', name: '', regionId: '', managerId: '' });
      loadAll();
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save zone', type: 'error' });
    }
  };

  // Handlers for Territory
  const handleSaveTerritory = async () => {
    if (!territoryForm.code || !territoryForm.name || !territoryForm.zoneId) {
      showToast({ title: 'Validation Error', message: 'Code, Name, and Zone are required', type: 'error' });
      return;
    }
    try {
      if (territoryForm.id) {
        await ApiClient.put(`/api/v1/master-data/territories/${territoryForm.id}`, territoryForm);
        showToast({ title: 'Success', message: 'Territory updated successfully', type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/territories', territoryForm);
        showToast({ title: 'Success', message: 'Territory created successfully', type: 'success' });
      }
      setIsTerritoryModalOpen(false);
      setTerritoryForm({ id: '', code: '', name: '', zoneId: '', managerId: '' });
      loadAll();
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to save territory', type: 'error' });
    }
  };

  // Handlers for Assignment
  const handleSaveAssignment = async () => {
    if (!assignmentForm.userId) {
      showToast({ title: 'Validation Error', message: 'Please select a User', type: 'error' });
      return;
    }
    try {
      await ApiClient.post('/api/v1/master-data/market-assignments', {
        userId: assignmentForm.userId,
        roleScope: assignmentForm.roleScope,
        regionId: assignmentForm.regionId || null,
        zoneId: assignmentForm.zoneId || null,
        territoryId: assignmentForm.territoryId || null,
        isPrimary: assignmentForm.isPrimary,
        effectiveFrom: assignmentForm.effectiveFrom ? new Date(assignmentForm.effectiveFrom) : new Date(),
        effectiveTo: assignmentForm.effectiveTo ? new Date(assignmentForm.effectiveTo) : null,
      });
      showToast({ title: 'Success', message: 'Market Assignment created successfully', type: 'success' });
      setIsAssignmentModalOpen(false);
      setAssignmentForm({
        userId: '',
        roleScope: 'TERRITORY',
        regionId: '',
        zoneId: '',
        territoryId: '',
        isPrimary: true,
        effectiveFrom: new Date().toISOString().split('T')[0],
        effectiveTo: '',
      });
      loadAll();
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to create assignment', type: 'error' });
    }
  };

  const handleDeactivateAssignment = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this market assignment?')) return;
    try {
      await ApiClient.delete(`/api/v1/master-data/market-assignments/${id}`);
      showToast({ title: 'Revoked', message: 'Market assignment deactivated', type: 'success' });
      loadAll();
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to revoke assignment', type: 'error' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Market Management & 4-Tier Structure
            </h1>
            <span
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '12px',
              }}
            >
              PRODUCTION CORE
            </span>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
            Company → Region (Business Manager) → Zone (Area Manager) → Territory (Sales Officer) → Dealer Structure
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="outline" icon={<IconRefresh size={16} />} onClick={loadAll}>
            Refresh
          </Button>
          {activeTab === 'regions' && (
            <Button
              variant="primary"
              icon={<IconPlus size={16} />}
              onClick={() => {
                setRegionForm({ id: '', code: '', name: '', managerId: '' });
                setIsRegionModalOpen(true);
              }}
            >
              Add Region
            </Button>
          )}
          {activeTab === 'zones' && (
            <Button
              variant="primary"
              icon={<IconPlus size={16} />}
              onClick={() => {
                setZoneForm({ id: '', code: '', name: '', regionId: regions[0]?.id || '', managerId: '' });
                setIsZoneModalOpen(true);
              }}
            >
              Add Zone
            </Button>
          )}
          {activeTab === 'territories' && (
            <Button
              variant="primary"
              icon={<IconPlus size={16} />}
              onClick={() => {
                setTerritoryForm({ id: '', code: '', name: '', zoneId: zones[0]?.id || '', managerId: '' });
                setIsTerritoryModalOpen(true);
              }}
            >
              Add Territory
            </Button>
          )}
          {activeTab === 'assignments' && (
            <Button
              variant="primary"
              icon={<IconPlus size={16} />}
              onClick={() => {
                setAssignmentForm({
                  userId: users[0]?.id || '',
                  roleScope: 'TERRITORY',
                  regionId: regions[0]?.id || '',
                  zoneId: zones[0]?.id || '',
                  territoryId: territories[0]?.id || '',
                  isPrimary: true,
                  effectiveFrom: new Date().toISOString().split('T')[0],
                  effectiveTo: '',
                });
                setIsAssignmentModalOpen(true);
              }}
            >
              Bind Market Assignment
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <KpiCard
          title="Active Regions"
          value={regions.length}
          subtitle="Operating geographic sales regions"
          icon={<IconBuilding size={20} />}
          badge="Tier 1"
          accentColor="#3b82f6"
        />
        <KpiCard
          title="Active Zones"
          value={zones.length}
          subtitle="Supervised by Area Managers"
          icon={<IconLayers size={20} />}
          badge="Tier 2"
          accentColor="#10b981"
        />
        <KpiCard
          title="Active Territories"
          value={territories.length}
          subtitle="Direct sales officer coverage"
          icon={<IconMapPin size={20} />}
          badge="Tier 3"
          accentColor="#f59e0b"
        />
        <KpiCard
          title="Market Assignments"
          value={assignments.filter((a) => a.status === 'ACTIVE').length}
          subtitle="Multi-territory employee bindings"
          icon={<IconUsers size={20} />}
          badge="Bindings"
          accentColor="#8b5cf6"
        />
      </div>

      {/* Module Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid var(--border-subtle)',
          paddingBottom: '8px',
          overflowX: 'auto',
        }}
      >
        <Button
          variant={activeTab === 'hierarchy' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('hierarchy')}
        >
          Visual Hierarchy Tree
        </Button>
        <Button
          variant={activeTab === 'regions' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('regions')}
        >
          Regions ({regions.length})
        </Button>
        <Button
          variant={activeTab === 'zones' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('zones')}
        >
          Zones ({zones.length})
        </Button>
        <Button
          variant={activeTab === 'territories' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('territories')}
        >
          Territories ({territories.length})
        </Button>
        <Button
          variant={activeTab === 'assignments' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('assignments')}
        >
          User Market Assignments ({assignments.length})
        </Button>
      </div>

      {/* Tab 1: Visual Hierarchy Tree */}
      {activeTab === 'hierarchy' && (
        <Card>
          <CardHeader>
            <CardTitle>Enterprise Market Organizational Tree</CardTitle>
          </CardHeader>
          <CardContent>
            {hierarchyData.length === 0 ? (
              <EmptyState title="No Hierarchy Records Found" description="Create regions, zones, and territories to visualize the organizational tree." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {hierarchyData.map((reg: any) => (
                  <div
                    key={reg.id}
                    style={{
                      border: '1px solid #bfdbfe',
                      borderRadius: '12px',
                      backgroundColor: '#f8fafc',
                      padding: '16px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            background: '#1d4ed8',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          REGION
                        </span>
                        <strong style={{ fontSize: '16px', color: '#0f172a' }}>{reg.name} ({reg.code})</strong>
                        <span style={{ fontSize: '13px', color: '#475569' }}>
                          Business Manager:{' '}
                          <strong style={{ color: '#1e40af' }}>
                            {reg.businessManager?.name ||
                              (reg.businessManager
                                ? `${reg.businessManager.firstName || ''} ${reg.businessManager.lastName || ''}`.trim()
                                : 'Unassigned')}
                          </strong>
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{reg.zones?.length || 0} Zones</span>
                    </div>

                    {/* Zones inside Region */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', paddingLeft: '16px', borderLeft: '3px solid #3b82f6' }}>
                      {reg.zones?.map((zone: any) => (
                        <div
                          key={zone.id}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div>
                              <span
                                style={{
                                  background: '#059669',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  marginRight: '6px',
                                }}
                              >
                                ZONE
                              </span>
                              <strong style={{ fontSize: '14px' }}>{zone.name}</strong>
                            </div>
                            <span style={{ fontSize: '12px', color: '#047857' }}>
                              AM:{' '}
                              {zone.areaManager?.name ||
                                (zone.areaManager
                                  ? `${zone.areaManager.firstName || ''} ${zone.areaManager.lastName || ''}`.trim()
                                  : 'Unassigned')}
                            </span>
                          </div>

                          {/* Territories inside Zone */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                            {zone.territories?.map((terr: any) => {
                              const soDisplay =
                                terr.primarySalesOfficer?.name ||
                                (terr.salesOfficer
                                  ? `${terr.salesOfficer.firstName || ''} ${terr.salesOfficer.lastName || ''}`.trim()
                                  : null) ||
                                (terr.assignedOfficers && terr.assignedOfficers.length > 0
                                  ? terr.assignedOfficers.map((o: any) => o.name || `${o.firstName || ''} ${o.lastName || ''}`.trim()).join(', ')
                                  : null) ||
                                (terr.officers && terr.officers.length > 0 ? terr.officers.join(', ') : null) ||
                                'Direct ERP';

                              const dealersCount = terr.dealersCount ?? terr.dealers?.length ?? 0;

                              return (
                                <div
                                  key={terr.id}
                                  style={{
                                    backgroundColor: '#f1f5f9',
                                    borderRadius: '6px',
                                    padding: '8px 10px',
                                    fontSize: '12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <div>
                                    <strong style={{ color: '#334155' }}>{terr.name}</strong> ({terr.code})
                                    <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                                      Assigned SO: <strong style={{ color: '#2563eb' }}>{soDisplay}</strong>
                                    </div>
                                  </div>
                                  <span
                                    style={{
                                      backgroundColor: '#e2e8f0',
                                      color: '#334155',
                                      fontWeight: 600,
                                      padding: '2px 6px',
                                      borderRadius: '10px',
                                      fontSize: '11px',
                                    }}
                                  >
                                    {dealersCount} Dealers
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Regions List */}
      {activeTab === 'regions' && (
        <Card>
          <CardHeader>
            <CardTitle>Sales Regions</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={regions}
              columns={[
                { key: 'code', header: 'Region Code', render: (r: any) => <strong style={{ color: '#2563eb' }}>{r.code}</strong> },
                { key: 'name', header: 'Region Name', render: (r: any) => <strong>{r.name}</strong> },
                {
                  key: 'manager',
                  header: 'Business Manager (BM)',
                  render: (r: any) =>
                    r.businessManager ? `${r.businessManager.firstName} ${r.businessManager.lastName}` : <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>,
                },
                { key: 'zones', header: 'Zones Count', render: (r: any) => r._count?.zones || r.zones?.length || 0 },
                { key: 'status', header: 'Status', render: (r: any) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (r: any) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<IconEdit size={14} />}
                      onClick={() => {
                        setRegionForm({ id: r.id, code: r.code, name: r.name, managerId: r.managerId || '' });
                        setIsRegionModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Zones List */}
      {activeTab === 'zones' && (
        <Card>
          <CardHeader>
            <CardTitle>Sales Zones</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={zones}
              columns={[
                { key: 'code', header: 'Zone Code', render: (z: any) => <strong style={{ color: '#059669' }}>{z.code}</strong> },
                { key: 'name', header: 'Zone Name', render: (z: any) => <strong>{z.name}</strong> },
                { key: 'region', header: 'Parent Region', render: (z: any) => z.region?.name || '—' },
                {
                  key: 'manager',
                  header: 'Area Manager (AM)',
                  render: (z: any) =>
                    z.areaManager ? `${z.areaManager.firstName} ${z.areaManager.lastName}` : <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>,
                },
                { key: 'territories', header: 'Territories Count', render: (z: any) => z._count?.territories || z.territories?.length || 0 },
                { key: 'status', header: 'Status', render: (z: any) => <StatusBadge status={z.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (z: any) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<IconEdit size={14} />}
                      onClick={() => {
                        setZoneForm({ id: z.id, code: z.code, name: z.name, regionId: z.regionId, managerId: z.managerId || '' });
                        setIsZoneModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Territories List */}
      {activeTab === 'territories' && (
        <Card>
          <CardHeader>
            <CardTitle>Sales Territories</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={territories}
              columns={[
                { key: 'code', header: 'Territory Code', render: (t: any) => <strong style={{ color: '#d97706' }}>{t.code}</strong> },
                { key: 'name', header: 'Territory Name', render: (t: any) => <strong>{t.name}</strong> },
                { key: 'zone', header: 'Parent Zone', render: (t: any) => t.zone?.name || '—' },
                { key: 'region', header: 'Region', render: (t: any) => t.zone?.region?.name || '—' },
                {
                  key: 'officer',
                  header: 'Primary Sales Officer (SO)',
                  render: (t: any) =>
                    t.salesOfficer ? `${t.salesOfficer.firstName} ${t.salesOfficer.lastName}` : <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>,
                },
                { key: 'dealers', header: 'Dealers Count', render: (t: any) => t._count?.dealers || t.dealers?.length || 0 },
                { key: 'status', header: 'Status', render: (t: any) => <StatusBadge status={t.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (t: any) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<IconEdit size={14} />}
                      onClick={() => {
                        setTerritoryForm({ id: t.id, code: t.code, name: t.name, zoneId: t.zoneId, managerId: t.managerId || '' });
                        setIsTerritoryModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Market Assignments List */}
      {activeTab === 'assignments' && (
        <Card>
          <CardHeader>
            <CardTitle>User & Employee Multi-Market Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={assignments}
              columns={[
                {
                  key: 'user',
                  header: 'Assigned User / Employee',
                  render: (a: any) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{a.user ? `${a.user.firstName} ${a.user.lastName}` : 'System User'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{a.user?.email}</div>
                    </div>
                  ),
                },
                {
                  key: 'scope',
                  header: 'Role Scope',
                  render: (a: any) => (
                    <span
                      style={{
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '11px',
                      }}
                    >
                      {a.roleScope}
                    </span>
                  ),
                },
                { key: 'region', header: 'Region', render: (a: any) => a.region?.name || '—' },
                { key: 'zone', header: 'Zone', render: (a: any) => a.zone?.name || '—' },
                { key: 'territory', header: 'Territory', render: (a: any) => a.territory?.name || '—' },
                {
                  key: 'isPrimary',
                  header: 'Priority',
                  render: (a: any) => (
                    <span style={{ fontWeight: 600, color: a.isPrimary ? '#059669' : '#64748b' }}>
                      {a.isPrimary ? 'PRIMARY' : 'SECONDARY'}
                    </span>
                  ),
                },
                {
                  key: 'dates',
                  header: 'Effective Period',
                  render: (a: any) => (
                    <div style={{ fontSize: '12px' }}>
                      {new Date(a.effectiveFrom).toLocaleDateString()} {a.effectiveTo ? `→ ${new Date(a.effectiveTo).toLocaleDateString()}` : '→ Active'}
                    </div>
                  ),
                },
                { key: 'status', header: 'Status', render: (a: any) => <StatusBadge status={a.status} /> },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (a: any) => (
                    a.status === 'ACTIVE' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ color: '#ef4444' }}
                        icon={<IconTrash size={14} />}
                        onClick={() => handleDeactivateAssignment(a.id)}
                      >
                        Revoke
                      </Button>
                    )
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {/* Region Modal */}
      <Modal
        isOpen={isRegionModalOpen}
        onClose={() => setIsRegionModalOpen(false)}
        title={regionForm.id ? 'Edit Sales Region' : 'Add New Sales Region'}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setIsRegionModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveRegion}>Save Region</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input
            label="Region Code *"
            value={regionForm.code}
            onChange={(e) => setRegionForm({ ...regionForm, code: e.target.value })}
            placeholder="e.g. REG-WEST"
          />
          <Input
            label="Region Name *"
            value={regionForm.name}
            onChange={(e) => setRegionForm({ ...regionForm, name: e.target.value })}
            placeholder="e.g. West Region"
          />
          <Select
            label="Business Manager (BM)"
            value={regionForm.managerId}
            onChange={(e) => setRegionForm({ ...regionForm, managerId: e.target.value })}
            options={[
              { label: 'Select Business Manager...', value: '' },
              ...users.map((u) => ({ label: `${u.firstName} ${u.lastName} (${u.email})`, value: u.id })),
            ]}
          />
        </div>
      </Modal>

      {/* Zone Modal */}
      <Modal
        isOpen={isZoneModalOpen}
        onClose={() => setIsZoneModalOpen(false)}
        title={zoneForm.id ? 'Edit Sales Zone' : 'Add New Sales Zone'}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setIsZoneModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveZone}>Save Zone</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Select
            label="Parent Region *"
            value={zoneForm.regionId}
            onChange={(e) => setZoneForm({ ...zoneForm, regionId: e.target.value })}
            options={[
              { label: 'Select Region...', value: '' },
              ...regions.map((r) => ({ label: `${r.code} - ${r.name}`, value: r.id })),
            ]}
          />
          <Input
            label="Zone Code *"
            value={zoneForm.code}
            onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })}
            placeholder="e.g. ZONE-FSD"
          />
          <Input
            label="Zone Name *"
            value={zoneForm.name}
            onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
            placeholder="e.g. Faisalabad Zone"
          />
          <Select
            label="Area Manager (AM)"
            value={zoneForm.managerId}
            onChange={(e) => setZoneForm({ ...zoneForm, managerId: e.target.value })}
            options={[
              { label: 'Select Area Manager...', value: '' },
              ...users.map((u) => ({ label: `${u.firstName} ${u.lastName} (${u.email})`, value: u.id })),
            ]}
          />
        </div>
      </Modal>

      {/* Territory Modal */}
      <Modal
        isOpen={isTerritoryModalOpen}
        onClose={() => setIsTerritoryModalOpen(false)}
        title={territoryForm.id ? 'Edit Sales Territory' : 'Add New Sales Territory'}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setIsTerritoryModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveTerritory}>Save Territory</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Select
            label="Parent Zone *"
            value={territoryForm.zoneId}
            onChange={(e) => setTerritoryForm({ ...territoryForm, zoneId: e.target.value })}
            options={[
              { label: 'Select Zone...', value: '' },
              ...zones.map((z) => ({ label: `${z.code} - ${z.name} (${z.region?.name || ''})`, value: z.id })),
            ]}
          />
          <Input
            label="Territory Code *"
            value={territoryForm.code}
            onChange={(e) => setTerritoryForm({ ...territoryForm, code: e.target.value })}
            placeholder="e.g. TERR-FSD-01"
          />
          <Input
            label="Territory Name *"
            value={territoryForm.name}
            onChange={(e) => setTerritoryForm({ ...territoryForm, name: e.target.value })}
            placeholder="e.g. Faisalabad-01"
          />
          <Select
            label="Primary Sales Officer (SO)"
            value={territoryForm.managerId}
            onChange={(e) => setTerritoryForm({ ...territoryForm, managerId: e.target.value })}
            options={[
              { label: 'Select Sales Officer...', value: '' },
              ...users.map((u) => ({ label: `${u.firstName} ${u.lastName} (${u.email})`, value: u.id })),
            ]}
          />
        </div>
      </Modal>

      {/* Bind Market Assignment Modal */}
      <Modal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        title="Bind User Market Assignment"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setIsAssignmentModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveAssignment}>Confirm Assignment</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Select
            label="Select User Account *"
            value={assignmentForm.userId}
            onChange={(e) => setAssignmentForm({ ...assignmentForm, userId: e.target.value })}
            options={[
              { label: 'Select User...', value: '' },
              ...users.map((u) => ({ label: `${u.firstName} ${u.lastName} (${u.email})`, value: u.id })),
            ]}
          />
          <Select
            label="Operational Role Scope *"
            value={assignmentForm.roleScope}
            onChange={(e) => setAssignmentForm({ ...assignmentForm, roleScope: e.target.value })}
            options={[
              { label: 'Sales Officer (Territory Level)', value: 'TERRITORY' },
              { label: 'Area Manager (Zone Level)', value: 'ZONE' },
              { label: 'Business Manager (Region Level)', value: 'REGION' },
            ]}
          />

          <Select
            label="Region *"
            value={assignmentForm.regionId}
            onChange={(e) => setAssignmentForm({ ...assignmentForm, regionId: e.target.value })}
            options={[
              { label: 'Select Region...', value: '' },
              ...regions.map((r) => ({ label: `${r.code} - ${r.name}`, value: r.id })),
            ]}
          />

          {assignmentForm.roleScope !== 'REGION' && (
            <Select
              label="Zone *"
              value={assignmentForm.zoneId}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, zoneId: e.target.value })}
              options={[
                { label: 'Select Zone...', value: '' },
                ...zones
                  .filter((z) => !assignmentForm.regionId || z.regionId === assignmentForm.regionId)
                  .map((z) => ({ label: `${z.code} - ${z.name}`, value: z.id })),
              ]}
            />
          )}

          {assignmentForm.roleScope === 'TERRITORY' && (
            <Select
              label="Territory *"
              value={assignmentForm.territoryId}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, territoryId: e.target.value })}
              options={[
                { label: 'Select Territory...', value: '' },
                ...territories
                  .filter((t) => !assignmentForm.zoneId || t.zoneId === assignmentForm.zoneId)
                  .map((t) => ({ label: `${t.code} - ${t.name}`, value: t.id })),
              ]}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Effective From *"
              type="date"
              value={assignmentForm.effectiveFrom}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, effectiveFrom: e.target.value })}
            />
            <Input
              label="Effective To (Optional)"
              type="date"
              value={assignmentForm.effectiveTo}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, effectiveTo: e.target.value })}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '4px' }}>
            <input
              type="checkbox"
              checked={assignmentForm.isPrimary}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, isPrimary: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
            />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Mark as Primary Assignment for User</span>
          </label>
        </div>
      </Modal>
    </div>
  );
};
