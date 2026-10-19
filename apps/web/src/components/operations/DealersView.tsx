'use client';

/**
 * SHEHSWAR ONE360 - Dealers Management, 4-Tier Market Binding & Ledger UI
 *
 * Canonical Market Architecture:
 * - Dealer belongs to: Company -> Region -> Zone -> Territory
 * - Responsible Sales Officer / FO assignment
 * - Database-backed Assignment History preserves past ownership
 * - Real-time running ledger statements
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ListPageTemplate } from '../templates';
import {
  DataTable,
  ColumnDef,
  Button,
  Input,
  Select,
  Textarea,
  StatusBadge,
  KpiCard,
  Modal,
  TableSkeleton,
  EmptyState,
} from '../ui';
import {
  IconPlus,
  IconFileText,
  IconRefresh,
  IconEdit,
  IconClock,
} from '../icons';
import { DealerLedgerModal } from './DealerLedgerModal';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';
import { exportDealerLedgerToPdf, exportDealersListPdf } from '../../lib/pdf-export';

export interface DealerRecord {
  id: string;
  code: string;
  name: string;
  businessName?: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  creditLimit: number;
  currentBalance: number;
  status: string;
  territoryId?: string;
  territory?: any;
  assignedFieldOfficerId?: string;
  assignedOfficer?: any;
  officerAssignments?: any[];
}

export const DealersView: React.FC = () => {
  const { showToast } = useToast();
  const [dealers, setDealers] = useState<DealerRecord[]>([]);
  const [salesOfficers, setSalesOfficers] = useState<any[]>([]);
  const [territories, setTerritories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Ledger Modal State
  const [selectedDealerForLedger, setSelectedDealerForLedger] = useState<DealerRecord | null>(null);

  // Assignment History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedDealerForHistory, setSelectedDealerForHistory] = useState<DealerRecord | null>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Reassign Modal State
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [dealerToReassign, setDealerToReassign] = useState<DealerRecord | null>(null);
  const [reassignForm, setReassignForm] = useState({
    territoryId: '',
    salesOfficerId: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
  });

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    businessName: '',
    contactPerson: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    creditLimit: 0,
    territoryId: '',
    salesOfficerId: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [dealerRes, userRes, terrRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/dealers').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/users').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/territories').catch(() => ({ data: [] })),
      ]);

      setDealers(Array.isArray(dealerRes.data) ? dealerRes.data : dealerRes.data?.data || []);
      setSalesOfficers(Array.isArray(userRes.data) ? userRes.data : userRes.data?.data || []);
      setTerritories(Array.isArray(terrRes.data) ? terrRes.data : terrRes.data?.data || []);
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load dealers', type: 'error' });
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenLedger = (dealer: DealerRecord) => {
    setSelectedDealerForLedger(dealer);
  };

  const handleDirectPdf = async (e: React.MouseEvent, dealer: DealerRecord) => {
    e.stopPropagation();
    try {
      const res = await ApiClient.get<any>(`/api/v1/dealers/${dealer.id}/ledger?limit=200`);
      const data = res.data?.data || res.data || {};
      const entries = Array.isArray(data.entries) ? data.entries : [];
      exportDealerLedgerToPdf({
        dealer: {
          name: dealer.name,
          code: dealer.code,
          phone: dealer.phone,
          city: dealer.city,
          address: dealer.address,
          creditLimit: dealer.creditLimit,
          currentBalance: Number(data.currentBalance ?? dealer.currentBalance ?? 0),
        },
        entries,
      });
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to generate PDF statement', type: 'error' });
    }
  };

  const handleOpenHistory = async (dealer: DealerRecord) => {
    setSelectedDealerForHistory(dealer);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await ApiClient.get<any>(`/api/v1/dealers/${dealer.id}/history`);
      setHistoryRecords(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load assignment history', type: 'error' });
      setHistoryRecords([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenReassign = (dealer: DealerRecord) => {
    setDealerToReassign(dealer);
    setReassignForm({
      territoryId: dealer.territoryId || '',
      salesOfficerId: dealer.assignedFieldOfficerId || '',
      effectiveFrom: new Date().toISOString().split('T')[0],
    });
    setIsReassignModalOpen(true);
  };

  const handleSaveReassignment = async () => {
    if (!dealerToReassign) return;
    try {
      if (reassignForm.salesOfficerId) {
        await ApiClient.post(`/api/v1/dealers/${dealerToReassign.id}/assign-officers`, {
          userIds: [reassignForm.salesOfficerId],
          territoryId: reassignForm.territoryId || undefined,
        });
      }
      showToast({ title: 'Reassigned', message: 'Dealer market assignment updated successfully', type: 'success' });
      setIsReassignModalOpen(false);
      setDealerToReassign(null);
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to reassign dealer', type: 'error' });
    }
  };

  const handleCreateDealer = async () => {
    if (!formData.code || !formData.name || !formData.phone) {
      showToast({ title: 'Validation Error', message: 'Code, Name, and Phone are required', type: 'error' });
      return;
    }

    try {
      const res = await ApiClient.post<any>('/api/v1/dealers', {
        ...formData,
        territoryId: formData.territoryId || undefined,
      });
      const createdDealer = res.data?.data || res.data;
      if (formData.salesOfficerId && createdDealer?.id) {
        await ApiClient.post(`/api/v1/dealers/${createdDealer.id}/assign-officers`, {
          userIds: [formData.salesOfficerId],
          territoryId: formData.territoryId || undefined,
        }).catch(() => null);
      }
      showToast({ title: 'Success', message: 'Dealer registered successfully', type: 'success' });
      setIsCreateModalOpen(false);
      setFormData({
        code: '',
        name: '',
        businessName: '',
        contactPerson: '',
        phone: '',
        email: '',
        city: '',
        address: '',
        creditLimit: 0,
        territoryId: '',
        salesOfficerId: '',
        notes: '',
      });
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Failed to create dealer', type: 'error' });
    }
  };

  const filteredDealers = dealers.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.phone && d.phone.includes(searchQuery)) ||
      (d.city && d.city.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPIs
  const totalDealers = dealers.length;
  const activeDealers = dealers.filter((d) => d.status === 'ACTIVE').length;
  const totalReceivables = dealers.reduce((sum, d) => sum + Number(d.currentBalance || 0), 0);
  const totalCreditLimit = dealers.reduce((sum, d) => sum + Number(d.creditLimit || 0), 0);

  const columns: ColumnDef<DealerRecord>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (d) => <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{d.code}</span>,
    },
    {
      key: 'name',
      header: 'Dealer Name & Shop',
      render: (d) => (
        <div>
          <div style={{ fontWeight: 600 }}>{d.name}</div>
          {d.businessName && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{d.businessName}</div>}
        </div>
      ),
    },
    {
      key: 'market',
      header: 'Market Hierarchy',
      render: (d) => {
        const terr = d.territory;
        return (
          <div style={{ fontSize: '12px' }}>
            <div style={{ fontWeight: 600, color: '#1e293b' }}>{terr?.name || 'Unassigned Territory'}</div>
            <div style={{ color: '#64748b', fontSize: '11px' }}>
              {terr?.zone?.name ? `${terr.zone.name} → ${terr.zone.region?.name || ''}` : 'Direct ERP Scope'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'officer',
      header: 'Responsible Sales Officer',
      render: (d) => {
        const officer = d.assignedOfficer;
        return (
          <div style={{ fontSize: '12px' }}>
            <strong style={{ color: '#2563eb' }}>
              {officer ? `${officer.firstName} ${officer.lastName}` : 'Direct / Unassigned'}
            </strong>
          </div>
        );
      },
    },
    {
      key: 'creditLimit',
      header: 'Credit Limit',
      render: (d) => `PKR ${Number(d.creditLimit || 0).toLocaleString()}`,
    },
    {
      key: 'currentBalance',
      header: 'Current Balance (Ledger)',
      render: (d) => {
        const bal = Number(d.currentBalance || 0);
        const isOverLimit = d.creditLimit > 0 && bal > d.creditLimit;
        return (
          <div>
            <span
              style={{
                fontWeight: 700,
                color: isOverLimit ? 'var(--color-danger)' : bal > 0 ? 'var(--text-primary)' : 'var(--color-success)',
              }}
            >
              PKR {bal.toLocaleString()}
            </span>
            {isOverLimit && (
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-danger)' }}>
                Over Credit Limit!
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (d) => (
        <StatusBadge status={d.status} variant={d.status === 'ACTIVE' ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '340px',
      render: (d) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenLedger(d);
            }}
          >
            <IconFileText size={14} /> Ledger
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDirectPdf(e, d);
            }}
          >
            🖨️ PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenHistory(d);
            }}
          >
            <IconClock size={14} /> History
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenReassign(d);
            }}
          >
            <IconEdit size={14} /> Reassign
          </Button>
        </div>
      ),
    },
  ];

  return (
    <ListPageTemplate
      title="Dealers, Market Hierarchy & Running Ledger"
      subtitle="Authoritative dealer customer database, 4-tier market binding, ownership history, and financial statements."
      actions={
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            onClick={() => exportDealersListPdf({ dealers: filteredDealers })}
          >
            🖨️ Export Directory PDF
          </Button>
          <Button variant="outline" icon={<IconRefresh size={16} />} onClick={loadData}>
            Refresh
          </Button>
          <Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setIsCreateModalOpen(true)}>
            Register New Dealer
          </Button>
        </div>
      }
    >
      {/* Dealer KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <KpiCard
          title="Total Registered Dealers"
          value={totalDealers}
          subtitle={`${activeDealers} active trading dealers`}
          badge="Network"
          accentColor="#3b82f6"
        />
        <KpiCard
          title="Total Receivables (Running Balances)"
          value={`PKR ${Math.round(totalReceivables / 1000).toLocaleString()}k`}
          subtitle="Real-time debit from Sales Invoices"
          badge="Live Ledger"
          accentColor="#059669"
        />
        <KpiCard
          title="Allocated Credit Limits"
          value={`PKR ${Math.round(totalCreditLimit / 1000).toLocaleString()}k`}
          subtitle="Max exposure threshold"
          badge="Credit Risk"
          accentColor="#d97706"
        />
        <KpiCard
          title="Active Field Officers"
          value={salesOfficers.length}
          subtitle="Managing market coverage"
          badge="Coverage"
          accentColor="#8b5cf6"
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <Input
          placeholder="Search by code, dealer name, phone, city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '320px' }}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { label: 'All Statuses', value: 'ALL' },
            { label: 'Active Only', value: 'ACTIVE' },
            { label: 'Inactive Only', value: 'INACTIVE' },
          ]}
        />
      </div>

      <DataTable data={filteredDealers} columns={columns} />

      {/* Register Dealer Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New Enterprise Dealer"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateDealer}>
              Register Dealer
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input
            label="Dealer Code *"
            placeholder="e.g. DLR-FSD-001"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          />
          <Input
            label="Dealer / Owner Name *"
            placeholder="e.g. Haji Muhammad Aslam"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <Input
            label="Business / Shop Name"
            placeholder="e.g. Aslam Traders"
            value={formData.businessName}
            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
          />
          <Input
            label="Phone Number *"
            placeholder="e.g. 0300-1234567"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Email"
            placeholder="dealer@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="City"
            placeholder="e.g. Faisalabad"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          />

          <Select
            label="Sales Territory (4-Tier Market) *"
            value={formData.territoryId}
            onChange={(e) => setFormData({ ...formData, territoryId: e.target.value })}
            options={[
              { label: 'Select Territory...', value: '' },
              ...territories.map((t) => ({
                label: `${t.code} - ${t.name} (${t.zone?.name || ''} → ${t.zone?.region?.name || ''})`,
                value: t.id,
              })),
            ]}
          />

          <Select
            label="Responsible Sales Officer / FO *"
            value={formData.salesOfficerId}
            onChange={(e) => setFormData({ ...formData, salesOfficerId: e.target.value })}
            options={[
              { label: 'Unassigned', value: '' },
              ...salesOfficers.map((u) => ({
                label: `${u.firstName} ${u.lastName} (${u.email})`,
                value: u.id,
              })),
            ]}
          />

          <Input
            label="Credit Limit (PKR)"
            type="number"
            min="0"
            value={formData.creditLimit}
            onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
          />

          <div style={{ gridColumn: 'span 2' }}>
            <Textarea
              label="Shop / Warehouse Address"
              placeholder="Physical street address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Assignment History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Assignment History — ${selectedDealerForHistory?.name} (${selectedDealerForHistory?.code})`}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              🖨️ Print History
            </Button>
            <Button variant="ghost" onClick={() => setIsHistoryModalOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Authoritative historical record of territory and sales officer assignments for sales attribution traceability.
          </p>

          {loadingHistory ? (
            <TableSkeleton rows={4} columns={4} />
          ) : historyRecords.length === 0 ? (
            <EmptyState title="No Past Reassignments" description="This dealer retains its initial original market assignment." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {historyRecords.map((h, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#1e40af' }}>
                      {h.salesOfficer ? `${h.salesOfficer.firstName} ${h.salesOfficer.lastName}` : 'Unassigned Officer'}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {new Date(h.effectiveFrom).toLocaleDateString()} {h.effectiveTo ? `→ ${new Date(h.effectiveTo).toLocaleDateString()}` : '→ Present'}
                    </span>
                  </div>
                  <div style={{ color: '#475569', marginTop: '4px', fontSize: '12px' }}>
                    Territory: <strong>{h.territory?.name || 'Unassigned'}</strong>
                    {h.territory?.zone?.name && <span> ({h.territory.zone.name} → {h.territory.zone.region?.name})</span>}
                  </div>
                  {h.assignedBy && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      Assigned by: {h.assignedBy.firstName} {h.assignedBy.lastName}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Reassign Modal */}
      <Modal
        isOpen={isReassignModalOpen}
        onClose={() => setIsReassignModalOpen(false)}
        title={`Reassign Dealer — ${dealerToReassign?.name}`}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setIsReassignModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveReassignment}>Confirm Reassignment</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Reassigning this dealer will update active ownership from the effective date forward.
            Historical posted invoices will remain permanently attributed to past officers.
          </p>

          <Select
            label="New Territory (Optional)"
            value={reassignForm.territoryId}
            onChange={(e) => setReassignForm({ ...reassignForm, territoryId: e.target.value })}
            options={[
              { label: 'Keep Current Territory', value: '' },
              ...territories.map((t) => ({ label: `${t.code} - ${t.name}`, value: t.id })),
            ]}
          />

          <Select
            label="New Responsible Sales Officer *"
            value={reassignForm.salesOfficerId}
            onChange={(e) => setReassignForm({ ...reassignForm, salesOfficerId: e.target.value })}
            options={[
              { label: 'Select Officer...', value: '' },
              ...salesOfficers.map((u) => ({ label: `${u.firstName} ${u.lastName} (${u.email})`, value: u.id })),
            ]}
          />

          <Input
            label="Effective From Date *"
            type="date"
            value={reassignForm.effectiveFrom}
            onChange={(e) => setReassignForm({ ...reassignForm, effectiveFrom: e.target.value })}
          />
        </div>
      </Modal>

      {/* Professional Dealer Ledger Statement Modal */}
      <DealerLedgerModal
        isOpen={!!selectedDealerForLedger}
        onClose={() => {
          setSelectedDealerForLedger(null);
          loadData();
        }}
        dealer={selectedDealerForLedger}
      />
    </ListPageTemplate>
  );
};
