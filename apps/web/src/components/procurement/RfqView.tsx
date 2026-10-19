'use client';

/**
 * SHEHSWAR ONE360 - Request For Quotation (RFQ) UI
 *
 * Implements:
 * - Competitive bidding list with response tracking and deadline indicators
 * - RFQ Detail Page with multi-vendor invitations and real-time bid statuses
 * - RFQ Creation Form with approved supplier selection and PR linkage
 * - Direct transition to Quotation Comparison Matrix
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  RfqStatus,
  RfqVendorStatus,
} from '@shehswar/types';
import { ProcurementRFQ, ProcurementVendor } from './mock-data';
import { ListPageTemplate, DetailPageTemplate, FormPageTemplate } from '../templates';
import {
  DataTable,
  ColumnDef,
  Button,
  Input,
  Select,
  Textarea,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatusBadge,
  Badge,
  Checkbox,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '../ui';
import {
  IconPlus,
  IconEye,
  IconSend,
  IconClock,
  IconCheck,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

interface RfqViewProps {
  onNavigateToComparison?: (rfqId: string) => void;
}

export const RfqView: React.FC<RfqViewProps> = ({ onNavigateToComparison }) => {
  const { showToast } = useToast();
  const [rfqs, setRfqs] = useState<ProcurementRFQ[]>([]);
  const [availableVendors, setAvailableVendors] = useState<ProcurementVendor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRFQ, setSelectedRFQ] = useState<ProcurementRFQ | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    prNumber: '',
    deadline: '2026-10-15',
    notes: '',
  });

  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);

  const fetchRfqs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rfqRes, vendorRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/procurement/rfqs'),
        ApiClient.get<any>('/api/v1/procurement/vendors'),
      ]);

      const rawRfqs = rfqRes.data?.items || (Array.isArray(rfqRes.data) ? rfqRes.data : []);
      const mappedRfqs: ProcurementRFQ[] = rawRfqs.map((r: any) => ({
        id: r.id,
        organizationId: r.organizationId,
        companyId: r.companyId,
        rfqNumber: r.rfqNumber,
        prId: r.prId,
        prNumber: r.requisition?.prNumber || (r.prId ? 'PR-' + r.prId.slice(0, 8) : undefined),
        title: r.title,
        issueDate: r.issueDate ? new Date(r.issueDate).toISOString().split('T')[0] : '2026-09-27',
        deadline: r.deadline ? new Date(r.deadline).toISOString().split('T')[0] : '2026-10-15',
        status: r.status,
        notes: r.notes || '',
        invitedVendors: r.vendors?.map((v: any) => ({
          vendorId: v.vendorId,
          vendorCode: v.vendor?.code || 'VND',
          vendorName: v.vendor?.name || 'Vendor Name',
          status: v.status || RfqVendorStatus.INVITED,
          hasQuotation: v.status === RfqVendorStatus.SUBMITTED,
        })) || [],
      }));

      const rawVendors = vendorRes.data?.items || (Array.isArray(vendorRes.data) ? vendorRes.data : []);
      setRfqs(mappedRfqs);
      setAvailableVendors(rawVendors);
      if (rawVendors.length > 0 && selectedVendorIds.length === 0) {
        setSelectedVendorIds(rawVendors.slice(0, 2).map((v: any) => v.id));
      }
    } catch (err: any) {
      console.error('Failed to load RFQs:', err);
      setError(err.message || 'Failed to connect to backend API');
    } finally {
      setIsLoading(false);
    }
  }, [selectedVendorIds.length]);

  useEffect(() => {
    fetchRfqs();
  }, [fetchRfqs]);

  const filteredRfqs = rfqs.filter((rfq) => {
    const matchesSearch =
      rfq.rfqNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rfq.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || rfq.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns: ColumnDef<ProcurementRFQ>[] = [
    {
      id: 'rfqNumber',
      header: 'RFQ Number',
      accessorKey: 'rfqNumber',
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
          {row.original.rfqNumber}
        </span>
      ),
    },
    {
      id: 'title',
      header: 'RFQ Title / Purpose',
      accessorKey: 'title',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.original.title}</div>
          {row.original.prNumber && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Linked PR: {row.original.prNumber}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'deadline',
      header: 'Submission Deadline',
      accessorKey: 'deadline',
      cell: ({ row }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconClock size={14} color="var(--color-text-muted)" />
          <span style={{ fontWeight: 500 }}>{row.original.deadline}</span>
        </div>
      ),
    },
    {
      id: 'vendors',
      header: 'Invited Suppliers',
      cell: ({ row }) => {
        const total = row.original.invitedVendors.length;
        const submitted = row.original.invitedVendors.filter((v: any) => v.status === RfqVendorStatus.SUBMITTED).length;
        return (
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            {submitted} / {total} Submitted
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => {
        const s = row.original.status;
        const variant =
          s === RfqStatus.COMPARISON_COMPLETED
            ? 'success'
            : s === RfqStatus.QUOTATIONS_RECEIVED
              ? 'info'
              : s === RfqStatus.SENT
                ? 'warning'
                : 'default';
        return <StatusBadge status={s.toLowerCase()} variant={variant} />;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedRFQ(row.original);
            setMode('detail');
          }}
        >
          <IconEye size={14} /> View
        </Button>
      ),
    },
  ];

  // Live API Actions
  const handleSendRfq = async (rfq: ProcurementRFQ) => {
    try {
      await ApiClient.post(`/api/v1/procurement/rfqs/${rfq.id}/send`, {});
      showToast({
        title: 'RFQ Dispatched to Suppliers',
        description: `Formal RFQ invitation emailed to ${rfq.invitedVendors.length} suppliers in PostgreSQL.`,
        type: 'success',
      });
      await fetchRfqs();
      if (selectedRFQ?.id === rfq.id) {
        setSelectedRFQ((prev) => (prev ? { ...prev, status: RfqStatus.SENT } : null));
      }
    } catch (err: any) {
      showToast({
        title: 'Dispatch Failed',
        description: err.message || 'Could not send RFQ',
        type: 'error',
      });
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedVendorIds.length === 0) {
      showToast({
        title: 'Validation Error',
        description: 'Please select at least one vendor for this RFQ.',
        type: 'error',
      });
      return;
    }

    try {
      const payload = {
        title: formData.title,
        deadline: new Date(formData.deadline).toISOString(),
        vendorIds: selectedVendorIds,
        notes: formData.notes,
      };

      await ApiClient.post('/api/v1/procurement/rfqs', payload);
      showToast({
        title: 'RFQ Draft Created',
        description: `RFQ initialized with ${selectedVendorIds.length} suppliers in PostgreSQL.`,
        type: 'success',
      });
      await fetchRfqs();
      setMode('list');
    } catch (err: any) {
      showToast({
        title: 'Creation Failed',
        description: err.message || 'Could not create RFQ',
        type: 'error',
      });
    }
  };

  // ==========================================
  // RENDER DETAIL VIEW
  // ==========================================
  if (mode === 'detail' && selectedRFQ) {
    const rfq = selectedRFQ;
    return (
      <DetailPageTemplate
        title={rfq.rfqNumber}
        subtitle={`${rfq.title} • Linked: ${rfq.prNumber || 'Standalone'}`}
        breadcrumbs={[
          { label: 'Procurement', href: '#' },
          { label: 'RFQs', onClick: () => setMode('list') },
          { label: rfq.rfqNumber },
        ]}
        statusBadge={
          <StatusBadge
            status={rfq.status.toLowerCase()}
            variant={
              rfq.status === RfqStatus.COMPARISON_COMPLETED
                ? 'success'
                : rfq.status === RfqStatus.QUOTATIONS_RECEIVED
                  ? 'info'
                  : rfq.status === RfqStatus.SENT
                    ? 'warning'
                    : 'default'
            }
          />
        }
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setMode('list')}>
              Back to List
            </Button>
            {rfq.status === RfqStatus.DRAFT && (
              <Button variant="primary" onClick={() => handleSendRfq(rfq)}>
                <IconSend size={16} /> Send to Suppliers
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => {
                if (onNavigateToComparison) {
                  onNavigateToComparison(rfq.id);
                } else {
                  showToast({
                    title: 'Quotation Comparison',
                    description: 'Opening side-by-side comparison matrix.',
                    type: 'info',
                  });
                }
              }}
            >
              <IconCheck size={16} /> Compare Quotations
            </Button>
          </div>
        }
        tabs={[
          {
            id: 'vendors',
            label: `Invited Suppliers (${rfq.invitedVendors.length})`,
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Supplier Bidding Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px' }}>Vendor Code</th>
                        <th style={{ padding: '8px 12px' }}>Supplier Name</th>
                        <th style={{ padding: '8px 12px' }}>Response Status</th>
                        <th style={{ padding: '8px 12px' }}>Quotation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfq.invitedVendors.map((v) => (
                        <tr key={v.vendorId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '12px', fontWeight: 600, fontFamily: 'monospace' }}>
                            {v.vendorCode}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{v.vendorName}</td>
                          <td style={{ padding: '12px' }}>
                            <StatusBadge
                              status={v.status.toLowerCase()}
                              variant={v.status === RfqVendorStatus.SUBMITTED ? 'success' : 'warning'}
                            />
                          </td>
                          <td style={{ padding: '12px' }}>
                            {v.hasQuotation ? (
                              <Badge variant="success" size="sm">Quotation Received</Badge>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)' }}>Pending Response</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    );
  }

  // ==========================================
  // RENDER FORM VIEW (CREATE RFQ)
  // ==========================================
  if (mode === 'create') {
    return (
      <FormPageTemplate
        title="Create Request For Quotation (RFQ)"
        subtitle="Invite multiple approved suppliers to submit competitive commercial bids."
        breadcrumbs={[
          { label: 'Procurement', href: '#' },
          { label: 'RFQs', onClick: () => setMode('list') },
          { label: 'New RFQ' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={handleCreateSubmit}
        submitLabel="Save RFQ Draft"
        sections={[
          {
            id: 'details',
            title: '1. RFQ Specification & Timeline',
            description: 'Define bidding scope, linked requisition, and deadline',
            content: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    RFQ Title *
                  </label>
                  <Input
                    placeholder="e.g. Q4 Supply of Nitric & Phosphoric Acids..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Linked Purchase Requisition
                  </label>
                  <Input
                    value={formData.prNumber}
                    onChange={(e) => setFormData({ ...formData, prNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Submission Deadline *
                  </label>
                  <Input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    required
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Technical Instructions / Delivery Terms
                  </label>
                  <Textarea
                    placeholder="Instructions for suppliers, delivery destination, packaging specifications..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
            ),
          },
          {
            id: 'suppliers',
            title: '2. Select Participating Suppliers',
            description: 'Only approved vendors from the master list can be invited',
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {availableVendors.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Checkbox
                        checked={selectedVendorIds.includes(v.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVendorIds([...selectedVendorIds, v.id]);
                          } else {
                            setSelectedVendorIds(selectedVendorIds.filter((id) => id !== v.id));
                          }
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{v.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {v.code} • {String(v.vendorType).replace(/_/g, ' ')} • Rating: ★ {Number(v.rating || 5).toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <Badge variant={v.status === 'APPROVED' ? 'success' : 'default'} size="sm">
                      {v.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />
    );
  }

  // ==========================================
  // RENDER LIST VIEW (DEFAULT)
  // ==========================================
  return (
    <ListPageTemplate
      title="Request For Quotations (RFQ)"
      subtitle="Competitively solicit commercial pricing, lead times, and payment terms from pre-qualified suppliers."
      breadcrumbs={[{ label: 'Procurement', href: '#' }, { label: 'RFQs' }]}
      kpiMetrics={[
        { title: 'Total Active RFQs', value: rfqs.length },
        {
          title: 'Awaiting Vendor Quotes',
          value: rfqs.filter((r) => r.status === RfqStatus.SENT).length,
        },
        {
          title: 'Ready for Comparison',
          value: rfqs.filter((r) => r.status === RfqStatus.COMPARISON_COMPLETED || r.status === RfqStatus.QUOTATIONS_RECEIVED).length,
        },
      ]}
      filters={[
        {
          id: 'search',
          label: 'Search',
          component: (
            <Input
              placeholder="Search RFQ #, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          ),
        },
        {
          id: 'status',
          label: 'Status',
          component: (
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: RfqStatus.COMPARISON_COMPLETED, label: 'Comparison Completed' },
                { value: RfqStatus.QUOTATIONS_RECEIVED, label: 'Quotations Received' },
                { value: RfqStatus.SENT, label: 'Sent to Suppliers' },
                { value: RfqStatus.DRAFT, label: 'Draft' },
              ]}
            />
          ),
        },
      ]}
      primaryAction={{
        label: 'Create New RFQ',
        icon: <IconPlus size={16} />,
        onClick: () => setMode('create'),
      }}
    >
      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState title="Failed to Load RFQs" message={error} onRetry={fetchRfqs} />
      ) : filteredRfqs.length === 0 ? (
        <EmptyState
          title="No Requests for Quotation Found"
          description={
            searchQuery || statusFilter !== 'ALL'
              ? 'No RFQs matched your search filter criteria.'
              : 'No RFQs recorded in PostgreSQL yet. Create an RFQ to solicit supplier proposals.'
          }
          actionLabel="Create New RFQ"
          onAction={() => setMode('create')}
        />
      ) : (
        <DataTable data={filteredRfqs} columns={columns} pagination={{ pageSize: 10 }} />
      )}
    </ListPageTemplate>
  );
};
