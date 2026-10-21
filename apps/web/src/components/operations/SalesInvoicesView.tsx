'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
  StatusBadge,
  DataTable,
  ColumnDef,
  Modal,
} from '../ui';
import { IconFileText, IconRefresh, IconPlus, IconTrash, IconRotateCcw, IconMapPin, IconBuilding } from '../icons';
import { SalesInvoiceModal } from './SalesInvoiceModal';
import { SalesInvoiceExportData } from '../../lib/pdf-export';

export interface SalesInvoicesViewProps {
  onNavigateToOrders?: () => void;
}

export interface InvoiceItemRow {
  finishedProductId: string;
  productName: string;
  packing: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export const SalesInvoicesView: React.FC<SalesInvoicesViewProps> = ({ onNavigateToOrders }) => {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeInvoice, setActiveInvoice] = useState<SalesInvoiceExportData | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Direct Sale / New Invoice Creation Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Sales Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnInvoice, setReturnInvoice] = useState<any | null>(null);
  const [returnReason, setReturnReason] = useState('Customer return / Defective material / Excess order');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnItems, setReturnItems] = useState<Array<{
    finishedProductId?: string;
    productName: string;
    soldQuantity: number;
    returnedQuantity: number;
    maxQuantity: number;
    quantity: number;
    rate: number;
    netAmount: number;
  }>>([]);

  const [formData, setFormData] = useState({
    dealerId: '',
    warehouseId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    notes: 'Direct Commercial Sale generated in ERP',
  });
  const [formItems, setFormItems] = useState<InvoiceItemRow[]>([
    {
      finishedProductId: '',
      productName: '',
      packing: 'Commercial Pack',
      quantity: 10,
      unitPrice: 1500,
      totalPrice: 15000,
    },
  ]);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invRes, dealerRes, whRes, prodRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/sales-invoices').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/dealers').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/warehouses').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/warehouse-stock/sales-products').catch(() => ({ data: [] })),
      ]);

      const raw = invRes.data;
      let list: any[] = [];
      if (Array.isArray(raw)) {
        list = raw;
      } else if (Array.isArray(raw?.data)) {
        list = raw.data;
      } else if (Array.isArray((invRes as any)?.data?.data)) {
        list = (invRes as any).data.data;
      }

      setInvoices(list);
      setDealers(Array.isArray(dealerRes.data) ? dealerRes.data : dealerRes.data?.data || []);
      setWarehouses(Array.isArray(whRes.data) ? whRes.data : whRes.data?.data || []);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data || []);
    } catch (err: any) {
      showToast({
        title: 'Error',
        message: err.message || 'Failed to load sales invoices',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleOpenInvoice = (inv: any) => {
    setActiveInvoice(inv);
    setIsInvoiceModalOpen(true);
  };

  const updateItem = (index: number, field: keyof InvoiceItemRow, value: any) => {
    const updated = [...formItems];
    const item = { ...updated[index], [field]: value } as InvoiceItemRow;

    if (field === 'finishedProductId') {
      const prod = products.find((p) => p.id === value);
      if (prod) {
        item.productName = prod.productName;
        item.unitPrice = Number(prod.defaultSellingPrice || 0);
      }
    }

    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    item.totalPrice = qty * price;

    updated[index] = item;
    setFormItems(updated);
  };

  const addItemRow = () => {
    setFormItems([
      ...formItems,
      {
        finishedProductId: '',
        productName: '',
        packing: 'Commercial Pack',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  // Direct Sale Creation: books order, auto-approves, and converts to invoice immediately
  const handleCreateDirectSaleInvoice = async () => {
    if (!formData.dealerId) {
      showToast({ title: 'Validation Error', message: 'Please select a dealer', type: 'error' });
      return;
    }
    const warehouseId = formData.warehouseId || warehouses[0]?.id;
    if (!warehouseId) {
      showToast({ title: 'Validation Error', message: 'Please select a dispatch warehouse', type: 'error' });
      return;
    }
    if (formItems.some((i) => !i.productName || i.quantity <= 0 || i.unitPrice <= 0)) {
      showToast({ title: 'Validation Error', message: 'All items must have product, quantity, and price', type: 'error' });
      return;
    }

    setIsCreating(true);
    try {
      // 1. Create order
      const orderRes = await ApiClient.post<any>('/api/v1/sales-orders', {
        dealerId: formData.dealerId,
        warehouseId,
        orderDate: formData.invoiceDate,
        notes: formData.notes,
        items: formItems.map((i) => ({
          finishedProductId: i.finishedProductId || undefined,
          productName: i.productName,
          packing: i.packing,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
        })),
      });

      const order = orderRes.data?.data || orderRes.data;

      // 2. Auto-approve
      await ApiClient.patch(`/api/v1/sales-orders/${order.id}/approve`, { approved: true });

      // 3. Convert to Sale Invoice
      const convRes = await ApiClient.post<any>(`/api/v1/sales-orders/${order.id}/convert-to-sale`, {
        warehouseId,
      });

      const invoice = convRes.data?.data || convRes.data;

      showToast({
        title: 'Sales Invoice Created & Posted!',
        message: 'Stock deducted, dealer sub-ledger debited, and official invoice generated.',
        type: 'success',
      });

      setIsCreateModalOpen(false);
      await loadInvoices();

      // Automatically pop up the colorful modern invoice!
      if (invoice && invoice.invoiceNumber) {
        setActiveInvoice(invoice);
        setIsInvoiceModalOpen(true);
      }
    } catch (err: any) {
      showToast({
        title: 'Direct Sale Error',
        message: err.message || 'Failed to create sales invoice. Ensure sufficient warehouse stock.',
        type: 'error',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Open Sales Return Modal with customizable partial return quantities
  const openReturnModal = (inv: any) => {
    setReturnInvoice(inv);
    setReturnReason('Customer return / Defective material / Excess order');
    if (Array.isArray(inv.items) && inv.items.length > 0) {
      setReturnItems(
        inv.items.map((it: any) => {
          const soldQty = Number(it.quantity) || 1;
          const returnedQty = Number(it.returnedQuantity) || 0;
          const maxQty = it.remainingQuantity !== undefined ? Number(it.remainingQuantity) : Math.max(0, soldQty - returnedQty);
          return {
            finishedProductId: it.finishedProductId || undefined,
            productName: it.productName || 'Finished Product',
            soldQuantity: soldQty,
            returnedQuantity: returnedQty,
            maxQuantity: maxQty,
            quantity: maxQty, // Editable return qty defaults to available
            rate: Number(it.rate || it.unitPrice || 0),
            netAmount: maxQty * Number(it.rate || it.unitPrice || 0),
          };
        }),
      );
    } else {
      setReturnItems([
        {
          productName: 'Sale Item',
          soldQuantity: 1,
          returnedQuantity: 0,
          maxQuantity: 1,
          quantity: 1,
          rate: Number(inv.netAmount) || 0,
          netAmount: Number(inv.netAmount) || 0,
        },
      ]);
    }
    setIsReturnModalOpen(true);
  };

  const updateReturnItemQty = (index: number, qty: number) => {
    const updated = [...returnItems];
    const current = updated[index];
    if (!current) return;
    const max = Number(current.maxQuantity ?? 0);
    const validQty = Math.max(0, Math.min(qty, max));
    updated[index] = {
      ...current,
      quantity: validQty,
      netAmount: validQty * Number(current.rate || 0),
    };
    setReturnItems(updated);
  };

  const handleConfirmReturn = async () => {
    if (!returnInvoice) return;
    const itemsToReturn = returnItems.filter((i) => i.quantity > 0);
    if (itemsToReturn.length === 0) {
      showToast({ title: 'Validation', message: 'Return quantity must be greater than 0', type: 'warning' });
      return;
    }

    setIsSubmittingReturn(true);
    try {
      await ApiClient.post('/api/v1/sales-returns', {
        salesInvoiceId: returnInvoice.id,
        dealerId: returnInvoice.dealerId,
        warehouseId: returnInvoice.warehouseId,
        returnDate: new Date().toISOString(),
        reason: returnReason,
        items: itemsToReturn.map((i) => ({
          finishedProductId: i.finishedProductId || undefined,
          productName: i.productName,
          quantity: i.quantity,
          rate: i.rate,
          netAmount: i.netAmount,
        })),
      });

      showToast({
        title: 'Sales Return Posted',
        message: `Stock restored to warehouse & PKR ${itemsToReturn.reduce((s, i) => s + i.netAmount, 0).toLocaleString()} credited to dealer!`,
        type: 'success',
      });
      setIsReturnModalOpen(false);
      setReturnInvoice(null);
      loadInvoices();
    } catch (err: any) {
      showToast({ title: 'Return Failed', message: err?.message || 'Failed to submit sales return', type: 'error' });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.dealer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.salesOrder?.orderNumber && inv.salesOrder.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (inv.salesOrder?.salesOfficer &&
        `${inv.salesOrder.salesOfficer.firstName} ${inv.salesOrder.salesOfficer.lastName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || inv.postingStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalBilled = filteredInvoices.reduce((sum, inv) => sum + Number(inv.netAmount || 0), 0);
  const totalCount = filteredInvoices.length;

  const columns: ColumnDef<any>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      render: (inv) => (
        <div>
          <span style={{ fontWeight: 700, color: '#1e3a8a', letterSpacing: '0.02em' }}>
            {inv.invoiceNumber}
          </span>
          {inv.salesOrder?.orderNumber && (
            <div style={{ fontSize: '11px', color: '#6b7280' }}>
              Ref: SO #{inv.salesOrder.orderNumber}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'invoiceDate',
      header: 'Date',
      render: (inv) => (
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'dealer',
      header: 'Dealer',
      render: (inv) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inv.dealer?.name || 'Walk-in / Cash'}</div>
          {inv.dealer?.city && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <IconMapPin size={11} /> {inv.dealer.city}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'salesOfficer',
      header: 'Booked By (Mobile App)',
      render: (inv) => {
        const officer = inv.salesOrder?.salesOfficer;
        if (officer) {
          return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#7c3aed',
                }}
              />
              <span style={{ fontWeight: 600, color: '#6d28d9', fontSize: '12px' }}>
                {officer.firstName} {officer.lastName}
              </span>
            </div>
          );
        }
        return <span style={{ fontSize: '12px', color: '#9ca3af' }}>ERP Direct / Head Office</span>;
      },
    },
    {
      key: 'warehouse',
      header: 'Dispatch Warehouse',
      render: (inv) => (
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <IconBuilding size={13} /> {inv.warehouse?.name || 'Central Warehouse'}
        </span>
      ),
    },
    {
      key: 'netAmount',
      header: 'Net Total (PKR)',
      align: 'right',
      render: (inv) => (
        <span style={{ fontWeight: 700, color: '#047857', fontSize: '14px' }}>
          Rs. {Number(inv.netAmount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'postingStatus',
      header: 'Status',
      render: (inv) => (
        <StatusBadge
          status={inv.postingStatus || 'POSTED'}
          variant={inv.postingStatus === 'POSTED' ? 'success' : 'default'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (inv) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenInvoice(inv)}
            style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              fontWeight: 600,
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <IconFileText size={14} />
            View
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openReturnModal(inv)}
            style={{
              fontWeight: 600,
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Return items from this sales invoice"
          >
            <IconRotateCcw size={14} />
            Return
          </Button>
        </div>
      ),
    },
  ];

  const totalModalValue = formItems.reduce((sum, i) => sum + i.totalPrice, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)',
          borderRadius: '16px',
          color: '#ffffff',
          boxShadow: '0 8px 24px rgba(30, 58, 138, 0.2)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Enterprise Sales
            </span>
            <span style={{ fontSize: '12px', opacity: 0.85 }}>Mobile & Direct Billing</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#ffffff' }}>
            Commercial Sales Invoices
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
            Generate, view, and print modern colorful invoices featuring the Shehswar watermark and legal commercial notes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {onNavigateToOrders && (
            <Button
              variant="secondary"
              onClick={onNavigateToOrders}
              style={{
                backgroundColor: 'rgba(255,255,255,0.12)',
                color: '#ffffff',
                borderColor: 'rgba(255,255,255,0.3)',
              }}
            >
              ← Back to Sales Orders
            </Button>
          )}

          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              borderColor: '#059669',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <IconPlus size={16} />
            + Create Direct Sale Invoice
          </Button>

          <Button
            variant="secondary"
            onClick={loadInvoices}
            disabled={isLoading}
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              borderColor: 'rgba(255,255,255,0.3)',
            }}
          >
            <IconRefresh size={16} /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <Card style={{ borderLeft: '4px solid #1e3a8a' }}>
          <CardContent style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>TOTAL INVOICES</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
              {totalCount}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Dispatched & Posted</div>
          </CardContent>
        </Card>

        <Card style={{ borderLeft: '4px solid #047857' }}>
          <CardContent style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>TOTAL VALUE (PKR)</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#047857', marginTop: '4px' }}>
              Rs. {totalBilled.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Dealer debits posted</div>
          </CardContent>
        </Card>

        <Card style={{ borderLeft: '4px solid #7c3aed' }}>
          <CardContent style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>MOBILE ORDERS CONVERTED</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#7c3aed', marginTop: '4px' }}>
              {invoices.filter((i) => i.salesOrder?.salesOfficer).length}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Booked via Seller Mobile App</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Table Card */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <CardTitle>Invoices List</CardTitle>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ width: '280px' }}>
                <Input
                  placeholder="Search invoice #, dealer, seller..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ width: '160px' }}>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { label: 'All Statuses', value: 'ALL' },
                    { label: 'POSTED', value: 'POSTED' },
                    { label: 'DRAFT', value: 'DRAFT' },
                  ]}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredInvoices}
            columns={columns}
            isLoading={isLoading}
            emptyTitle="No commercial sales invoices found"
            emptyDescription="Invoices will appear here once sales orders are approved and converted into sales, or created directly."
          />
        </CardContent>
      </Card>

      {/* Direct Sale Creation Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create & Post Direct Sales Invoice"
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #6ee7b7',
              fontSize: '13px',
              color: '#065f46',
            }}
          >
            <strong>Direct Invoicing:</strong> Creates order, dispatches stock from warehouse, debits dealer ledger, and immediately posts the official numbered commercial Sales Invoice.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <Select
              label="Dealer *"
              value={formData.dealerId}
              onChange={(e) => setFormData({ ...formData, dealerId: e.target.value })}
              options={[
                { label: 'Select Dealer...', value: '' },
                ...dealers.map((d) => ({ label: `${d.code} - ${d.name}`, value: d.id })),
              ]}
            />
            <Select
              label="Dispatch Warehouse *"
              value={formData.warehouseId || warehouses[0]?.id || ''}
              onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
              options={[
                { label: 'Select Warehouse...', value: '' },
                ...warehouses.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id })),
              ]}
            />
            <Input
              label="Invoice Date"
              type="date"
              value={formData.invoiceDate}
              onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
            />
          </div>

          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e3a8a' }}>Invoice Line Items</span>
              <Button variant="secondary" size="sm" onClick={addItemRow}>
                <IconPlus size={14} /> Add Product
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {formItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '3fr 1fr 1.5fr 1.5fr auto',
                    gap: '10px',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Select
                    value={item.finishedProductId}
                    onChange={(e) => updateItem(idx, 'finishedProductId', e.target.value)}
                    options={[
                      { label: 'Select Product...', value: '' },
                      ...products.map((p) => ({
                        label: `${p.productCode} - ${p.productName} (Stock: ${p.stockOnHand || 0})`,
                        value: p.id,
                      })),
                    ]}
                  />
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  />
                  <Input
                    type="number"
                    min="0"
                    placeholder="Rate"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                  />
                  <div style={{ textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                    PKR {item.totalPrice.toLocaleString()}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItemRow(idx)}
                    disabled={formItems.length === 1}
                  >
                    <IconTrash size={15} color="#ef4444" />
                  </Button>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '14px',
                paddingTop: '10px',
                borderTop: '2px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Total Items: {formItems.length}
              </div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#047857' }}>
                Net Payable Total: PKR {totalModalValue.toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateDirectSaleInvoice}
              disabled={isCreating}
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              }}
            >
              {isCreating ? 'Processing...' : 'Post Commercial Sales Invoice'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modern Colorful Sales Invoice Modal with Shehswar Watermark */}
      {activeInvoice && (
        <SalesInvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setActiveInvoice(null);
          }}
          invoice={activeInvoice}
        />
      )}

      {/* Modern Sales Return Modal with Customizable Quantities */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title={`Sales Return — ${returnInvoice?.invoiceNumber || ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: 'var(--bg-subtle, #f8fafc)', borderRadius: '8px', fontSize: '13px' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Dealer: </span>
              <strong>{returnInvoice?.dealer?.name || 'Dealer'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Receiving Warehouse: </span>
              <strong>{returnInvoice?.warehouse?.name || 'Warehouse'}</strong>
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12px', color: '#1e40af' }}>
            <strong>Customizable Return Quantity:</strong> You can return partial quantities (e.g. return 30 out of 100 sold units). Warehouse stock will be restored and dealer ledger balance will be credited proportionately.
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Return Reason
            </label>
            <Input
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Customer return / Damaged packing / Quality issue"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              Items to Return
            </label>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-subtle, #e2e8f0)', textAlign: 'left', background: 'var(--bg-subtle)' }}>
                    <th style={{ padding: '8px' }}>Product</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Sold</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Already Ret.</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Available</th>
                    <th style={{ padding: '8px', width: '170px', textAlign: 'center' }}>Return Qty</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Credit Note</th>
                  </tr>
                </thead>
                <tbody>
                  {returnItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle, #f1f5f9)' }}>
                      <td style={{ padding: '8px', fontWeight: 500 }}>{item.productName}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{item.soldQuantity ?? item.maxQuantity}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#e11d48' }}>{item.returnedQuantity ?? 0}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: '#059669' }}>{item.maxQuantity}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                          <Input
                            type="number"
                            min="0"
                            max={item.maxQuantity}
                            value={item.quantity}
                            onChange={(e) => updateReturnItemQty(idx, Number(e.target.value))}
                            style={{ width: '80px', padding: '4px 8px', textAlign: 'right' }}
                          />
                          <button
                            type="button"
                            onClick={() => updateReturnItemQty(idx, item.maxQuantity)}
                            style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                            title="Return all available"
                          >
                            ALL
                          </button>
                          <button
                            type="button"
                            onClick={() => updateReturnItemQty(idx, 0)}
                            style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                            title="Return zero"
                          >
                            0
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>PKR {item.rate.toLocaleString()}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: item.quantity > 0 ? '#047857' : 'inherit' }}>
                        PKR {item.netAmount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-subtle, #e2e8f0)' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>
              Total Dealer Credit: <span style={{ color: '#047857' }}>PKR {returnItems.reduce((s, i) => s + i.netAmount, 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="secondary" onClick={() => setIsReturnModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmReturn}
                disabled={isSubmittingReturn || returnItems.every((i) => i.quantity <= 0)}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                }}
              >
                {isSubmittingReturn ? 'Processing...' : 'Confirm Sales Return'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
