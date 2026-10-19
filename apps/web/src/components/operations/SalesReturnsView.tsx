'use client';

/**
 * SHEHSWAR ONE360 - Sales Return Management
 *
 * Implements Canonical Flow:
 * - Select Dealer, Original Sale (optional), Warehouse, Product, Quantity, Rate, Reason
 * - POST: Warehouse Finished Product Stock increases, Stock Ledger updates, Dealer Ledger credit, Outstanding balance adjusts.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import {
  DataTable,
  ColumnDef,
  Button,
  Input,
  Select,
  StatusBadge,
  KpiCard,
  TableSkeleton,
  EmptyState,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '../ui';
import { IconPlus, IconRefresh, IconClose } from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export interface SalesReturnRecord {
  id: string;
  voucherNumber: string;
  returnDate: string;
  dealer?: { id: string; name: string };
  warehouse?: { id: string; name: string };
  netAmount: number;
  postingStatus: string;
  reason?: string;
  items: Array<{ productName: string; quantity: number; rate: number; netAmount: number }>;
}

export const SalesReturnsView: React.FC = () => {
  const { showToast } = useToast();

  const [returns, setReturns] = useState<SalesReturnRecord[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form Mode
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [formDealerId, setFormDealerId] = useState<string>('');
  const [formWarehouseId, setFormWarehouseId] = useState<string>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [returnReason, setReturnReason] = useState<string>('Damaged during transit / Dealer return');
  const [formItems, setFormItems] = useState<Array<{
    finishedProductId: string;
    productName: string;
    quantity: number;
    originalQuantity?: number;
    returnedQuantity?: number;
    maxQuantity?: number;
    rate: number;
    netAmount: number;
  }>>([
    { finishedProductId: '', productName: '', quantity: 1, rate: 0, netAmount: 0 },
  ]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [retRes, dRes, whRes, prodRes, invRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/sales-returns').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/dealers').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/warehouses').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/finished-products').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/sales-invoices').catch(() => ApiClient.get<any>('/api/v1/sales/invoices')).catch(() => ({ data: [] })),
      ]);

      const retList = Array.isArray(retRes.data) ? retRes.data : retRes.data?.data || [];
      const dList = Array.isArray(dRes.data) ? dRes.data : dRes.data?.data || [];
      const whList = Array.isArray(whRes.data) ? whRes.data : whRes.data?.data || [];
      const prodList = Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data || [];
      const invList = Array.isArray(invRes.data) ? invRes.data : invRes.data?.data || [];

      setReturns(retList);
      setDealers(dList);
      setWarehouses(whList);
      setProducts(prodList);
      setSalesInvoices(invList);

      if (dList.length > 0 && !formDealerId) setFormDealerId(dList[0].id);
      if (whList.length > 0 && !formWarehouseId) setFormWarehouseId(whList[0].id);
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load sales returns', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [showToast, formDealerId, formWarehouseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Pre-fill dealer, warehouse, and products when selecting original sales invoice with remaining quantities
  const handleSelectOriginalInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    const inv = salesInvoices.find((x) => x.id === invoiceId);
    if (inv) {
      if (inv.dealerId) setFormDealerId(inv.dealerId);
      if (inv.warehouseId) setFormWarehouseId(inv.warehouseId);
      if (Array.isArray(inv.items) && inv.items.length > 0) {
        setFormItems(
          inv.items.map((i: any) => {
            const origQty = Number(i.quantity) || 1;
            const alreadyRet = Number(i.returnedQuantity || 0);
            const remaining = i.remainingQuantity !== undefined ? Number(i.remainingQuantity) : Math.max(0, origQty - alreadyRet);
            return {
              finishedProductId: i.finishedProductId || '',
              productName: i.productName || 'Finished Product',
              originalQuantity: origQty,
              returnedQuantity: alreadyRet,
              maxQuantity: remaining,
              quantity: remaining,
              rate: Number(i.rate) || 0,
              netAmount: remaining * (Number(i.rate) || 0),
            };
          }),
        );
      }
    }
  };

  const updateItem = (index: number, field: string, val: any) => {
    const updated = [...formItems];
    const item = { ...updated[index], [field]: val } as typeof updated[0];

    if (field === 'finishedProductId') {
      const prod = products.find((p) => p.id === val);
      if (prod) {
        item.productName = prod.productName;
        item.rate = Number(prod.defaultSellingPrice || 0);
      }
    }

    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    item.netAmount = qty * rate;

    updated[index] = item;
    setFormItems(updated);
  };

  const addItemRow = () => {
    setFormItems([
      ...formItems,
      { finishedProductId: '', productName: '', quantity: 1, rate: 0, netAmount: 0 },
    ]);
  };

  const removeItemRow = (idx: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handlePostReturn = async () => {
    if (!formDealerId || !formWarehouseId) {
      showToast({ title: 'Validation', message: 'Please select Dealer and Warehouse', type: 'warning' });
      return;
    }

    const validItems = formItems.filter(
      (i) => (i.finishedProductId || i.productName.trim()) && i.quantity > 0,
    );
    if (validItems.length === 0) {
      showToast({ title: 'Validation', message: 'Please add at least one product with quantity > 0', type: 'warning' });
      return;
    }

    const excessiveItem = validItems.find((i) => i.maxQuantity !== undefined && i.quantity > i.maxQuantity);
    if (excessiveItem) {
      showToast({
        title: 'Validation Error',
        message: `Return quantity (${excessiveItem.quantity}) exceeds available invoiced balance (${excessiveItem.maxQuantity}) for ${excessiveItem.productName}`,
        type: 'error',
      });
      return;
    }

    try {
      await ApiClient.post('/api/v1/sales-returns', {
        salesInvoiceId: selectedInvoiceId || undefined,
        dealerId: formDealerId,
        warehouseId: formWarehouseId,
        returnDate: new Date().toISOString(),
        reason: returnReason,
        items: validItems.map((i) => ({
          finishedProductId: i.finishedProductId || undefined,
          productName: i.productName,
          quantity: i.quantity,
          rate: i.rate,
          netAmount: i.netAmount,
        })),
      });

      showToast({
        title: 'Sales Return Posted',
        message: 'Stock restored to warehouse & dealer balance credited!',
        type: 'success',
      });
      setMode('list');
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to post sales return', type: 'error' });
    }
  };

  const totalReturnValuation = returns.reduce((sum, r) => sum + Number(r.netAmount || 0), 0);

  const columns: ColumnDef<SalesReturnRecord>[] = [
    { key: 'voucherNumber', header: 'Return Voucher', render: (r) => <span style={{ fontWeight: 600 }}>{r.voucherNumber}</span> },
    { key: 'returnDate', header: 'Date', render: (r) => new Date(r.returnDate).toLocaleDateString() },
    { key: 'dealer', header: 'Dealer', render: (r) => r.dealer?.name || '-' },
    { key: 'warehouse', header: 'Receiving Warehouse', render: (r) => r.warehouse?.name || '-' },
    { key: 'netAmount', header: 'Credit Amount', render: (r) => `PKR ${Number(r.netAmount || 0).toLocaleString()}` },
    { key: 'postingStatus', header: 'Status', render: (r) => <StatusBadge status={r.postingStatus} variant="success" /> },
    { key: 'reason', header: 'Reason', render: (r) => r.reason || '-' },
  ];

  if (mode === 'create') {
    const totalCalc = formItems.reduce((sum, i) => sum + i.netAmount, 0);

    return (
      <FormPageTemplate
        title="Create Sales Return"
        subtitle="Record product returned from a dealer. Automatically restores warehouse finished goods stock and credits dealer ledger."
        breadcrumbs={[{ label: 'Sales Returns', onClick: () => setMode('list') }, { label: 'New Return' }]}
        onCancel={() => setMode('list')}
        onSubmit={handlePostReturn}
        submitLabel="POST Sales Return"
      >
        <Card style={{ marginBottom: '20px' }}>
          <CardHeader>
            <CardTitle>Return Header</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <Select
                label="Select Dealer *"
                value={formDealerId}
                onChange={(e) => setFormDealerId(e.target.value)}
                options={dealers.map((d) => ({ label: `${d.code} - ${d.name}`, value: d.id }))}
              />
              <Select
                label="Receiving Warehouse *"
                value={formWarehouseId}
                onChange={(e) => setFormWarehouseId(e.target.value)}
                options={warehouses.map((w) => ({ label: w.name, value: w.id }))}
              />
              <Select
                label="Original Sales Invoice (Optional)"
                value={selectedInvoiceId}
                onChange={(e) => handleSelectOriginalInvoice(e.target.value)}
                options={[
                  { label: '-- Direct Return --', value: '' },
                  ...salesInvoices.map((inv) => ({
                    label: `${inv.invoiceNumber} - PKR ${Number(inv.netAmount).toLocaleString()}`,
                    value: inv.id,
                  })),
                ]}
              />
              <Input
                label="Return Reason"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Reason for return"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardTitle>Returned Finished Goods</CardTitle>
              <Button size="sm" variant="secondary" onClick={addItemRow}>
                <IconPlus size={14} /> Add Product Row
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Finished Product</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Quantity</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Credit Rate (PKR)</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Total Credit (PKR)</th>
                  <th style={{ padding: '8px', width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {formItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px' }}>
                      <select
                        value={item.finishedProductId}
                        onChange={(e) => updateItem(idx, 'finishedProductId', e.target.value)}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--border-subtle)', width: '100%' }}
                      >
                        <option value="">Select Finished Product...</option>
                        {item.finishedProductId && !products.some((p) => p.id === item.finishedProductId) && (
                          <option value={item.finishedProductId}>
                            {item.productName || 'Invoice Product'}
                          </option>
                        )}
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.productCode ? `[${p.productCode}] ` : ''}{p.productName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Input
                            type="number"
                            min="0"
                            max={item.maxQuantity}
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            style={{ textAlign: 'right', width: '100px' }}
                          />
                          {item.maxQuantity !== undefined && (
                            <button
                              type="button"
                              onClick={() => updateItem(idx, 'quantity', item.maxQuantity)}
                              title="Return all available sold quantity"
                              style={{
                                padding: '4px 6px',
                                fontSize: '11px',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              ALL
                            </button>
                          )}
                        </div>
                        {item.maxQuantity !== undefined && (
                          <div style={{ fontSize: '11px', color: item.quantity > item.maxQuantity ? '#dc2626' : '#64748b' }}>
                            Avail: <strong>{item.maxQuantity}</strong>
                            {item.originalQuantity !== undefined && ` (Sold: ${item.originalQuantity})`}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <Input
                        type="number"
                        value={item.rate}
                        onChange={(e) => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                        style={{ textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                      PKR {item.netAmount.toLocaleString()}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => removeItemRow(idx)}
                        style={{ background: 'none', border: 'none', color: 'var(--brand-danger)', cursor: 'pointer' }}
                      >
                        <IconClose size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <div style={{ textAlign: 'right', fontSize: '15px', fontWeight: 700 }}>
                Total Dealer Credit: <span style={{ color: 'var(--brand-primary)' }}>PKR {totalCalc.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </FormPageTemplate>
    );
  }

  return (
    <ListPageTemplate
      title="Sales Returns"
      subtitle="Finished products returned by dealers. Posting automatically restores warehouse stock and credits the dealer ledger balance."
      actions={
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="primary" onClick={() => setMode('create')}>
            <IconPlus size={16} /> Create Sales Return
          </Button>
          <Button variant="secondary" onClick={loadData}>
            <IconRefresh size={16} />
          </Button>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <KpiCard title="Total Sales Returns" value={`PKR ${(totalReturnValuation / 1000000).toFixed(2)}M`} subtitle="Dealer credit notes" />
        <KpiCard title="Returns Count" value={returns.length.toString()} subtitle="Processed sales returns" />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : returns.length === 0 ? (
        <EmptyState
          title="No sales returns recorded"
          description="Log dealer product returns to restore stock to warehouse and issue dealer credit."
          actionLabel="Create Return"
          onAction={() => setMode('create')}
        />
      ) : (
        <DataTable columns={columns} data={returns} keyExtractor={(r) => r.id} />
      )}
    </ListPageTemplate>
  );
};
