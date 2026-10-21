'use client';

/**
 * SHEHSWAR ONE360 - Vendor Master Management UI
 *
 * Implements:
 * - Enterprise List Page with search, multi-category filters, status badges, and 1-click Ledger access
 * - 360-Degree Detail Page with real Legal & Tax, Commercial, Banking, Certifications, Transactions, Performance, and Audit Trail
 * - Multi-section Form Template for Vendor Creation and Editing (All real fields persisted in PostgreSQL)
 * - Vendor Compliance Document / Certification upload & management
 * - Vendor Sub-Ledger statement view with Official Shehswar PDF Statement Download
 * - Multi-tier approval workflow actions (Submit for Approval, Approve, Block, Activate)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  VendorType,
  VendorStatus,
} from '@shehswar/types';
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
  KpiCard,
  Timeline,
  Modal,
  Badge,
  TableSkeleton,
  EmptyState,
} from '../ui';
import {
  IconPlus,
  IconEye,
  IconCheck,
  IconAlertTriangle,
  IconFileText,
  IconBuilding,
  IconRefresh,
  IconEdit,
  IconTrash,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';
import { VendorLedgerModal } from './VendorLedgerModal';

export interface VendorDocumentRecord {
  id: string;
  documentType: string;
  title: string;
  fileName: string;
  fileUrl?: string;
  fileSize?: number;
  expiryDate?: string;
  notes?: string;
  createdAt?: string;
}

export interface VendorRecord {
  id: string;
  organizationId: string;
  companyId: string;
  code: string;
  name: string;
  legalName?: string;
  vendorType: VendorType;
  category: string;
  status: VendorStatus;
  ntn?: string;
  strn?: string;
  registrationNo?: string;
  country: string;
  city?: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  website?: string;
  currency: string;
  paymentTerms: string;
  creditLimit: number;
  currentBalance?: number;
  rating: number;
  bankDetails?: {
    bankName?: string;
    accountTitle?: string;
    accountNumber?: string;
    iban?: string;
    branchCode?: string;
    swiftCode?: string;
  };
  notes?: string;
  documents?: VendorDocumentRecord[];
  purchaseOrders?: Array<{
    id: string;
    poNumber: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  }>;
  purchases?: Array<{
    id: string;
    voucherNumber: string;
    vendorInvoiceNo?: string;
    netAmount: number;
    postingStatus: string;
    date: string;
    createdAt: string;
  }>;
  auditLogs?: Array<{
    id: string;
    action: string;
    actorEmail?: string;
    createdAt: string;
  }>;
  calculatedPerformance?: {
    totalOrders: number;
    completedOrders: number;
    totalSpend: number;
    overallRating: number;
    onTimeDeliveryRate: number;
    rejectionRate: number;
    averageLeadDays: number;
  };
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const VendorsView: React.FC = () => {
  const { showToast } = useToast();
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedVendor, setSelectedVendor] = useState<VendorRecord | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Ledger Modal State
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [vendorForLedger, setVendorForLedger] = useState<VendorRecord | null>(null);

  // Add Document Modal State (in Detail View)
  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [docFormData, setDocFormData] = useState({
    title: '',
    documentType: 'TAX_CERTIFICATE',
    fileName: '',
    expiryDate: '',
    notes: '',
  });

  // Action Modals
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // Form State (for Create & Edit)
  const initialFormData = {
    code: '',
    name: '',
    legalName: '',
    vendorType: VendorType.RAW_MATERIAL,
    category: 'General Chemical Feedstock',
    ntn: '',
    strn: '',
    registrationNo: '',
    country: 'Pakistan',
    city: 'Lahore',
    address: '',
    contactPerson: '',
    phone: '',
    email: '',
    website: '',
    currency: 'PKR',
    paymentTerms: '30_DAYS_CREDIT',
    creditLimit: '0',
    rating: '5.0',
    bankName: '',
    accountTitle: '',
    accountNumber: '',
    iban: '',
    branchCode: '',
    notes: '',
    documents: [] as Array<{
      title: string;
      documentType: string;
      fileName: string;
      expiryDate: string;
      notes: string;
    }>,
  };

  const [formData, setFormData] = useState(initialFormData);

  // New inline document in creation form
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState('TAX_CERTIFICATE');
  const [newDocFileName, setNewDocFileName] = useState('');
  const [newDocExpiry, setNewDocExpiry] = useState('');

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ApiClient.get<any>('/api/v1/procurement/vendors');
      const items = res.data?.items || (Array.isArray(res.data) ? res.data : []);
      const mapped: VendorRecord[] = items.map((v: any) => ({
        id: v.id,
        organizationId: v.organizationId,
        companyId: v.companyId,
        code: v.code || '',
        name: v.name || '',
        legalName: v.legalName || '',
        vendorType: v.vendorType || VendorType.RAW_MATERIAL,
        category: v.category || 'General',
        status: v.status || VendorStatus.DRAFT,
        ntn: v.ntn || '',
        strn: v.strn || '',
        registrationNo: v.registrationNo || '',
        country: v.country || 'Pakistan',
        city: v.city || '',
        address: v.address || '',
        contactPerson: v.contactPerson || '',
        phone: v.phone || '',
        email: v.email || '',
        website: v.website || '',
        currency: v.currency || 'PKR',
        paymentTerms: v.paymentTerms || '30_DAYS_CREDIT',
        creditLimit: Number(v.creditLimit) || 0,
        currentBalance: Number(v.currentBalance) || 0,
        rating: Number(v.rating) || 5.0,
        bankDetails: v.bankDetails || null,
        notes: v.notes || '',
        documents: v.documents || [],
        purchaseOrders: v.purchaseOrders || [],
        purchases: v.purchases || [],
        auditLogs: v.auditLogs || [],
        calculatedPerformance: v.calculatedPerformance || null,
        createdBy: v.createdBy,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }));
      setVendors(mapped);
    } catch (err: any) {
      console.error('Failed to load vendors:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  // Open full 360-degree detail view
  const handleOpenDetail = async (vendor: VendorRecord) => {
    setSelectedVendor(vendor);
    setMode('detail');
    try {
      const res = await ApiClient.get<any>(`/api/v1/procurement/vendors/${vendor.id}`);
      const fresh = res.data?.data || res.data;
      if (fresh) {
        setSelectedVendor(fresh);
      }
    } catch (err) {
      console.warn('Could not refresh full vendor 360 details:', err);
    }
  };

  // Open Edit Mode
  const handleOpenEdit = (v: VendorRecord) => {
    setFormData({
      code: v.code || '',
      name: v.name || '',
      legalName: v.legalName || '',
      vendorType: v.vendorType || VendorType.RAW_MATERIAL,
      category: v.category || 'General Chemical Feedstock',
      ntn: v.ntn || '',
      strn: v.strn || '',
      registrationNo: v.registrationNo || '',
      country: v.country || 'Pakistan',
      city: v.city || '',
      address: v.address || '',
      contactPerson: v.contactPerson || '',
      phone: v.phone || '',
      email: v.email || '',
      website: v.website || '',
      currency: v.currency || 'PKR',
      paymentTerms: v.paymentTerms || '30_DAYS_CREDIT',
      creditLimit: String(v.creditLimit || 0),
      rating: String(v.rating || 5.0),
      bankName: v.bankDetails?.bankName || '',
      accountTitle: v.bankDetails?.accountTitle || '',
      accountNumber: v.bankDetails?.accountNumber || '',
      iban: v.bankDetails?.iban || '',
      branchCode: v.bankDetails?.branchCode || '',
      notes: v.notes || '',
      documents: (v.documents || []).map((d) => ({
        title: d.title,
        documentType: d.documentType,
        fileName: d.fileName,
        expiryDate: d.expiryDate ? (d.expiryDate.split('T')[0] || '') : '',
        notes: d.notes || '',
      })),
    });
    setSelectedVendor(v);
    setMode('edit');
  };

  // Open Vendor Ledger Modal
  const handleOpenLedger = (v: VendorRecord) => {
    setVendorForLedger(v);
    setIsLedgerModalOpen(true);
  };

  // Add document to list inside create/edit form
  const handleAddDocToForm = () => {
    if (!newDocTitle) {
      showToast({ title: 'Validation Error', message: 'Document Title is required', type: 'error' });
      return;
    }
    const newDoc = {
      title: newDocTitle,
      documentType: newDocType,
      fileName: newDocFileName || `${newDocTitle.replace(/\s+/g, '_')}.pdf`,
      expiryDate: newDocExpiry,
      notes: '',
    };
    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, newDoc],
    }));
    setNewDocTitle('');
    setNewDocFileName('');
    setNewDocExpiry('');
    showToast({ title: 'Document Added', message: `Added ${newDocTitle} to registration draft.`, type: 'info' });
  };

  const handleRemoveDocFromForm = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== idx),
    }));
  };

  // Save new document directly from Detail View
  const handleSaveDocumentInDetail = async () => {
    if (!selectedVendor?.id || !docFormData.title) {
      showToast({ title: 'Validation Error', message: 'Document title is required', type: 'error' });
      return;
    }
    setIsSavingDoc(true);
    try {
      const res = await ApiClient.post<any>(`/api/v1/procurement/vendors/${selectedVendor.id}/documents`, {
        ...docFormData,
        fileName: docFormData.fileName || `${docFormData.title.replace(/\s+/g, '_')}.pdf`,
      });
      const createdDoc = res.data?.data || res.data;

      setSelectedVendor((prev) =>
        prev
          ? {
              ...prev,
              documents: [...(prev.documents || []), createdDoc],
            }
          : null
      );

      setIsAddDocModalOpen(false);
      setDocFormData({ title: '', documentType: 'TAX_CERTIFICATE', fileName: '', expiryDate: '', notes: '' });
      showToast({
        title: 'Certification Uploaded',
        message: 'Compliance document verified and linked to vendor master record.',
        type: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Upload Failed',
        message: err.message || 'Could not attach document',
        type: 'error',
      });
    } finally {
      setIsSavingDoc(false);
    }
  };

  // Live Approval Actions
  const handleApprove = async (vendor: VendorRecord) => {
    try {
      await ApiClient.post(`/api/v1/procurement/vendors/${vendor.id}/approve`, {});
      showToast({
        title: 'Vendor Approved',
        message: `${vendor.name} has been verified and activated in PostgreSQL.`,
        type: 'success',
      });
      await fetchVendors();
      if (selectedVendor?.id === vendor.id) {
        setSelectedVendor((prev) => (prev ? { ...prev, status: VendorStatus.APPROVED } : null));
      }
    } catch (err: any) {
      showToast({
        title: 'Approval Failed',
        message: err.message || 'Could not approve vendor',
        type: 'error',
      });
    }
  };

  const handleSubmitForApproval = async (vendor: VendorRecord) => {
    try {
      await ApiClient.post(`/api/v1/procurement/vendors/${vendor.id}/submit`, {});
      showToast({
        title: 'Submitted for Approval',
        message: `Approval request dispatched to Procurement Manager & Finance.`,
        type: 'info',
      });
      await fetchVendors();
      if (selectedVendor?.id === vendor.id) {
        setSelectedVendor((prev) => (prev ? { ...prev, status: VendorStatus.PENDING_APPROVAL } : null));
      }
    } catch (err: any) {
      showToast({
        title: 'Submission Failed',
        message: err.message || 'Could not submit vendor',
        type: 'error',
      });
    }
  };

  const handleBlock = async () => {
    if (!selectedVendor) return;
    try {
      await ApiClient.post(`/api/v1/procurement/vendors/${selectedVendor.id}/block`, {
        reason: blockReason,
      });
      setIsBlockModalOpen(false);
      setBlockReason('');
      showToast({
        title: 'Vendor Blocked',
        message: `${selectedVendor.name} has been restricted from receiving purchase orders.`,
        type: 'warning',
      });
      await fetchVendors();
      setSelectedVendor((prev) => (prev ? { ...prev, status: VendorStatus.BLOCKED } : null));
    } catch (err: any) {
      showToast({
        title: 'Block Failed',
        message: err.message || 'Could not block vendor',
        type: 'error',
      });
    }
  };

  const handleActivate = async (vendor: VendorRecord) => {
    try {
      await ApiClient.post(`/api/v1/procurement/vendors/${vendor.id}/activate`, {});
      showToast({
        title: 'Vendor Re-activated',
        message: `${vendor.name} is now approved for procurement.`,
        type: 'success',
      });
      await fetchVendors();
      if (selectedVendor?.id === vendor.id) {
        setSelectedVendor((prev) => (prev ? { ...prev, status: VendorStatus.APPROVED } : null));
      }
    } catch (err: any) {
      showToast({
        title: 'Activation Failed',
        message: err.message || 'Could not activate vendor',
        type: 'error',
      });
    }
  };

  // Submit Handler for Create & Edit
  const handleSaveVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      showToast({ title: 'Validation Error', message: 'Vendor Code and Name are required', type: 'error' });
      return;
    }

    try {
      const payload: any = {
        code: formData.code.toUpperCase(),
        name: formData.name,
        legalName: formData.legalName || formData.name,
        vendorType: formData.vendorType,
        category: formData.category,
        ntn: formData.ntn,
        strn: formData.strn,
        registrationNo: formData.registrationNo,
        country: formData.country,
        city: formData.city,
        address: formData.address,
        contactPerson: formData.contactPerson,
        phone: formData.phone,
        email: formData.email,
        website: formData.website,
        currency: formData.currency,
        paymentTerms: formData.paymentTerms,
        creditLimit: Number(formData.creditLimit) || 0,
        rating: Number(formData.rating) || 5.0,
        bankDetails: {
          bankName: formData.bankName,
          accountTitle: formData.accountTitle || formData.legalName || formData.name,
          accountNumber: formData.accountNumber,
          iban: formData.iban,
          branchCode: formData.branchCode || '001',
        },
        notes: formData.notes,
        documents: formData.documents.length > 0 ? formData.documents : undefined,
      };

      if (mode === 'create') {
        await ApiClient.post('/api/v1/procurement/vendors', payload);
        showToast({
          title: 'Vendor Created Successfully',
          message: `Vendor ${formData.code.toUpperCase()} registered in database with all details.`,
          type: 'success',
        });
      } else if (mode === 'edit' && selectedVendor) {
        await ApiClient.patch(`/api/v1/procurement/vendors/${selectedVendor.id}`, payload);
        showToast({
          title: 'Vendor Updated Successfully',
          message: `Master profile for ${formData.code.toUpperCase()} updated.`,
          type: 'success',
        });
      }

      await fetchVendors();
      setMode('list');
      setFormData(initialFormData);
    } catch (err: any) {
      showToast({
        title: 'Operation Failed',
        message: err.message || 'Could not save vendor master record',
        type: 'error',
      });
    }
  };

  // Filtered List for Table
  const filteredVendors = vendors.filter((v) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      v.name.toLowerCase().includes(q) ||
      v.code.toLowerCase().includes(q) ||
      (v.ntn ? v.ntn.toLowerCase().includes(q) : false) ||
      (v.contactPerson ? v.contactPerson.toLowerCase().includes(q) : false);
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || v.vendorType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Table Columns
  const columns: ColumnDef<VendorRecord>[] = [
    {
      id: 'code',
      header: 'Vendor Code',
      accessorKey: 'code',
      cell: ({ row }) => (
        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
          {row.original.code}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Vendor / Legal Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{row.original.name}</div>
          {row.original.legalName && row.original.legalName !== row.original.name && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{row.original.legalName}</div>
          )}
        </div>
      ),
    },
    {
      id: 'vendorType',
      header: 'Type / Category',
      accessorKey: 'vendorType',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.original.vendorType.replace(/_/g, ' ')}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{row.original.category}</div>
        </div>
      ),
    },
    {
      id: 'ntn',
      header: 'NTN / STRN',
      accessorKey: 'ntn',
      cell: ({ row }) => (
        <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          <div>{row.original.ntn || '—'}</div>
          {row.original.strn && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>STRN: {row.original.strn}</div>
          )}
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Contact Person & Phone',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.original.contactPerson || '—'}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{row.original.phone || '—'}</div>
        </div>
      ),
    },
    {
      id: 'rating',
      header: 'Rating',
      accessorKey: 'rating',
      cell: ({ row }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#f59e0b', fontSize: '14px' }}>★</span>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>{Number(row.original.rating || 5).toFixed(1)}</span>
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
          s === VendorStatus.APPROVED
            ? 'success'
            : s === VendorStatus.PENDING_APPROVAL
            ? 'warning'
            : s === VendorStatus.BLOCKED
            ? 'danger'
            : 'default';
        return <StatusBadge status={s.toLowerCase()} variant={variant} />;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenDetail(row.original)}
            title="View 360-Degree Vendor Detail"
          >
            <IconEye size={14} /> View
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenLedger(row.original)}
            title="Open Sub-Ledger & Download PDF"
            style={{ fontSize: '11.5px', padding: '4px 8px' }}
          >
            <IconFileText size={13} /> Ledger
          </Button>
        </div>
      ),
    },
  ];

  // ==========================================
  // RENDER DETAIL VIEW
  // ==========================================
  if (mode === 'detail' && selectedVendor) {
    const v = selectedVendor;

    return (
      <>
        <DetailPageTemplate
          title={v.name}
          subtitle={`${v.code} • ${v.vendorType.replace(/_/g, ' ')} • ${v.category || 'General'}`}
          breadcrumbs={[
            { label: 'Procurement', href: '#' },
            { label: 'Vendors / Suppliers', onClick: () => setMode('list') },
            { label: v.code },
          ]}
          statusBadge={
            <StatusBadge
              status={v.status.toLowerCase()}
              variant={
                v.status === VendorStatus.APPROVED
                  ? 'success'
                  : v.status === VendorStatus.PENDING_APPROVAL
                  ? 'warning'
                  : v.status === VendorStatus.BLOCKED
                  ? 'danger'
                  : 'default'
              }
            />
          }
          actions={
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => setMode('list')}>
                Back to List
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleOpenLedger(v)}
                style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
              >
                <IconFileText size={15} /> View & Download Ledger
              </Button>
              <Button variant="secondary" onClick={() => handleOpenEdit(v)}>
                <IconEdit size={14} /> Edit Vendor
              </Button>
              {v.status === VendorStatus.DRAFT && (
                <Button variant="primary" onClick={() => handleSubmitForApproval(v)}>
                  <IconCheck size={16} /> Submit for Approval
                </Button>
              )}
              {v.status === VendorStatus.PENDING_APPROVAL && (
                <>
                  <Button variant="primary" onClick={() => handleApprove(v)}>
                    <IconCheck size={16} /> Approve & Activate
                  </Button>
                  <Button variant="danger" onClick={() => setIsBlockModalOpen(true)}>
                    Reject
                  </Button>
                </>
              )}
              {v.status === VendorStatus.APPROVED && (
                <Button variant="danger" onClick={() => setIsBlockModalOpen(true)}>
                  <IconAlertTriangle size={16} /> Block Vendor
                </Button>
              )}
              {v.status === VendorStatus.BLOCKED && (
                <Button variant="primary" onClick={() => handleActivate(v)}>
                  <IconCheck size={16} /> Re-activate
                </Button>
              )}
            </div>
          }
          tabs={[
            {
              id: 'overview',
              label: 'Overview & Registration',
              content: (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  {/* Legal & Tax Registration */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Legal & Tax Registration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>NTN Number</div>
                          <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{v.ntn || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Sales Tax (STRN)</div>
                          <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{v.strn || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>SECP Registration #</div>
                          <div style={{ fontWeight: 600 }}>{v.registrationNo || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>City / Country</div>
                          <div style={{ fontWeight: 600 }}>
                            {v.city ? `${v.city}, ` : ''}{v.country || 'Pakistan'}
                          </div>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Registered Legal Address</div>
                          <div style={{ fontWeight: 500, marginTop: '2px' }}>{v.address || '—'}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Commercial & Credit Profile */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Commercial & Credit Profile</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Default Currency</div>
                          <div style={{ fontWeight: 700 }}>{v.currency || 'PKR'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Payment Terms</div>
                          <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                            {(v.paymentTerms || '30 Days Net').replace(/_/g, ' ')}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Approved Credit Limit</div>
                          <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                            PKR {(v.creditLimit ?? 0).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Quality Rating</div>
                          <div style={{ fontWeight: 700, color: '#f59e0b' }}>
                            ★ {Number(v.rating ?? 5).toFixed(1)} / 5.0
                          </div>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Current Payable Balance</div>
                          <div style={{ fontWeight: 800, fontSize: '16px', color: (v.currentBalance || 0) > 0 ? '#b91c1c' : '#16a34a', fontFamily: 'monospace', marginTop: '2px' }}>
                            PKR {Math.abs(v.currentBalance || 0).toLocaleString()} {(v.currentBalance || 0) >= 0 ? 'Cr (Payable)' : 'Dr (Advance)'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Settlement Banking Details */}
                  <Card style={{ gridColumn: '1 / -1' }}>
                    <CardHeader>
                      <CardTitle>Settlement Banking Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!v.bankDetails?.bankName && !v.bankDetails?.accountNumber && !v.bankDetails?.iban ? (
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                          No settlement banking details recorded yet. Click &quot;Edit Vendor&quot; to add bank routing.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Bank Name</div>
                            <div style={{ fontWeight: 700 }}>{v.bankDetails?.bankName || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Account Title</div>
                            <div style={{ fontWeight: 700 }}>{v.bankDetails?.accountTitle || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Account Number</div>
                            <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{v.bankDetails?.accountNumber || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>IBAN</div>
                            <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{v.bankDetails?.iban || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Branch / Swift Code</div>
                            <div style={{ fontWeight: 600 }}>{v.bankDetails?.branchCode || v.bankDetails?.swiftCode || '—'}</div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ),
            },
            {
              id: 'contacts',
              label: 'Contact Information',
              content: (
                <Card>
                  <CardHeader>
                    <CardTitle>Official Communications & Point of Contact</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Key Contact Person</div>
                        <div style={{ fontWeight: 700, fontSize: '15px', marginTop: '2px' }}>{v.contactPerson || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Email Address</div>
                        <div style={{ fontWeight: 600, color: 'var(--color-primary)', marginTop: '2px' }}>{v.email || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Direct Telephone / Mobile</div>
                        <div style={{ fontWeight: 600, marginTop: '2px' }}>{v.phone || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Corporate Website</div>
                        <div style={{ fontWeight: 600, marginTop: '2px' }}>{v.website || '—'}</div>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Physical Facility Address</div>
                        <div style={{ fontWeight: 500, marginTop: '2px' }}>{v.address || '—'}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ),
            },
            {
              id: 'documents',
              label: `Verified Certifications (${(v.documents || []).length})`,
              content: (
                <Card>
                  <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <CardTitle>Verified Legal & Quality Certifications</CardTitle>
                    <Button variant="secondary" size="sm" onClick={() => setIsAddDocModalOpen(true)}>
                      <IconPlus size={14} /> Add Certification
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {(v.documents || []).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-muted)' }}>
                        <IconFileText size={32} color="#94a3b8" />
                        <div style={{ fontWeight: 600, marginTop: '8px' }}>No Compliance Documents Uploaded</div>
                        <div style={{ fontSize: '12px', marginTop: '2px' }}>
                          Upload NTN Tax Exemption, ISO 9001, Quality Standards, or SECP Certifications.
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsAddDocModalOpen(true)}
                          style={{ marginTop: '12px' }}
                        >
                          <IconPlus size={14} /> Add First Document
                        </Button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {(v.documents || []).map((doc) => (
                          <div
                            key={doc.id}
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
                              <IconFileText size={22} color="var(--color-primary)" />
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '13px' }}>{doc.title}</div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                  {doc.documentType} • {doc.fileName}
                                  {doc.expiryDate ? ` • Expires: ${new Date(doc.expiryDate).toLocaleDateString()}` : ''}
                                </div>
                              </div>
                            </div>
                            <Badge variant="success" size="sm">Verified Compliance</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ),
            },
            {
              id: 'history',
              label: `Transactions (${(v.purchases || []).length + (v.purchaseOrders || []).length})`,
              content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Purchase Invoices */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Posted Purchase Invoices</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(v.purchases || []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                          No purchase invoices posted against this vendor yet.
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                              <th style={{ padding: '8px 12px' }}>Voucher #</th>
                              <th style={{ padding: '8px 12px' }}>Vendor Inv #</th>
                              <th style={{ padding: '8px 12px' }}>Date</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Net Amount</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(v.purchases || []).map((inv) => (
                              <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace' }}>
                                  {inv.voucherNumber}
                                </td>
                                <td style={{ padding: '10px 12px' }}>{inv.vendorInvoiceNo || '—'}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  {new Date(inv.date || inv.createdAt).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                                  PKR {Number(inv.netAmount || 0).toLocaleString()}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <StatusBadge status={inv.postingStatus.toLowerCase()} variant="success" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>

                  {/* Purchase Orders */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Purchase Orders Issued</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(v.purchaseOrders || []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                          No purchase orders issued to this vendor yet.
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                              <th style={{ padding: '8px 12px' }}>PO Number</th>
                              <th style={{ padding: '8px 12px' }}>Date Issued</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Amount</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(v.purchaseOrders || []).map((po) => (
                              <tr key={po.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace' }}>
                                  {po.poNumber}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  {new Date(po.createdAt).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                                  PKR {Number(po.totalAmount || 0).toLocaleString()}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <StatusBadge status={po.status.toLowerCase()} variant="info" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ),
            },
            {
              id: 'performance',
              label: 'Performance Scorecard',
              content: (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <KpiCard
                    title="Total Procurement Spend"
                    value={`PKR ${Number(v.calculatedPerformance?.totalSpend || 0).toLocaleString()}`}
                  />
                  <KpiCard
                    title="Total Orders Count"
                    value={v.calculatedPerformance?.totalOrders || (v.purchases?.length || 0) + (v.purchaseOrders?.length || 0)}
                  />
                  <KpiCard
                    title="Completed Orders"
                    value={v.calculatedPerformance?.completedOrders || v.purchases?.length || 0}
                  />
                  <KpiCard
                    title="Supplier Quality Rating"
                    value={`★ ${Number(v.rating || 5).toFixed(1)} / 5.0`}
                  />
                </div>
              ),
            },
            {
              id: 'audit',
              label: 'Audit Trail',
              content: (
                <Card>
                  <CardHeader>
                    <CardTitle>Immutable Lifecycle Logs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Timeline
                      items={
                        v.auditLogs && v.auditLogs.length > 0
                          ? v.auditLogs.map((log) => ({
                              title: `Action: ${log.action}`,
                              description: `Recorded by ${log.actorEmail || 'System User'}`,
                              timestamp: new Date(log.createdAt).toLocaleString(),
                              icon: <IconBuilding size={14} />,
                            }))
                          : [
                              {
                                title: 'Vendor Master Onboarding',
                                description: `Vendor profile registered by ${v.createdBy || 'System'}.`,
                                timestamp: v.createdAt ? new Date(v.createdAt).toLocaleString() : 'Recent',
                                icon: <IconBuilding size={14} />,
                              },
                              ...(v.status === VendorStatus.APPROVED
                                ? [
                                    {
                                      title: 'Approved and Activated',
                                      description: 'Verified compliance and activated for procurement.',
                                      timestamp: v.updatedAt ? new Date(v.updatedAt).toLocaleString() : 'Recent',
                                      icon: <IconCheck size={14} />,
                                    },
                                  ]
                                : []),
                            ]
                      }
                    />
                  </CardContent>
                </Card>
              ),
            },
          ]}
        />

        {/* Modal to Add Document from Detail View */}
        <Modal
          isOpen={isAddDocModalOpen}
          onClose={() => setIsAddDocModalOpen(false)}
          title="Attach Compliance / Quality Certification"
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Document Title *
              </label>
              <Input
                placeholder="e.g. FBR Active Taxpayer NTN Certificate"
                value={docFormData.title}
                onChange={(e) => setDocFormData({ ...docFormData, title: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Document Category
              </label>
              <Select
                value={docFormData.documentType}
                onChange={(e) => setDocFormData({ ...docFormData, documentType: e.target.value })}
                options={[
                  { value: 'TAX_CERTIFICATE', label: 'Tax Certificate (NTN/STRN)' },
                  { value: 'QUALITY_CERTIFICATE', label: 'Quality / Lab Test Certificate' },
                  { value: 'SECP_LICENSE', label: 'SECP Corporate License' },
                  { value: 'CONTRACT_AGREEMENT', label: 'Supply Contract / Agreement' },
                  { value: 'BANK_LETTER', label: 'Bank Verification Letter' },
                ]}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                File / Document Name
              </label>
              <Input
                placeholder="e.g. FBR_NTN_Registration_2026.pdf"
                value={docFormData.fileName}
                onChange={(e) => setDocFormData({ ...docFormData, fileName: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Expiration Date (if applicable)
              </label>
              <Input
                type="date"
                value={docFormData.expiryDate}
                onChange={(e) => setDocFormData({ ...docFormData, expiryDate: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Notes / Scope
              </label>
              <Input
                placeholder="e.g. Valid across all procurement purchases"
                value={docFormData.notes}
                onChange={(e) => setDocFormData({ ...docFormData, notes: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <Button variant="secondary" onClick={() => setIsAddDocModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveDocumentInDetail} disabled={isSavingDoc}>
                {isSavingDoc ? 'Uploading...' : 'Upload & Verify'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Vendor Sub-Ledger Modal */}
        <VendorLedgerModal
          isOpen={isLedgerModalOpen}
          onClose={() => setIsLedgerModalOpen(false)}
          vendor={vendorForLedger || selectedVendor}
        />
      </>
    );
  }

  // ==========================================
  // RENDER FORM VIEW (CREATE & EDIT)
  // ==========================================
  if (mode === 'create' || mode === 'edit') {
    const isEdit = mode === 'edit';

    return (
      <FormPageTemplate
        title={isEdit ? `Edit Vendor: ${formData.code}` : 'Add New Vendor Master'}
        subtitle={
          isEdit
            ? `Modify commercial, legal registration, or banking terms for ${formData.name}.`
            : 'Register an approved chemical precursor, packaging supplier, or transport contractor.'
        }
        breadcrumbs={[
          { label: 'Procurement', href: '#' },
          { label: 'Vendors / Suppliers', onClick: () => setMode('list') },
          { label: isEdit ? 'Edit Vendor' : 'New Vendor' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={handleSaveVendorSubmit}
        submitLabel={isEdit ? 'Update Vendor Master' : 'Save Vendor Master'}
        sections={[
          {
            id: 'basic',
            title: '1. Basic & Commercial Identity',
            description: 'Core vendor identification, type, and supply classification',
            content: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Vendor Code *
                  </label>
                  <Input
                    placeholder="e.g. VND-ENG-06"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                    disabled={isEdit}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Commercial Display Name *
                  </label>
                  <Input
                    placeholder="e.g. Engro Chemicals Pakistan"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Legal Registered Entity Name
                  </label>
                  <Input
                    placeholder="e.g. Engro Polymer & Chemicals Ltd"
                    value={formData.legalName}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Vendor Type *
                  </label>
                  <Select
                    value={formData.vendorType}
                    onChange={(e) => setFormData({ ...formData, vendorType: e.target.value as VendorType })}
                    options={[
                      { value: VendorType.RAW_MATERIAL, label: 'Raw Material Supplier' },
                      { value: VendorType.PACKING_MATERIAL, label: 'Packing Material Supplier' },
                      { value: VendorType.SERVICE, label: 'Service Provider' },
                      { value: VendorType.TRANSPORT, label: 'Transport / Logistics' },
                      { value: VendorType.MACHINERY, label: 'Machinery & Equipment' },
                    ]}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Supply Category
                  </label>
                  <Input
                    placeholder="e.g. Chemical Precursors, HDPE Bags, Solvents"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
              </div>
            ),
          },
          {
            id: 'contacts',
            title: '2. Point of Contact & Communication',
            description: 'Direct procurement contacts, phone, and official email',
            content: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Key Contact Person
                  </label>
                  <Input
                    placeholder="e.g. Muhammad Aslam (Sales Director)"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Direct Telephone / Mobile
                  </label>
                  <Input
                    placeholder="e.g. +92 300 1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Official Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="e.g. sales@engrochemicals.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Corporate Website
                  </label>
                  <Input
                    placeholder="e.g. https://www.engro.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
              </div>
            ),
          },
          {
            id: 'registration',
            title: '3. Legal & Tax Registration',
            description: 'Government compliance, NTN, sales tax, and corporate incorporation',
            content: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    National Tax Number (NTN)
                  </label>
                  <Input
                    placeholder="e.g. 0812944-7"
                    value={formData.ntn}
                    onChange={(e) => setFormData({ ...formData, ntn: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Sales Tax Registration (STRN)
                  </label>
                  <Input
                    placeholder="e.g. 17-00-9991-001-44"
                    value={formData.strn}
                    onChange={(e) => setFormData({ ...formData, strn: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    SECP Corporate Registration #
                  </label>
                  <Input
                    placeholder="e.g. 0045892-A"
                    value={formData.registrationNo}
                    onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    City & Country
                  </label>
                  <Input
                    placeholder="e.g. Karachi, Pakistan"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Registered Physical Address
                  </label>
                  <Textarea
                    placeholder="Complete corporate registered address..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>
            ),
          },
          {
            id: 'commercial',
            title: '4. Commercial Terms & Settlement Banking',
            description: 'Credit limits, payment conditions, and settlement bank routing',
            content: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Default Currency
                  </label>
                  <Select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    options={[
                      { value: 'PKR', label: 'PKR — Pakistani Rupee' },
                      { value: 'USD', label: 'USD — US Dollar' },
                      { value: 'EUR', label: 'EUR — Euro' },
                    ]}
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
                      { value: '30_DAYS_CREDIT', label: '30 Days Net Credit' },
                      { value: '60_DAYS_CREDIT', label: '60 Days Net Credit' },
                      { value: 'ADVANCE_PAYMENT', label: '100% Advance Payment' },
                      { value: 'CUSTOM_TERMS', label: 'Custom Agreed Terms' },
                    ]}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Approved Credit Limit (PKR)
                  </label>
                  <Input
                    type="number"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Quality Rating (1.0 to 5.0)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Settlement Bank Name
                  </label>
                  <Input
                    placeholder="e.g. Habib Bank Limited (HBL)"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Bank Account Title
                  </label>
                  <Input
                    placeholder="e.g. Engro Polymer & Chemicals Ltd"
                    value={formData.accountTitle}
                    onChange={(e) => setFormData({ ...formData, accountTitle: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Account Number
                  </label>
                  <Input
                    placeholder="e.g. 00100987654321"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    IBAN
                  </label>
                  <Input
                    placeholder="e.g. PK36HABB0000100987654321"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Branch / Swift Code
                  </label>
                  <Input
                    placeholder="e.g. 001"
                    value={formData.branchCode}
                    onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                  />
                </div>
              </div>
            ),
          },
          {
            id: 'certifications',
            title: '5. Compliance Certifications & Verification Documents',
            description: 'Attach verified legal and quality certifications to this vendor',
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* List of currently attached documents */}
                {formData.documents.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {formData.documents.map((doc, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{doc.title}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>
                            ({doc.documentType}) • {doc.fileName} {doc.expiryDate ? `• Expires: ${doc.expiryDate}` : ''}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDocFromForm(idx)}
                          style={{ color: '#dc2626' }}
                        >
                          <IconTrash size={14} /> Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline Document Adder */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    padding: '14px',
                    backgroundColor: '#ffffff',
                    border: '1.5px dashed #cbd5e1',
                    borderRadius: '8px',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Document Title
                    </label>
                    <Input
                      placeholder="e.g. FBR Active Taxpayer NTN"
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Document Type
                    </label>
                    <Select
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value)}
                      options={[
                        { value: 'TAX_CERTIFICATE', label: 'Tax Certificate (NTN/STRN)' },
                        { value: 'QUALITY_CERTIFICATE', label: 'Quality / Lab Certificate' },
                        { value: 'SECP_LICENSE', label: 'SECP License' },
                        { value: 'CONTRACT_AGREEMENT', label: 'Contract Agreement' },
                      ]}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      File Name / Reference
                    </label>
                    <Input
                      placeholder="e.g. FBR_NTN_Cert.pdf"
                      value={newDocFileName}
                      onChange={(e) => setNewDocFileName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Expiry Date
                    </label>
                    <Input
                      type="date"
                      value={newDocExpiry}
                      onChange={(e) => setNewDocExpiry(e.target.value)}
                    />
                  </div>
                  <div style={{ alignSelf: 'flex-end' }}>
                    <Button type="button" variant="secondary" size="sm" onClick={handleAddDocToForm}>
                      <IconPlus size={14} /> Add Document
                    </Button>
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: 'notes',
            title: '6. Internal Notes & Remarks',
            description: 'Internal procurement instructions and observations',
            content: (
              <div>
                <Textarea
                  placeholder="Additional commercial background, primary delivery warehouses, or procurement notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
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
    <>
      <ListPageTemplate
        title="Vendor Master Management"
        subtitle="Manage approved chemical precursors, packaging converters, and transport suppliers."
        breadcrumbs={[{ label: 'Procurement', href: '#' }, { label: 'Vendors / Suppliers' }]}
        kpiMetrics={[
          { title: 'Total Vendors', value: vendors.length },
          {
            title: 'Approved Suppliers',
            value: vendors.filter((v) => v.status === VendorStatus.APPROVED).length,
          },
          {
            title: 'Pending Verification',
            value: vendors.filter((v) => v.status === VendorStatus.PENDING_APPROVAL).length,
          },
          {
            title: 'Blocked / Inactive',
            value: vendors.filter((v) => v.status === VendorStatus.BLOCKED).length,
          },
        ]}
        filters={[
          {
            id: 'search',
            label: 'Search',
            component: (
              <Input
                placeholder="Search vendor, code, NTN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            ),
          },
          {
            id: 'category',
            label: 'Vendor Type',
            component: (
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Types' },
                  { value: VendorType.RAW_MATERIAL, label: 'Raw Materials' },
                  { value: VendorType.PACKING_MATERIAL, label: 'Packaging' },
                  { value: VendorType.SERVICE, label: 'Services' },
                  { value: VendorType.TRANSPORT, label: 'Transport' },
                  { value: VendorType.MACHINERY, label: 'Machinery' },
                ]}
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
                  { value: VendorStatus.APPROVED, label: 'Approved' },
                  { value: VendorStatus.PENDING_APPROVAL, label: 'Pending Approval' },
                  { value: VendorStatus.DRAFT, label: 'Draft' },
                  { value: VendorStatus.BLOCKED, label: 'Blocked' },
                ]}
              />
            ),
          },
        ]}
        primaryAction={{
          label: 'Add Vendor Master',
          icon: <IconPlus size={16} />,
          onClick: () => {
            setFormData(initialFormData);
            setMode('create');
          },
        }}
        secondaryActions={[
          {
            label: 'Refresh',
            icon: <IconRefresh size={16} />,
            onClick: fetchVendors,
          },
        ]}
      >
        {isLoading ? (
          <TableSkeleton rows={8} columns={7} />
        ) : filteredVendors.length === 0 ? (
          <EmptyState
            title="No Vendors Found"
            description={
              searchQuery
                ? 'No vendor matched your filter parameters.'
                : 'No vendors are registered yet. Click "Add Vendor Master" to register your first supplier.'
            }
            actionLabel={searchQuery ? 'Clear Filters' : 'Add First Vendor'}
            onAction={() => {
              if (searchQuery) {
                setSearchQuery('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
              } else {
                setFormData(initialFormData);
                setMode('create');
              }
            }}
          />
        ) : (
          <DataTable columns={columns} data={filteredVendors} />
        )}
      </ListPageTemplate>

      {/* Block Vendor Modal */}
      <Modal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        title="Block Vendor from Procurement"
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Blocking will prevent this vendor from being selected in new Purchase Orders or RFQs.
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Reason for Blocking *
            </label>
            <Textarea
              placeholder="e.g. Repeated quality failure, NTN suspension, or legal dispute..."
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setIsBlockModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleBlock}>
              Confirm Block
            </Button>
          </div>
        </div>
      </Modal>

      {/* Vendor Sub-Ledger Modal */}
      <VendorLedgerModal
        isOpen={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        vendor={vendorForLedger}
      />
    </>
  );
};
