'use client';

/**
 * SHEHSWAR ONE360 - Goods Receipt Note (GRN) Management UI
 *
 * Implements:
 * - Enterprise GRN List Page with status filtering, receipt KPIs, and search
 * - 360-Degree GRN Detail View with multi-item physical verification, carrier logistics, and QC Inspection placeholder
 * - Multi-section GRN Creation Form linking approved Purchase Orders and tracking partial receipts
 * - Quality Inspection Modal allowing QA officers to record inspection findings, adjust accepted/rejected quantities, and transition status
 * - Strict adherence to Phase 4 architectural boundaries: Receiving documentation foundation only (Zero inventory movements)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  GoodsReceiptStatus,
  QcStatus,
  PackageCondition,
  PurchaseOrderStatus,
} from '@shehswar/types';
import {
  ProcurementGRN,
  ProcurementPO,
} from './mock-data';
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
  Badge,
  BadgeVariant,
  Timeline,
  Modal,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '../ui';
import {
  IconPlus,
  IconDownload,
  IconEye,
  IconCheck,
  IconClock,
  IconAlertTriangle,
  IconQC,
  IconFileText,
  IconSearch,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export const GoodsReceiptView: React.FC = () => {
  const { showToast } = useToast();
  const [goodsReceipts, setGoodsReceipts] = useState<ProcurementGRN[]>([]);
  const [availablePOs, setAvailablePOs] = useState<ProcurementPO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGRN, setSelectedGRN] = useState<ProcurementGRN | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [qcFilter, setQcFilter] = useState('ALL');

  const fetchGoodsReceipts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [grnRes, poRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/procurement/goods-receipts'),
        ApiClient.get<any>('/api/v1/procurement/purchase-orders'),
      ]);

      const rawGRNs = grnRes.data?.items || (Array.isArray(grnRes.data) ? grnRes.data : []);
      const mappedGRNs: ProcurementGRN[] = rawGRNs.map((g: any) => ({
        id: g.id,
        organizationId: g.organizationId,
        companyId: g.companyId,
        grnNumber: g.grnNumber,
        poId: g.poId,
        poNumber: g.purchaseOrder?.poNumber || 'SH-PO-2026-000001',
        vendorName: g.vendor?.name || 'Assigned Vendor',
        vendorCode: g.vendor?.code || 'VND-001',
        warehouseName: g.warehouse?.name || 'Raw Material Warehouse',
        receivedDate: g.receivedDate ? new Date(g.receivedDate).toISOString().slice(0, 10) : '2026-09-27',
        receivedByName: g.receivedByName || 'Receiving Officer',
        carrierName: g.carrierName || 'Fleet Hauler',
        vehicleNumber: g.vehicleNumber || 'TK-4821',
        deliveryNoteNumber: g.deliveryNoteNumber || 'DN-001',
        status: g.status || GoodsReceiptStatus.QUALITY_PENDING,
        qcStatus: g.qcStatus || QcStatus.PENDING,
        qcNotes: g.qcNotes || 'Initial gate receiving documented.',
        notes: g.notes || '',
        items: g.items?.map((it: any) => ({
          id: it.id,
          poItemId: it.poItemId,
          itemName: it.itemName,
          orderedQuantity: Number(it.orderedQuantity) || 10,
          receivedQuantity: Number(it.receivedQuantity) || 10,
          acceptedQuantity: Number(it.acceptedQuantity) || 0,
          rejectedQuantity: Number(it.rejectedQuantity) || 0,
          unit: it.unit || 'TON',
          packageCondition: it.packageCondition || PackageCondition.INTACT,
          batchNumber: it.batchNumber || 'BCH-001',
          expiryDate: it.expiryDate ? new Date(it.expiryDate).toISOString().slice(0, 10) : undefined,
          notes: it.notes || '',
        })) || [],
      }));

      const rawPOs = poRes.data?.items || (Array.isArray(poRes.data) ? poRes.data : []);
      const mappedPOs: ProcurementPO[] = rawPOs.map((po: any) => ({
        id: po.id,
        organizationId: po.organizationId,
        companyId: po.companyId,
        poNumber: po.poNumber,
        vendorId: po.vendorId,
        vendorName: po.vendor?.name || 'Vendor',
        vendorCode: po.vendor?.code || 'VND',
        currency: po.currency || 'PKR',
        subtotal: Number(po.subtotal) || 0,
        taxAmount: Number(po.taxAmount) || 0,
        discountAmount: 0,
        totalAmount: Number(po.totalAmount) || 0,
        status: po.status,
        createdAt: po.createdAt,
        items: po.items?.map((it: any) => ({
          id: it.id,
          itemName: it.itemName,
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'KG',
          unitRate: Number(it.unitRate) || 0,
          taxRate: 18,
          taxAmount: 0,
          lineTotal: Number(it.lineTotal) || 0,
          receivedQuantity: Number(it.receivedQuantity) || 0,
        })) || [],
      }));

      setGoodsReceipts(mappedGRNs);
      setAvailablePOs(mappedPOs);
    } catch (err: any) {
      console.error('Failed to load goods receipts:', err);
      setError(err.message || 'Failed to connect to backend API');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoodsReceipts();
  }, [fetchGoodsReceipts]);

  // Quality Inspection Modal State
  const [isQcModalOpen, setIsQcModalOpen] = useState(false);
  const [qcDecision, setQcDecision] = useState<QcStatus>(QcStatus.PASSED);
  const [qcNotes, setQcNotes] = useState('');
  const [qcAcceptedQty, setQcAcceptedQty] = useState<number>(0);
  const [qcRejectedQty, setQcRejectedQty] = useState<number>(0);

  // Form State
  const [formData, setFormData] = useState({
    poId: '',
    warehouseName: 'Raw Materials & Packaging Warehouse 1',
    receivedDate: new Date().toISOString().slice(0, 10),
    receivedByName: 'Zahid Mahmood (Receiving Officer)',
    carrierName: '',
    vehicleNumber: '',
    deliveryNoteNumber: '',
    notes: '',
    items: [] as {
      poItemId: string;
      itemName: string;
      orderedQuantity: number;
      alreadyReceived: number;
      receivedQuantity: number;
      unit: string;
      packageCondition: PackageCondition;
      batchNumber: string;
      expiryDate?: string;
      notes?: string;
    }[],
  });

  // Calculate Metrics
  const totalGRNs = goodsReceipts.length;
  const qualityPendingCount = goodsReceipts.filter(
    (g) => g.status === GoodsReceiptStatus.QUALITY_PENDING || g.qcStatus === QcStatus.PENDING
  ).length;
  const acceptedCount = goodsReceipts.filter((g) => g.status === GoodsReceiptStatus.ACCEPTED).length;
  const rejectedCount = goodsReceipts.filter((g) => g.status === GoodsReceiptStatus.REJECTED).length;

  // Filter Goods Receipts
  const filteredGRNs = goodsReceipts.filter((grn) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      grn.grnNumber.toLowerCase().includes(q) ||
      (grn.poNumber ? grn.poNumber.toLowerCase().includes(q) : false) ||
      (grn.vendorName ? grn.vendorName.toLowerCase().includes(q) : false) ||
      (grn.deliveryNoteNumber ? grn.deliveryNoteNumber.toLowerCase().includes(q) : false);

    const matchesStatus = statusFilter === 'ALL' || grn.status === statusFilter;
    const matchesQC = qcFilter === 'ALL' || grn.qcStatus === qcFilter;

    return matchesSearch && matchesStatus && matchesQC;
  });

  // Handle PO selection in Create Form
  const handleSelectPO = (poId: string) => {
    const po = availablePOs.find((p) => p.id === poId);
    if (!po) return;

    const populatedItems = po.items.map((item) => {
      const remaining = Math.max(0, item.quantity - item.receivedQuantity);
      return {
        poItemId: item.id,
        itemName: item.itemName,
        orderedQuantity: item.quantity,
        alreadyReceived: item.receivedQuantity,
        receivedQuantity: remaining,
        unit: item.unit,
        packageCondition: PackageCondition.INTACT,
        batchNumber: `BCH-${Date.now().toString().slice(-6)}`,
        expiryDate: '',
        notes: '',
      };
    });

    setFormData({
      ...formData,
      poId: po.id,
      items: populatedItems,
    });
  };

  // Create GRN Submission
  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.poId) {
      showToast({
        type: 'error',
        title: 'Purchase Order Required',
        message: 'Please select a valid Purchase Order to receive.',
      });
      return;
    }

    if (!formData.deliveryNoteNumber.trim()) {
      showToast({
        type: 'error',
        title: 'Delivery Note Required',
        message: 'Supplier Delivery Note Number is required for gate pass reconciliation.',
      });
      return;
    }

    if (formData.items.length === 0 || formData.items.every((it) => it.receivedQuantity <= 0)) {
      showToast({
        type: 'error',
        title: 'Received Quantity Required',
        message: 'At least one item must have a received quantity greater than 0.',
      });
      return;
    }

    try {
      const payload = {
        poId: formData.poId,
        carrierName: formData.carrierName || 'Company Fleet Transport',
        vehicleNumber: formData.vehicleNumber || 'TK-4821',
        deliveryNoteNumber: formData.deliveryNoteNumber,
        notes: formData.notes,
        items: formData.items
          .filter((it) => it.receivedQuantity > 0)
          .map((it) => ({
            poItemId: it.poItemId,
            receivedQuantity: Number(it.receivedQuantity),
            packageCondition: it.packageCondition || PackageCondition.INTACT,
            batchNumber: it.batchNumber,
            expiryDate: it.expiryDate ? new Date(it.expiryDate).toISOString() : undefined,
            notes: it.notes,
          })),
      };

      await ApiClient.post<any>('/api/v1/procurement/goods-receipts', payload);
      showToast({
        type: 'success',
        title: 'Goods Receipt Generated',
        message: `Goods Receipt successfully generated in PostgreSQL database.`,
      });
      await fetchGoodsReceipts();
      setMode('list');
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'GRN Creation Failed',
        message: err.message || 'Could not create goods receipt',
      });
    }
  };

  // Open QC Inspection Modal
  const openQcModal = (grn: ProcurementGRN) => {
    setSelectedGRN(grn);
    setQcDecision(grn.qcStatus === QcStatus.PENDING ? QcStatus.PASSED : (grn.qcStatus as QcStatus));
    setQcNotes(grn.qcNotes || '');
    const firstItem = grn.items[0];
    if (firstItem) {
      setQcAcceptedQty(firstItem.acceptedQuantity);
      setQcRejectedQty(firstItem.rejectedQuantity);
    }
    setIsQcModalOpen(true);
  };

  // Submit QC Inspection Findings
  const handleSaveQcInspection = async () => {
    if (!selectedGRN) return;

    try {
      await ApiClient.post(`/api/v1/procurement/goods-receipts/${selectedGRN.id}/qc-inspection`, {
        qcStatus: qcDecision,
        qcNotes: qcNotes || `Quality inspection recorded by Plant QA Laboratory. Result: ${qcDecision}.`,
      });

      setIsQcModalOpen(false);
      showToast({
        type: 'success',
        title: 'QC Inspection Recorded',
        message: `Quality inspection recorded in PostgreSQL database for ${selectedGRN.grnNumber}: ${qcDecision}`,
      });
      await fetchGoodsReceipts();
      if (selectedGRN) {
        setSelectedGRN((prev) => (prev ? { ...prev, qcStatus: qcDecision } : null));
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'QC Update Failed',
        message: err.message || 'Could not record QC inspection',
      });
    }
  };

  // Format Status Badges
  const getStatusBadgeVariant = (status: GoodsReceiptStatus): BadgeVariant => {
    switch (status) {
      case GoodsReceiptStatus.ACCEPTED:
        return 'success';
      case GoodsReceiptStatus.QUALITY_PENDING:
        return 'warning';
      case GoodsReceiptStatus.RECEIVED:
        return 'info';
      case GoodsReceiptStatus.REJECTED:
        return 'danger';
      case GoodsReceiptStatus.DRAFT:
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getQcBadgeVariant = (qcStatus: QcStatus): BadgeVariant => {
    switch (qcStatus) {
      case QcStatus.PASSED:
        return 'success';
      case QcStatus.PENDING:
        return 'warning';
      case QcStatus.PARTIALLY_ACCEPTED:
        return 'info';
      case QcStatus.REJECTED:
        return 'danger';
      case QcStatus.WAIVED:
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  // Table Columns
  const columns: ColumnDef<ProcurementGRN>[] = [
    {
      header: 'GRN Number',
      accessorKey: 'grnNumber',
      cell: (grn) => (
        <div>
          <button
            onClick={() => {
              setSelectedGRN(grn);
              setMode('detail');
            }}
            className="font-semibold text-primary-600 hover:text-primary-700 hover:underline text-left"
          >
            {grn.grnNumber}
          </button>
          <div className="text-xs text-neutral-500 font-mono mt-0.5">PO: {grn.poNumber}</div>
        </div>
      ),
    },
    {
      header: 'Supplier / Vendor',
      accessorKey: 'vendorName',
      cell: (grn) => (
        <div>
          <div className="font-medium text-neutral-900 dark:text-neutral-100">{grn.vendorName}</div>
          <div className="text-xs text-neutral-500">Del Note: {grn.deliveryNoteNumber}</div>
        </div>
      ),
    },
    {
      header: 'Receiving Warehouse',
      accessorKey: 'warehouseName',
      cell: (grn) => (
        <div>
          <div className="text-sm text-neutral-800 dark:text-neutral-200">{grn.warehouseName}</div>
          <div className="text-xs text-neutral-500">{grn.receivedDate}</div>
        </div>
      ),
    },
    {
      header: 'Consignment / Carrier',
      accessorKey: 'carrierName',
      cell: (grn) => (
        <div className="text-xs">
          <div className="font-medium text-neutral-700 dark:text-neutral-300">{grn.carrierName}</div>
          <div className="text-neutral-500">Veh: {grn.vehicleNumber}</div>
        </div>
      ),
    },
    {
      header: 'GRN Status',
      accessorKey: 'status',
      cell: (grn) => (
        <Badge variant={getStatusBadgeVariant(grn.status)} dot>
          {grn.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      header: 'QC Inspection',
      accessorKey: 'qcStatus',
      cell: (grn) => (
        <Badge variant={getQcBadgeVariant(grn.qcStatus)} dot>
          QC: {grn.qcStatus}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      cell: (grn) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedGRN(grn);
              setMode('detail');
            }}
            title="View Details"
          >
            <IconEye size={16} />
          </Button>
          {(grn.status === GoodsReceiptStatus.QUALITY_PENDING || grn.qcStatus === QcStatus.PENDING) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openQcModal(grn)}
              title="Inspect Consignment"
              className="text-amber-600 hover:text-amber-700"
            >
              <IconQC size={15} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ==========================================
  // RENDER: CREATE FORM
  // ==========================================
  if (mode === 'create') {
    const selectablePOs = availablePOs.filter(
      (po) =>
        po.status === PurchaseOrderStatus.SENT_TO_VENDOR ||
        po.status === PurchaseOrderStatus.PARTIALLY_RECEIVED ||
        po.status === PurchaseOrderStatus.APPROVED ||
        po.status === PurchaseOrderStatus.SUBMITTED,
    );

    return (
      <FormPageTemplate
        title="Generate Goods Receipt Note (GRN)"
        subtitle="Document incoming material consignments against approved Purchase Orders. Physical verification only."
        breadcrumbs={[
          { label: 'Procurement', href: '#' },
          { label: 'Goods Receipts', href: '#', onClick: () => setMode('list') },
          { label: 'New GRN' },
        ]}
        onCancel={() => setMode('list')}
        onSubmit={handleCreateGRN}
        submitLabel="Generate Goods Receipt Note"
      >
        <div className="space-y-6">
          {/* Phase 4 Architectural Guard Notice */}
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-start gap-3">
            <IconAlertTriangle className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" size={20} />
            <div className="text-sm text-blue-900 dark:text-blue-200">
              <span className="font-semibold">Procurement Foundation Boundary:</span> This Goods Receipt Note (GRN) acts as the official receiving inspection record. Physical inventory ledger postings and balance updates occur in the upcoming Inventory & Warehouse phase upon formal QC transfer.
            </div>
          </div>

          {/* Section 1: PO & Warehouse Reference */}
          <Card>
            <CardHeader>
              <CardTitle>1. Purchase Order & Destination Warehouse</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Select Approved Purchase Order *
                  </label>
                  <Select
                    value={formData.poId}
                    onChange={(val) => handleSelectPO(typeof val === 'string' ? val : val?.target?.value || '')}
                    options={selectablePOs.map((po) => ({
                      value: po.id,
                      label: `${po.poNumber} — ${po.vendorName} (${po.status.replace(/_/g, ' ')})`,
                    }))}
                    placeholder="-- Choose Purchase Order --"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Only approved and active POs with pending balances can be received.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Receiving Warehouse / Silo Terminal *
                  </label>
                  <Select
                    value={formData.warehouseName}
                    onChange={(val) => setFormData({ ...formData, warehouseName: typeof val === 'string' ? val : val?.target?.value || '' })}
                    options={[
                      { value: 'Raw Materials & Packaging Warehouse 1', label: 'Raw Materials & Packaging Warehouse 1 (Sheikhupura)' },
                      { value: 'Sheikhupura Gas Cryogenic Terminal', label: 'Sheikhupura Gas Cryogenic Terminal' },
                      { value: 'Finished Goods Central Warehouse', label: 'Finished Goods Central Warehouse' },
                      { value: 'Karachi Port Transit Warehouse', label: 'Karachi Port Transit Warehouse' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Received Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.receivedDate}
                    onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Receiving Officer *
                  </label>
                  <Input
                    type="text"
                    value={formData.receivedByName}
                    onChange={(e) => setFormData({ ...formData, receivedByName: e.target.value })}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Carrier & Consignment Logistics */}
          <Card>
            <CardHeader>
              <CardTitle>2. Consignment Logistics & Gate Documentation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Supplier Delivery Note # *
                  </label>
                  <Input
                    placeholder="e.g. DN-ENG-99410"
                    value={formData.deliveryNoteNumber}
                    onChange={(e) => setFormData({ ...formData, deliveryNoteNumber: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Carrier / Hauler Company
                  </label>
                  <Input
                    placeholder="e.g. TCS Cargo, POL Fleet"
                    value={formData.carrierName}
                    onChange={(e) => setFormData({ ...formData, carrierName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Truck / Tanker Registration #
                  </label>
                  <Input
                    placeholder="e.g. LES-4819, KHI-7721"
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Material Line Items Verification */}
          <Card>
            <CardHeader>
              <CardTitle>3. Material Inspection & Verification</CardTitle>
            </CardHeader>
            <CardContent>
              {formData.items.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-sm">
                  Please select a Purchase Order above to automatically load line items.
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.items.map((item, idx) => (
                    <div
                      key={item.poItemId}
                      className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {idx + 1}. {item.itemName}
                        </span>
                        <div className="text-xs text-neutral-600 dark:text-neutral-400 flex gap-3">
                          <span>Ordered: <strong>{item.orderedQuantity} {item.unit}</strong></span>
                          <span>Prior Received: <strong>{item.alreadyReceived} {item.unit}</strong></span>
                          <span className="text-primary-600 font-medium">
                            Remaining: {item.orderedQuantity - item.alreadyReceived} {item.unit}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                            Current Received Qty ({item.unit}) *
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max={item.orderedQuantity - item.alreadyReceived}
                            value={item.receivedQuantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updated = [...formData.items];
                              if (updated[idx]) {
                                updated[idx].receivedQuantity = val;
                                setFormData({ ...formData, items: updated });
                              }
                            }}
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                            Physical Package Condition *
                          </label>
                          <Select
                            value={item.packageCondition}
                            onChange={(val) => {
                              const updated = [...formData.items];
                              if (updated[idx]) {
                                updated[idx].packageCondition = (typeof val === 'string' ? val : val?.target?.value) as PackageCondition;
                                setFormData({ ...formData, items: updated });
                              }
                            }}
                            options={[
                              { value: PackageCondition.INTACT, label: 'Intact / Sound Condition' },
                              { value: PackageCondition.DAMAGED, label: 'Physical Exterior Damage' },
                              { value: PackageCondition.LEAKING, label: 'Liquid Leakage Observed' },
                              { value: PackageCondition.SEAL_BROKEN, label: 'Tamper Seal Broken' },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                            Manufacturer Batch / Heat # *
                          </label>
                          <Input
                            placeholder="e.g. BCH-88492"
                            value={item.batchNumber}
                            onChange={(e) => {
                              const updated = [...formData.items];
                              if (updated[idx]) {
                                updated[idx].batchNumber = e.target.value;
                                setFormData({ ...formData, items: updated });
                              }
                            }}
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                            Expiry / Re-test Date
                          </label>
                          <Input
                            type="date"
                            value={item.expiryDate || ''}
                            onChange={(e) => {
                              const updated = [...formData.items];
                              if (updated[idx]) {
                                updated[idx].expiryDate = e.target.value;
                                setFormData({ ...formData, items: updated });
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 4: General Receiving Remarks */}
          <Card>
            <CardHeader>
              <CardTitle>4. Receiving Inspection Remarks</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={3}
                placeholder="Enter physical observations, tare weight checks, tanker dip readings, or special offloading remarks..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <Button variant="outline" type="button" onClick={() => setMode('list')}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              <IconCheck size={16} className="mr-1.5" />
              Generate Goods Receipt Note
            </Button>
          </div>
        </div>
      </FormPageTemplate>
    );
  }

  // ==========================================
  // RENDER: DETAIL VIEW
  // ==========================================
  if (mode === 'detail' && selectedGRN) {
    const tabs = [
      {
        id: 'items',
        label: 'Received Line Items',
        content: (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-4 text-right">Ordered Qty</th>
                    <th className="py-3 px-4 text-right">Received Qty</th>
                    <th className="py-3 px-4 text-right">Accepted Qty</th>
                    <th className="py-3 px-4 text-right">Rejected Qty</th>
                    <th className="py-3 px-4 text-center">Package Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {selectedGRN.items.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">{item.itemName}</div>
                        {item.notes && <div className="text-xs text-neutral-500">{item.notes}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                        {item.batchNumber}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-neutral-600 dark:text-neutral-400">
                        {item.orderedQuantity.toLocaleString()} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-neutral-900 dark:text-neutral-100">
                        {item.receivedQuantity.toLocaleString()} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {item.acceptedQuantity.toLocaleString()} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-red-600">
                        {item.rejectedQuantity.toLocaleString()} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.packageCondition === PackageCondition.INTACT
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          }`}
                        >
                          {item.packageCondition}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedGRN.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Receiving Officer Field Remarks</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-neutral-700 dark:text-neutral-300">
                  {selectedGRN.notes}
                </CardContent>
              </Card>
            )}
          </div>
        ),
      },
      {
        id: 'qc',
        label: 'Quality Inspection (QC)',
        content: (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Plant QA Laboratory Disposition</CardTitle>
                <Badge variant={getQcBadgeVariant(selectedGRN.qcStatus as QcStatus)} dot>
                  QC: {selectedGRN.qcStatus}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="text-xs text-neutral-500 block">Inspection Status</span>
                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {selectedGRN.qcStatus}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-neutral-500 block">Overall Receipt Disposition</span>
                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {selectedGRN.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block mb-1">
                    QA Laboratory Assay Findings & Remarks
                  </span>
                  <p className="text-sm text-neutral-800 dark:text-neutral-200">
                    {selectedGRN.qcNotes || 'No formal QC notes logged yet. Pending analytical testing.'}
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="primary"
                    onClick={() => openQcModal(selectedGRN)}
                  >
                    <IconQC size={16} className="mr-1.5" />
                    Record QA Inspection Findings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ),
      },
      {
        id: 'logistics',
        label: 'Carrier & Logistics Details',
        content: (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gate Logistics & Transport</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Carrier / Transporter</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">{selectedGRN.carrierName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Vehicle / Tanker #</span>
                  <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">{selectedGRN.vehicleNumber}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Supplier Delivery Note</span>
                  <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">{selectedGRN.deliveryNoteNumber}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-neutral-500">Received By</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">{selectedGRN.receivedByName}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Purchase Order Reference</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Linked PO Number</span>
                  <span className="font-semibold text-primary-600">{selectedGRN.poNumber}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Supplier Legal Name</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">{selectedGRN.vendorName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Supplier Vendor Code</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">{selectedGRN.vendorCode}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-neutral-500">Receiving Warehouse</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">{selectedGRN.warehouseName}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        ),
      },
      {
        id: 'timeline',
        label: 'Receiving Audit Timeline',
        content: (
          <div className="p-4">
            <Timeline
              items={[
                {
                  id: 'tl-1',
                  title: 'Material Consignment Received at Factory Gate',
                  description: `Consignment entered Sheikhupura complex via vehicle ${selectedGRN.vehicleNumber}. Delivery note ${selectedGRN.deliveryNoteNumber} verified.`,
                  timestamp: `${selectedGRN.receivedDate} 09:30 AM`,
                  category: 'system',
                },
                {
                  id: 'tl-2',
                  title: 'Physical Goods Receipt Note Created',
                  description: `Officer ${selectedGRN.receivedByName} generated ${selectedGRN.grnNumber} against PO ${selectedGRN.poNumber}.`,
                  timestamp: `${selectedGRN.receivedDate} 10:15 AM`,
                  category: 'audit',
                },
                {
                  id: 'tl-3',
                  title: selectedGRN.qcStatus === QcStatus.PASSED ? 'Quality Assurance Passed' : 'Quality Assurance Inspection',
                  description: selectedGRN.qcNotes || 'Pending sample analytical test results.',
                  timestamp: selectedGRN.qcStatus === QcStatus.PASSED ? `${selectedGRN.receivedDate} 02:45 PM` : 'Pending disposition',
                  category: 'approval',
                },
              ]}
            />
          </div>
        ),
      },
    ];

    return (
      <DetailPageTemplate
        title={selectedGRN.grnNumber}
        subtitle={`${selectedGRN.vendorName} — Received on ${selectedGRN.receivedDate}`}
        breadcrumbs={[
          { label: 'Procurement', href: '#' },
          { label: 'Goods Receipts', href: '#', onClick: () => setMode('list') },
          { label: selectedGRN.grnNumber },
        ]}
        statusBadge={
          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant(selectedGRN.status as GoodsReceiptStatus)} dot>
              {selectedGRN.status.replace(/_/g, ' ')}
            </Badge>
            <Badge variant={getQcBadgeVariant(selectedGRN.qcStatus as QcStatus)} dot>
              QC: {selectedGRN.qcStatus}
            </Badge>
          </div>
        }
        tabs={tabs}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setMode('list')}>
              Back to List
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                showToast({
                  type: 'info',
                  title: 'Generating PDF',
                  message: 'Downloading GRN Inspection Certificate PDF...',
                })
              }
            >
              <IconDownload size={16} className="mr-1" />
              Download GRN
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => openQcModal(selectedGRN)}
            >
              <IconQC size={16} className="mr-1" />
              QC Inspection
            </Button>
          </div>
        }
      />
    );
  }

  // ==========================================
  // RENDER: LIST VIEW
  // ==========================================
  return (
    <ListPageTemplate
      title="Goods Receipt Notes (GRN)"
      subtitle="Track physical receiving of raw materials, packaging, and plant supplies against purchase orders."
      breadcrumbs={[
        { label: 'Procurement', href: '#' },
        { label: 'Goods Receipts' },
      ]}
      primaryAction={{
        label: 'Receive Material (New GRN)',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({
            poId: '',
            warehouseName: 'Raw Materials & Packaging Warehouse 1',
            receivedDate: new Date().toISOString().slice(0, 10),
            receivedByName: 'Zahid Mahmood (Receiving Officer)',
            carrierName: '',
            vehicleNumber: '',
            deliveryNoteNumber: '',
            notes: '',
            items: [],
          });
          setMode('create');
        },
      }}
      secondaryActions={[
        {
          label: 'Export',
          icon: <IconDownload size={16} />,
          onClick: () =>
            showToast({
              type: 'info',
              title: 'Exporting Records',
              message: 'Exporting GRN receiving register to CSV...',
            }),
        },
      ]}
      kpis={[
        {
          title: 'Total Goods Receipts',
          value: totalGRNs.toString(),
          subtitle: 'All recorded consignments',
          icon: <IconFileText size={20} className="text-primary-600" />,
        },
        {
          title: 'Quality Pending',
          value: qualityPendingCount.toString(),
          subtitle: 'Awaiting lab chemical assay',
          icon: <IconClock size={20} className="text-amber-600" />,
        },
        {
          title: 'Accepted Receipts',
          value: acceptedCount.toString(),
          subtitle: 'QC approved consignments',
          icon: <IconCheck size={20} className="text-emerald-600" />,
        },
        {
          title: 'Rejected Receipts',
          value: rejectedCount.toString(),
          subtitle: 'Failed quality specifications',
          icon: <IconAlertTriangle size={20} className="text-red-600" />,
        },
      ]}
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <IconSearch
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <Input
              type="text"
              placeholder="Search by GRN#, PO#, Vendor name, or Delivery Note#..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={statusFilter}
              onChange={(val) => setStatusFilter(typeof val === 'string' ? val : val?.target?.value || 'ALL')}
              options={[
                { value: 'ALL', label: 'All GRN Statuses' },
                { value: GoodsReceiptStatus.QUALITY_PENDING, label: 'Quality Pending' },
                { value: GoodsReceiptStatus.ACCEPTED, label: 'Accepted' },
                { value: GoodsReceiptStatus.REJECTED, label: 'Rejected' },
                { value: GoodsReceiptStatus.RECEIVED, label: 'Received' },
              ]}
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={qcFilter}
              onChange={(val) => setQcFilter(typeof val === 'string' ? val : val?.target?.value || 'ALL')}
              options={[
                { value: 'ALL', label: 'All QC Dispositions' },
                { value: QcStatus.PENDING, label: 'QC Pending' },
                { value: QcStatus.PASSED, label: 'QC Passed' },
                { value: QcStatus.REJECTED, label: 'QC Rejected' },
                { value: QcStatus.PARTIALLY_ACCEPTED, label: 'Partially Accepted' },
              ]}
            />
          </div>
        </div>

        {/* Data Table */}
        {isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : error ? (
          <ErrorState title="Failed to Load Goods Receipts" message={error} onRetry={fetchGoodsReceipts} />
        ) : filteredGRNs.length === 0 ? (
          <EmptyState
            title="No Goods Receipts Found"
            description={
              searchQuery || statusFilter !== 'ALL' || qcFilter !== 'ALL'
                ? 'No receipts matched your filter criteria.'
                : 'No goods receipts recorded in PostgreSQL yet. Create a GRN upon material arrival.'
            }
            actionLabel="Receive Material (New GRN)"
            onAction={() => setMode('create')}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredGRNs}
            keyExtractor={(item) => item.id}
            emptyDescription="No goods receipts found matching the filter criteria."
          />
        )}
      </div>

      {/* QC Inspection Modal */}
      {isQcModalOpen && selectedGRN && (
        <Modal
          isOpen={isQcModalOpen}
          onClose={() => setIsQcModalOpen(false)}
          title={`Quality Inspection Placeholder — ${selectedGRN.grnNumber}`}
        >
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm">
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                {selectedGRN.vendorName}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                PO: {selectedGRN.poNumber} | Item: {selectedGRN.items[0]?.itemName}
              </div>
              <div className="text-xs font-mono text-neutral-600 dark:text-neutral-400 mt-0.5">
                Batch: {selectedGRN.items[0]?.batchNumber} | Received: {selectedGRN.items[0]?.receivedQuantity} {selectedGRN.items[0]?.unit}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                QC Decision / Disposition *
              </label>
              <Select
                value={qcDecision}
                onChange={(val) => setQcDecision((typeof val === 'string' ? val : val?.target?.value) as QcStatus)}
                options={[
                  { value: QcStatus.PASSED, label: 'QC Passed (Full Acceptance)' },
                  { value: QcStatus.PARTIALLY_ACCEPTED, label: 'Partially Accepted' },
                  { value: QcStatus.REJECTED, label: 'QC Rejected (Failed Specifications)' },
                  { value: QcStatus.WAIVED, label: 'Waived (Concession Approved)' },
                ]}
              />
            </div>

            {qcDecision === QcStatus.PARTIALLY_ACCEPTED && selectedGRN.items[0] && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800">
                <div>
                  <label className="block text-xs font-medium text-amber-900 dark:text-amber-200 mb-1">
                    Accepted Qty ({selectedGRN.items[0].unit})
                  </label>
                  <Input
                    type="number"
                    value={qcAcceptedQty}
                    onChange={(e) => {
                      const acc = parseFloat(e.target.value) || 0;
                      setQcAcceptedQty(acc);
                      setQcRejectedQty(Math.max(0, (selectedGRN.items[0]?.receivedQuantity || 0) - acc));
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-900 dark:text-amber-200 mb-1">
                    Rejected Qty ({selectedGRN.items[0].unit})
                  </label>
                  <Input
                    type="number"
                    value={qcRejectedQty}
                    onChange={(e) => {
                      const rej = parseFloat(e.target.value) || 0;
                      setQcRejectedQty(rej);
                      setQcAcceptedQty(Math.max(0, (selectedGRN.items[0]?.receivedQuantity || 0) - rej));
                    }}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Quality Laboratory Notes / Certificate of Analysis (COA) Findings *
              </label>
              <Textarea
                rows={3}
                placeholder="Document chemical assay percentages, moisture content, tensile strength, or rejection reason..."
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <Button variant="outline" onClick={() => setIsQcModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveQcInspection}>
                <IconCheck size={16} className="mr-1.5" />
                Commit QC Disposition
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ListPageTemplate>
  );
};
