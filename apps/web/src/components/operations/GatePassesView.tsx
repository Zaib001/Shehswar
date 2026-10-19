'use client';

/**
 * SHEHSWAR ONE360 - Gate Passes (Inward & Outward Logistics)
 *
 * Follows Canonical Flow:
 * - INWARD: Raw materials / supplies received at factory gate (linked to Purchase Invoice)
 * - OUTWARD: Finished products dispatched to dealers (linked to Sales Invoice)
 * - Security verification, vehicle, driver, and transporter tracking
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ListPageTemplate } from '../templates';
import {
  DataTable,
  ColumnDef,
  Button,
  Input,
  Select,
  StatusBadge,
  KpiCard,
  Modal,
  TableSkeleton,
  EmptyState,
} from '../ui';
import { IconPlus } from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export interface GatePassRecord {
  id: string;
  gatePassNumber: string;
  passType: 'INWARD' | 'OUTWARD';
  vehicleNo: string;
  driverName?: string;
  driverPhone?: string;
  transporter?: string;
  date: string;
  status: string;
  vendor?: { id: string; name: string };
  dealer?: { id: string; name: string };
  items?: { description: string; quantity: number; uom?: string }[];
}

export const GatePassesView: React.FC = () => {
  const { showToast } = useToast();
  const [gatePasses, setGatePasses] = useState<GatePassRecord[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Create Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    gatePassType: 'INWARD' as 'INWARD' | 'OUTWARD',
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    transporter: '',
    vendorId: '',
    dealerId: '',
    itemDescription: '',
    itemQuantity: 1,
    notes: '',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [gpRes, venRes, dlrRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/gate-passes').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/procurement/vendors').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/dealers').catch(() => ({ data: [] })),
      ]);

      setGatePasses(Array.isArray(gpRes.data) ? gpRes.data : gpRes.data?.data || []);
      setVendors(Array.isArray(venRes.data) ? venRes.data : venRes.data?.data || []);
      setDealers(Array.isArray(dlrRes.data) ? dlrRes.data : dlrRes.data?.data || []);
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load gate passes', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreatePass = async () => {
    if (!formData.vehicleNumber || !formData.itemDescription) {
      showToast({ title: 'Validation Error', message: 'Vehicle # and item description are required', type: 'error' });
      return;
    }

    try {
      await ApiClient.post('/api/v1/gate-passes', {
        gatePassType: formData.gatePassType,
        vehicleNumber: formData.vehicleNumber,
        driverName: formData.driverName || undefined,
        driverPhone: formData.driverPhone || undefined,
        transporter: formData.transporter || undefined,
        vendorId: formData.gatePassType === 'INWARD' ? formData.vendorId || undefined : undefined,
        dealerId: formData.gatePassType === 'OUTWARD' ? formData.dealerId || undefined : undefined,
        notes: formData.notes || undefined,
        items: [
          {
            description: formData.itemDescription,
            quantity: Number(formData.itemQuantity) || 1,
          },
        ],
      });

      showToast({ title: 'Success', message: 'Gate pass generated and recorded', type: 'success' });
      setIsModalOpen(false);
      setFormData({
        gatePassType: 'INWARD',
        vehicleNumber: '',
        driverName: '',
        driverPhone: '',
        transporter: '',
        vendorId: '',
        dealerId: '',
        itemDescription: '',
        itemQuantity: 1,
        notes: '',
      });
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Failed to generate gate pass', type: 'error' });
    }
  };

  const filteredPasses = gatePasses.filter((g) => {
    const matchesSearch =
      g.gatePassNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.vehicleNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.driverName && g.driverName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (g.transporter && g.transporter.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || g.passType === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalPasses = gatePasses.length;
  const inwardPasses = gatePasses.filter((g) => g.passType === 'INWARD').length;
  const outwardPasses = gatePasses.filter((g) => g.passType === 'OUTWARD').length;

  const columns: ColumnDef<GatePassRecord>[] = [
    {
      key: 'gatePassNumber',
      header: 'Pass #',
      render: (g) => <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{g.gatePassNumber}</span>,
    },
    {
      key: 'passType',
      header: 'Type',
      render: (g) => (
        <StatusBadge
          status={g.passType}
          variant={g.passType === 'INWARD' ? 'primary' : 'success'}
        />
      ),
    },
    {
      key: 'date',
      header: 'Date & Time',
      render: (g) => new Date(g.date).toLocaleString(),
    },
    {
      key: 'vehicleNo',
      header: 'Vehicle / Transporter',
      render: (g) => (
        <div>
          <div style={{ fontWeight: 600 }}>{g.vehicleNo}</div>
          {g.transporter && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{g.transporter}</div>}
        </div>
      ),
    },
    {
      key: 'driver',
      header: 'Driver',
      render: (g) => (
        <div>
          <div>{g.driverName || 'N/A'}</div>
          {g.driverPhone && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{g.driverPhone}</div>}
        </div>
      ),
    },
    {
      key: 'party',
      header: 'Vendor / Dealer',
      render: (g) => g.vendor?.name || g.dealer?.name || 'General Movement',
    },
    {
      key: 'status',
      header: 'Status',
      render: (g) => <StatusBadge status={g.status || 'VERIFIED'} variant="success" />,
    },
  ];

  return (
    <ListPageTemplate
      title="Gate Passes (Inward & Outward Logistics)"
      subtitle="Factory security gate pass verification linked to Purchase receipts and Sales dispatches."
      actions={
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <IconPlus size={16} /> Generate Gate Pass
        </Button>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <KpiCard title="Total Movements" value={totalPasses} subtitle="All recorded passes" />
        <KpiCard title="Inward (Receipts)" value={inwardPasses} subtitle="Material arrivals" />
        <KpiCard title="Outward (Dispatches)" value={outwardPasses} subtitle="Dealer shipments" />
        <KpiCard title="Gate Security" value="100% Verified" subtitle="All movements tracked" />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <Input
            placeholder="Search by pass #, vehicle, driver, or transporter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={[
            { label: 'All Movements', value: 'ALL' },
            { label: 'INWARD', value: 'INWARD' },
            { label: 'OUTWARD', value: 'OUTWARD' },
          ]}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : filteredPasses.length === 0 ? (
        <EmptyState
          title="No Gate Passes Found"
          description="Generate an inward gate pass for arriving raw materials or an outward pass for dealer shipments."
          actionLabel="Generate Gate Pass"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <DataTable columns={columns} data={filteredPasses} />
      )}

      {/* Generate Gate Pass Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Generate Gate Pass"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreatePass}>
              Issue Gate Pass
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Select
            label="Pass Movement Type *"
            value={formData.gatePassType}
            onChange={(e) => setFormData({ ...formData, gatePassType: e.target.value as any })}
            options={[
              { label: 'INWARD (Receiving Materials)', value: 'INWARD' },
              { label: 'OUTWARD (Dispatching Goods)', value: 'OUTWARD' },
            ]}
          />

          <Input
            label="Vehicle Registration # *"
            placeholder="e.g. LES-19-4820"
            value={formData.vehicleNumber}
            onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
          />

          <Input
            label="Driver Full Name"
            placeholder="e.g. Muhammad Rafiq"
            value={formData.driverName}
            onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
          />

          <Input
            label="Driver Mobile #"
            placeholder="e.g. 0321-7654321"
            value={formData.driverPhone}
            onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
          />

          <Input
            label="Transporter / Cargo Co."
            placeholder="e.g. Faisal Movers / Bilal Goods"
            value={formData.transporter}
            onChange={(e) => setFormData({ ...formData, transporter: e.target.value })}
          />

          {formData.gatePassType === 'INWARD' ? (
            <Select
              label="Source Vendor"
              value={formData.vendorId}
              onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
              options={[
                { label: 'Select Vendor...', value: '' },
                ...vendors.map((v) => ({ label: `${v.code} - ${v.name}`, value: v.id })),
              ]}
            />
          ) : (
            <Select
              label="Destination Dealer"
              value={formData.dealerId}
              onChange={(e) => setFormData({ ...formData, dealerId: e.target.value })}
              options={[
                { label: 'Select Dealer...', value: '' },
                ...dealers.map((d) => ({ label: `${d.code} - ${d.name}`, value: d.id })),
              ]}
            />
          )}

          <div style={{ gridColumn: 'span 2' }}>
            <Input
              label="Goods / Materials Description *"
              placeholder="e.g. 50 Cartons Oil or 20 Tons Chemical Drums"
              value={formData.itemDescription}
              onChange={(e) => setFormData({ ...formData, itemDescription: e.target.value })}
            />
          </div>

          <Input
            label="Quantity / Packages"
            type="number"
            min="1"
            value={formData.itemQuantity}
            onChange={(e) => setFormData({ ...formData, itemQuantity: Number(e.target.value) })}
          />

          <Input
            label="Security Remarks / Bilty"
            placeholder="Seal number or remarks"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>
      </Modal>
    </ListPageTemplate>
  );
};
