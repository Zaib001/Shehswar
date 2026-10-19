'use client';

/**
 * SHEHSWAR ONE360 - Vendor Quotations UI
 *
 * Implements:
 * - Commercial supplier quote log with net price valuations and validity windows
 * - Quotation Detail view with itemized pricing, taxes, discounts and warranty specifications
 * - Quote entry form for recording supplier bids against RFQs
 */
import React, { useState, useEffect, useCallback } from 'react';
import { QuotationStatus } from '@shehswar/types';
import { ProcurementQuotation, ProcurementRFQ, ProcurementVendor } from './mock-data';
import { ListPageTemplate, DetailPageTemplate, FormPageTemplate } from '../templates';
import {
  DataTable,
  ColumnDef,
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatusBadge,
  Badge,
  KpiCard,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '../ui';
import {
  IconPlus,
  IconEye,
  IconCheck,
  IconClock,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export const QuotationsView: React.FC = () => {
  const { showToast } = useToast();
  const [quotations, setQuotations] = useState<ProcurementQuotation[]>([]);
  const [availableRfqs, setAvailableRfqs] = useState<ProcurementRFQ[]>([]);
  const [availableVendors, setAvailableVendors] = useState<ProcurementVendor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<ProcurementQuotation | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form State
  const [formData, setFormData] = useState({
    rfqId: '',
    vendorId: '',
    quotationNumber: '',
    currency: 'PKR',
    deliveryLeadDays: '7',
    paymentTerms: '30_DAYS_CREDIT',
    validityDate: '2026-11-15',
    warranty: '12 Months Manufacturer Warranty',
    notes: '',
  });

  const fetchQuotations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [qRes, rfqRes, vRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/procurement/quotations'),
        ApiClient.get<any>('/api/v1/procurement/rfqs'),
        ApiClient.get<any>('/api/v1/procurement/vendors'),
      ]);

      const rawQuotes = qRes.data?.items || (Array.isArray(qRes.data) ? qRes.data : []);
      const mapped: ProcurementQuotation[] = rawQuotes.map((q: any) => ({
        id: q.id,
        organizationId: q.organizationId,
        companyId: q.companyId,
        rfqId: q.rfqId,
        rfqNumber: q.rfq?.rfqNumber || (q.rfqId ? 'RFQ-' + q.rfqId.slice(0, 8) : 'RFQ'),
        vendorId: q.vendorId,
        vendorCode: q.vendor?.code || 'VND',
        vendorName: q.vendor?.name || 'Vendor Name',
        quotationNumber: q.quotationNumber,
        currency: q.currency || 'PKR',
        subtotal: Number(q.subtotal) || 0,
        taxAmount: Number(q.taxAmount) || 0,
        discountAmount: Number(q.discountAmount) || 0,
        netAmount: Number(q.netAmount) || 0,
        deliveryLeadDays: Number(q.deliveryLeadDays) || 7,
        paymentTerms: q.paymentTerms || '30_DAYS_CREDIT',
        validityDate: q.validityDate ? new Date(q.validityDate).toISOString().split('T')[0] : '2026-11-15',
        warranty: q.warranty || '',
        status: q.status || QuotationStatus.RECEIVED,
        isSelected: q.isSelected || false,
        selectionJustification: q.selectionJustification || undefined,
        items: q.items?.map((it: any) => ({
          itemName: it.itemName,
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'KG',
          unitPrice: Number(it.unitPrice) || 0,
          taxRate: Number(it.taxRate) || 18,
          discountRate: Number(it.discountRate) || 0,
          lineTotal: Number(it.lineTotal) || 0,
        })) || [],
      }));

      const rawRfqs = rfqRes.data?.items || (Array.isArray(rfqRes.data) ? rfqRes.data : []);
      const rawVendors = vRes.data?.items || (Array.isArray(vRes.data) ? vRes.data : []);
      setQuotations(mapped);
      setAvailableRfqs(rawRfqs);
      setAvailableVendors(rawVendors);

      if (rawRfqs.length > 0 && !formData.rfqId) {
        setFormData((prev) => ({ ...prev, rfqId: rawRfqs[0].id }));
      }
      if (rawVendors.length > 0 && !formData.vendorId) {
        setFormData((prev) => ({ ...prev, vendorId: rawVendors[0].id }));
      }
    } catch (err: any) {
      console.error('Failed to load quotations:', err);
      setError(err.message || 'Failed to connect to backend API');
    } finally {
      setIsLoading(false);
    }
  }, [formData.rfqId, formData.vendorId]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const [formItems, setFormItems] = useState([
    {
      itemName: 'Nitric Acid 68% Technical Grade',
      quantity: 75,
      unit: 'TON',
      unitPrice: 104000,
      taxRate: 18,
      discountRate: 0,
      lineTotal: 9208800,
    },
  ]);

  const formSubtotal = formItems.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
  const formTax = formItems.reduce(
    (acc, i) => acc + (i.quantity * i.unitPrice * i.taxRate) / 100,
    0,
  );
  const formNet = formSubtotal + formTax;

  const filteredQuotes = quotations.filter((q) => {
    const s = searchQuery.toLowerCase();
    const matchesSearch =
      q.quotationNumber.toLowerCase().includes(s) ||
      (q.vendorName ? q.vendorName.toLowerCase().includes(s) : false) ||
      (q.rfqNumber ? q.rfqNumber.toLowerCase().includes(s) : false);
    const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns: ColumnDef<ProcurementQuotation>[] = [
    {
      id: 'quotationNumber',
      header: 'Quotation #',
      accessorKey: 'quotationNumber',
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
          {row.original.quotationNumber}
        </span>
      ),
    },
    {
      id: 'vendor',
      header: 'Supplier',
      accessorKey: 'vendorName',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.original.vendorName}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{row.original.vendorCode}</div>
        </div>
      ),
    },
    {
      id: 'rfq',
      header: 'Linked RFQ',
      accessorKey: 'rfqNumber',
      cell: ({ row }) => (
        <Badge variant="outline" size="sm">
          {row.original.rfqNumber}
        </Badge>
      ),
    },
    {
      id: 'commercial',
      header: 'Net Amount & Terms',
      accessorKey: 'netAmount',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>
            PKR {row.original.netAmount.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Lead: {row.original.deliveryLeadDays}d • {row.original.paymentTerms.replace(/_/g, ' ')}
          </div>
        </div>
      ),
    },
    {
      id: 'validity',
      header: 'Validity Date',
      accessorKey: 'validityDate',
      cell: ({ row }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <IconClock size={12} color="var(--color-text-muted)" />
          <span>{row.original.validityDate}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => {
        const s = row.original.status;
        const variant =
          s === QuotationStatus.SELECTED
            ? 'success'
            : s === QuotationStatus.REJECTED
              ? 'danger'
              : s === QuotationStatus.UNDER_REVIEW
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
            setSelectedQuote(row.original);
            setMode('detail');
          }}
        >
          <IconEye size={14} /> View
        </Button>
      ),
    },
  ];

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        rfqId: formData.rfqId,
        vendorId: formData.vendorId,
        quotationNumber: formData.quotationNumber,
        currency: formData.currency,
        deliveryLeadDays: Number(formData.deliveryLeadDays) || 7,
        paymentTerms: formData.paymentTerms,
        validityDate: new Date(formData.validityDate).toISOString(),
        warranty: formData.warranty,
        notes: formData.notes,
        items: formItems.map((fi) => ({
          itemName: fi.itemName,
          quantity: Number(fi.quantity) || 1,
          unit: fi.unit,
          unitPrice: Number(fi.unitPrice) || 0,
          taxRate: Number(fi.taxRate) || 18,
          discountRate: Number(fi.discountRate) || 0,
        })),
      };

      await ApiClient.post('/api/v1/procurement/quotations', payload);
      showToast({
        title: 'Quotation Recorded',
        description: `Quotation ${formData.quotationNumber} recorded in PostgreSQL database.`,
        type: 'success',
      });
      await fetchQuotations();
      setMode('list');
    } catch (err: any) {
      showToast({
        title: 'Recording Failed',
        description: err.message || 'Could not record quotation',
        type: 'error',
      });
    }
  };

  // ==========================================
  // RENDER DETAIL VIEW
  // ==========================================
  if (mode === 'detail' && selectedQuote) {
    const q = selectedQuote;
    return (
      <DetailPageTemplate
        title={q.quotationNumber}
        subtitle={`${q.vendorName} (${q.vendorCode}) • Linked to: ${q.rfqNumber}`}
        breadcrumbs={[
          { label: 'Procurement', href: '#' },
          { label: 'Quotations', onClick: () => setMode('list') },
          { label: q.quotationNumber },
        ]}
        statusBadge={
          <StatusBadge
            status={q.status.toLowerCase()}
            variant={
              q.status === QuotationStatus.SELECTED
                ? 'success'
                : q.status === QuotationStatus.REJECTED
                  ? 'danger'
                  : 'default'
            }
          />
        }
        actions={
          <Button variant="secondary" onClick={() => setMode('list')}>
            Back to List
          </Button>
        }
        tabs={[
          {
            id: 'commercial',
            label: 'Commercial Breakdown',
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <KpiCard title="Net Proposal Amount" value={`PKR ${q.netAmount.toLocaleString()}`} />
                  <KpiCard title="Delivery Lead Time" value={`${q.deliveryLeadDays} Calendar Days`} />
                  <KpiCard title="Payment Terms" value={q.paymentTerms.replace(/_/g, ' ')} />
                  <KpiCard title="Quote Validity" value={q.validityDate} />
                </div>

                {q.selectionJustification && (
                  <Card style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b981' }}>
                    <CardHeader>
                      <CardTitle style={{ color: '#047857', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <IconCheck size={18} /> Official Award Justification
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div style={{ fontSize: '13px', lineHeight: 1.5 }}>{q.selectionJustification}</div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Quoted Line Items & Rates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px' }}>Material</th>
                          <th style={{ padding: '8px 12px' }}>Quantity</th>
                          <th style={{ padding: '8px 12px' }}>Unit Price (PKR)</th>
                          <th style={{ padding: '8px 12px' }}>Sales Tax</th>
                          <th style={{ padding: '8px 12px' }}>Line Total (PKR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '12px', fontWeight: 600 }}>{item.itemName}</td>
                            <td style={{ padding: '12px' }}>
                              {item.quantity.toLocaleString()} {item.unit}
                            </td>
                            <td style={{ padding: '12px' }}>PKR {item.unitPrice.toLocaleString()}</td>
                            <td style={{ padding: '12px' }}>{item.taxRate}%</td>
                            <td style={{ padding: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>
                              PKR {item.lineTotal.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            ),
          },
        ]}
      />
    );
  }

  // ==========================================
  // RENDER FORM VIEW (CREATE QUOTE)
  // ==========================================
  if (mode === 'create') {
    return (
      <FormPageTemplate
        title="Record Supplier Quotation"
        subtitle="Log commercial pricing received against an active RFQ for comparative evaluation."
        breadcrumbs={[
          { label: 'Procurement', href: '#' },
          { label: 'Quotations', onClick: () => setMode('list') },
          { label: 'New Quote' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={handleCreateSubmit}
        submitLabel={`Save Quotation (PKR ${formNet.toLocaleString()})`}
        sections={[
          {
            id: 'details',
            title: '1. RFQ & Supplier Identification',
            description: 'Link quotation to bidding request and bidding supplier',
            content: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Request For Quotation (RFQ) *
                  </label>
                  <Select
                    value={formData.rfqId}
                    onChange={(e) => setFormData({ ...formData, rfqId: e.target.value })}
                    options={availableRfqs.map((r) => ({ value: r.id, label: `${r.rfqNumber} - ${r.title}` }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Bidding Supplier *
                  </label>
                  <Select
                    value={formData.vendorId}
                    onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                    options={availableVendors.map((v) => ({
                      value: v.id,
                      label: `${v.name} (${v.code})`,
                    }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Supplier Quotation Ref # *
                  </label>
                  <Input
                    placeholder="e.g. QT-ENG-2026-9901"
                    value={formData.quotationNumber}
                    onChange={(e) => setFormData({ ...formData, quotationNumber: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Delivery Lead Days
                  </label>
                  <Input
                    type="number"
                    value={formData.deliveryLeadDays}
                    onChange={(e) => setFormData({ ...formData, deliveryLeadDays: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Payment Terms
                  </label>
                  <Select
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    options={[
                      { value: '30_DAYS_CREDIT', label: '30 Days Credit' },
                      { value: '60_DAYS_CREDIT', label: '60 Days Credit' },
                      { value: 'ADVANCE_PAYMENT', label: 'Advance Payment' },
                    ]}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Validity Expiration Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.validityDate}
                    onChange={(e) => setFormData({ ...formData, validityDate: e.target.value })}
                    required
                  />
                </div>
              </div>
            ),
          },
          {
            id: 'pricing',
            title: '2. Proposed Line Item Pricing',
            description: 'Itemized rates, taxes and line calculations',
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {formItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)',
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Material
                      </label>
                      <Input
                        value={item.itemName}
                        onChange={(e) => {
                          const updated = [...formItems];
                          updated[idx] = { ...updated[idx]!, itemName: e.target.value };
                          setFormItems(updated);
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Quantity
                      </label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...formItems];
                          const qty = Number(e.target.value);
                          updated[idx] = {
                            ...updated[idx]!,
                            quantity: qty,
                            lineTotal: qty * (updated[idx]?.unitPrice || 0) * 1.18,
                          };
                          setFormItems(updated);
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Unit Rate (PKR)
                      </label>
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const updated = [...formItems];
                          const rate = Number(e.target.value);
                          updated[idx] = {
                            ...updated[idx]!,
                            unitPrice: rate,
                            lineTotal: (updated[idx]?.quantity || 1) * rate * 1.18,
                          };
                          setFormItems(updated);
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Sales Tax %
                      </label>
                      <Input value="18%" readOnly />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Net Line Total
                      </label>
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)', padding: '8px 0' }}>
                        PKR {item.lineTotal.toLocaleString()}
                      </div>
                    </div>
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
      title="Vendor Quotations"
      subtitle="Commercial bids received from competing suppliers for material and packaging requisitions."
      breadcrumbs={[{ label: 'Procurement', href: '#' }, { label: 'Quotations' }]}
      kpiMetrics={[
        { title: 'Quotations Received', value: quotations.length },
        {
          title: 'Awarded Proposals',
          value: quotations.filter((q) => q.status === QuotationStatus.SELECTED).length,
        },
        {
          title: 'Under Review',
          value: quotations.filter((q) => q.status === QuotationStatus.RECEIVED).length,
        },
      ]}
      filters={[
        {
          id: 'search',
          label: 'Search',
          component: (
            <Input
              placeholder="Search quote #, supplier, RFQ..."
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
                { value: QuotationStatus.SELECTED, label: 'Selected Winner' },
                { value: QuotationStatus.RECEIVED, label: 'Received' },
                { value: QuotationStatus.REJECTED, label: 'Rejected' },
              ]}
            />
          ),
        },
      ]}
      primaryAction={{
        label: 'Record New Quotation',
        icon: <IconPlus size={16} />,
        onClick: () => setMode('create'),
      }}
    >
      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState title="Failed to Load Quotations" message={error} onRetry={fetchQuotations} />
      ) : filteredQuotes.length === 0 ? (
        <EmptyState
          title="No Vendor Quotations Found"
          description={
            searchQuery || statusFilter !== 'ALL'
              ? 'No quotations matched your search filter criteria.'
              : 'No quotations registered in PostgreSQL yet. Record bids received from suppliers.'
          }
          actionLabel="Record New Quotation"
          onAction={() => setMode('create')}
        />
      ) : (
        <DataTable data={filteredQuotes} columns={columns} pagination={{ pageSize: 10 }} />
      )}
    </ListPageTemplate>
  );
};
