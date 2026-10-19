'use client';

/**
 * SHEHSWAR ONE360 - Purchase Return Management
 *
 * Implements Canonical Flow:
 * - Select Existing Purchase OR Upload Return Document
 * - Return against original purchase
 * - POST: Warehouse Stock decreases, Stock Ledger entry created, Vendor Ledger adjusts
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

export interface PurchaseReturnRecord {
  id: string;
  voucherNumber: string;
  createdAt: string;
  date?: string;
  vendor?: { id: string; name: string };
  warehouse?: { id: string; name: string };
  purchaseInvoice?: { id: string; voucherNumber: string };
  grossAmount: number;
  netAmount: number;
  postingStatus: string;
  reason?: string;
  items: Array<{ itemName: string; quantity: number; rate: number; netAmount: number }>;
}

export const PurchaseReturnsView: React.FC = () => {
  const { showToast } = useToast();

  const [returns, setReturns] = useState<PurchaseReturnRecord[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [packingMaterials, setPackingMaterials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form Mode
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  const [formVendorId, setFormVendorId] = useState<string>('');
  const [formWarehouseId, setFormWarehouseId] = useState<string>('');
  const [returnReason, setReturnReason] = useState<string>('Damaged / Sub-standard quality specifications');
  const [formItems, setFormItems] = useState<Array<{
    materialType: 'RAW_MATERIAL' | 'PACKING_MATERIAL';
    rawMaterialId?: string | null;
    packingMaterialId?: string | null;
    finishedProductId?: string | null;
    itemName: string;
    quantity: number;
    originalQuantity?: number;
    returnedQuantity?: number;
    maxQuantity?: number;
    rate: number;
    netAmount: number;
  }>>([
    { materialType: 'RAW_MATERIAL', rawMaterialId: null, packingMaterialId: null, itemName: '', quantity: 1, rate: 0, netAmount: 0 },
  ]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [retRes, pRes, vRes, whRes, rmRes, pmRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/purchases/returns').catch(() => ApiClient.get<any>('/api/v1/purchase-returns')),
        ApiClient.get<any>('/api/v1/purchases').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/procurement/vendors').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/warehouses').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/raw-materials').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/packing-materials').catch(() => ({ data: [] })),
      ]);

      const retList = Array.isArray(retRes.data) ? retRes.data : retRes.data?.data || [];
      const pList = Array.isArray(pRes.data) ? pRes.data : pRes.data?.data || [];
      const vList = Array.isArray(vRes.data) ? vRes.data : vRes.data?.data || [];
      const whList = Array.isArray(whRes.data) ? whRes.data : whRes.data?.data || [];
      const rmList = Array.isArray(rmRes.data) ? rmRes.data : rmRes.data?.data || [];
      const pmList = Array.isArray(pmRes.data) ? pmRes.data : pmRes.data?.data || [];

      setReturns(retList);
      setPurchases(pList);
      setVendors(vList);
      setWarehouses(whList);
      setRawMaterials(rmList);
      setPackingMaterials(pmList);

      if (vList.length > 0 && !formVendorId) setFormVendorId(vList[0].id);
      if (whList.length > 0 && !formWarehouseId) setFormWarehouseId(whList[0].id);
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load purchase returns', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [showToast, formVendorId, formWarehouseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When original purchase is selected, pre-populate vendor, warehouse, and line items with available balances
  const handleSelectOriginalPurchase = (purchaseId: string) => {
    setSelectedPurchaseId(purchaseId);
    const p = purchases.find((x) => x.id === purchaseId);
    if (p) {
      if (p.vendorId) setFormVendorId(p.vendorId);
      if (p.warehouseId) setFormWarehouseId(p.warehouseId);
      if (Array.isArray(p.items) && p.items.length > 0) {
        setFormItems(
          p.items.map((i: any) => {
            const origQty = Number(i.quantity) || 1;
            const alreadyRet = Number(i.returnedQuantity || 0);
            const remaining = i.remainingQuantity !== undefined ? Number(i.remainingQuantity) : Math.max(0, origQty - alreadyRet);
            return {
              materialType: i.materialType || 'RAW_MATERIAL',
              rawMaterialId: i.rawMaterialId || null,
              packingMaterialId: i.packingMaterialId || null,
              finishedProductId: i.finishedProductId || null,
              warehouseId: i.warehouseId || p.warehouseId || null,
              itemName: i.itemName,
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

    // If itemName updated, auto-match from masters
    if (field === 'itemName' && typeof val === 'string') {
      const valLower = val.trim().toLowerCase();
      if (item.materialType === 'RAW_MATERIAL') {
        const match = rawMaterials.find(
          (m) =>
            m.materialName?.toLowerCase() === valLower ||
            m.materialCode?.toLowerCase() === valLower,
        );
        if (match) {
          item.rawMaterialId = match.id;
          if (match.currentCost && !item.rate) item.rate = Number(match.currentCost);
        }
      } else {
        const match = packingMaterials.find(
          (m) =>
            m.materialName?.toLowerCase() === valLower ||
            m.materialCode?.toLowerCase() === valLower,
        );
        if (match) {
          item.packingMaterialId = match.id;
          if (match.currentCost && !item.rate) item.rate = Number(match.currentCost);
        }
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
      { materialType: 'RAW_MATERIAL', rawMaterialId: null, packingMaterialId: null, itemName: '', quantity: 1, rate: 0, netAmount: 0 },
    ]);
  };

  const removeItemRow = (idx: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handlePostReturn = async () => {
    if (!formVendorId || !formWarehouseId) {
      showToast({ title: 'Validation', message: 'Please select Vendor and Warehouse', type: 'warning' });
      return;
    }

    const validItems = formItems.filter((i) => i.itemName.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      showToast({ title: 'Validation', message: 'Please add at least one item with valid quantity and name', type: 'warning' });
      return;
    }

    const excessiveItem = validItems.find((i) => i.maxQuantity !== undefined && i.quantity > i.maxQuantity);
    if (excessiveItem) {
      showToast({
        title: 'Validation Error',
        message: `Return quantity (${excessiveItem.quantity}) exceeds available balance (${excessiveItem.maxQuantity}) for ${excessiveItem.itemName}`,
        type: 'error',
      });
      return;
    }

    try {
      await ApiClient.post('/api/v1/purchases/returns', {
        purchaseInvoiceId: selectedPurchaseId || undefined,
        vendorId: formVendorId,
        warehouseId: formWarehouseId,
        date: new Date().toISOString(),
        reason: returnReason,
        items: validItems.map((i) => ({
          materialType: i.materialType,
          rawMaterialId: i.rawMaterialId || undefined,
          packingMaterialId: i.packingMaterialId || undefined,
          finishedProductId: i.finishedProductId || undefined,
          warehouseId: (i as any).warehouseId || formWarehouseId,
          itemName: i.itemName,
          quantity: i.quantity,
          rate: i.rate,
          grossAmount: i.netAmount,
          netAmount: i.netAmount,
        })),
      });

      showToast({
        title: 'Return Posted',
        message: 'Stock decreased & vendor ledger credit adjusted successfully!',
        type: 'success',
      });
      setMode('list');
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to post return', type: 'error' });
    }
  };

  const totalReturnValuation = returns.reduce((sum, r) => sum + Number(r.netAmount || 0), 0);

  const columns: ColumnDef<PurchaseReturnRecord>[] = [
    { key: 'voucherNumber', header: 'Return Voucher', render: (r) => <span style={{ fontWeight: 600 }}>{r.voucherNumber}</span> },
    { key: 'createdAt', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString() },
    { key: 'vendor', header: 'Vendor', render: (r) => r.vendor?.name || '-' },
    { key: 'warehouse', header: 'Warehouse', render: (r) => r.warehouse?.name || '-' },
    { key: 'netAmount', header: 'Return Amount', render: (r) => `PKR ${Number(r.netAmount || 0).toLocaleString()}` },
    { key: 'postingStatus', header: 'Status', render: (r) => <StatusBadge status={r.postingStatus} variant="neutral" /> },
    { key: 'reason', header: 'Reason', render: (r) => r.reason || '-' },
  ];

  if (mode === 'create') {
    const totalCalc = formItems.reduce((sum, i) => sum + i.netAmount, 0);

    return (
      <FormPageTemplate
        title="Create Purchase Return"
        subtitle="Return defective raw materials or packaging to vendor. Automatically deducts warehouse stock and adjusts vendor ledger."
        breadcrumbs={[{ label: 'Purchase Returns', onClick: () => setMode('list') }, { label: 'New Return' }]}
        onCancel={() => setMode('list')}
        onSubmit={handlePostReturn}
        submitLabel="POST Purchase Return"
      >
        <Card style={{ marginBottom: '20px' }}>
          <CardHeader>
            <CardTitle>Return Header</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <Select
                label="Select Original Purchase (Optional)"
                value={selectedPurchaseId}
                onChange={(e) => handleSelectOriginalPurchase(e.target.value)}
                options={[
                  { label: '-- Direct Return (No PO / Invoice) --', value: '' },
                  ...purchases.map((p) => ({
                    label: `${p.voucherNumber} - ${p.vendor?.name || 'Vendor'} (PKR ${Number(p.netAmount).toLocaleString()})`,
                    value: p.id,
                  })),
                ]}
              />
              <Select
                label="Vendor *"
                value={formVendorId}
                onChange={(e) => setFormVendorId(e.target.value)}
                options={vendors.map((v) => ({ label: `${v.code} - ${v.name}`, value: v.id }))}
              />
              <Select
                label="Source Warehouse *"
                value={formWarehouseId}
                onChange={(e) => setFormWarehouseId(e.target.value)}
                options={warehouses.map((w) => ({ label: w.name, value: w.id }))}
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
              <CardTitle>Items to Return</CardTitle>
              <Button size="sm" variant="secondary" onClick={addItemRow}>
                <IconPlus size={14} /> Add Return Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Type</th>
                  <th style={{ padding: '8px' }}>Item Name</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Return Qty</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Rate (PKR)</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Total (PKR)</th>
                  <th style={{ padding: '8px', width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {formItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px' }}>
                      <select
                        value={item.materialType}
                        onChange={(e) => updateItem(idx, 'materialType', e.target.value)}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                      >
                        <option value="RAW_MATERIAL">Raw Material</option>
                        <option value="PACKING_MATERIAL">Packaging</option>
                      </select>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        list={`material-options-${idx}`}
                        value={item.itemName}
                        onChange={(e) => updateItem(idx, 'itemName', e.target.value)}
                        placeholder="Search or enter material..."
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle, #cbd5e1)',
                          background: 'var(--bg-surface, #ffffff)',
                          fontSize: '13px',
                        }}
                      />
                      <datalist id={`material-options-${idx}`}>
                        {(item.materialType === 'RAW_MATERIAL' ? rawMaterials : packingMaterials).map((m) => (
                          <option key={m.id} value={m.materialName}>
                            {m.materialCode ? `[${m.materialCode}] ` : ''}{m.materialName}
                          </option>
                        ))}
                      </datalist>
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
                              title="Return all remaining quantity"
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
                            {item.originalQuantity !== undefined && ` (Orig: ${item.originalQuantity})`}
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
                Total Return Value: <span style={{ color: 'var(--brand-danger)' }}>PKR {totalCalc.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </FormPageTemplate>
    );
  }

  return (
    <ListPageTemplate
      title="Purchase Returns"
      subtitle="Defective material returns to suppliers. Posting automatically updates warehouse stock and adjusts vendor ledger."
      actions={
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="primary" onClick={() => setMode('create')}>
            <IconPlus size={16} /> Create Purchase Return
          </Button>
          <Button variant="secondary" onClick={loadData}>
            <IconRefresh size={16} />
          </Button>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <KpiCard title="Total Purchase Returns" value={`PKR ${(totalReturnValuation / 1000000).toFixed(2)}M`} subtitle="Cumulative credit notes" />
        <KpiCard title="Total Returns Count" value={returns.length.toString()} subtitle="Recorded return vouchers" />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : returns.length === 0 ? (
        <EmptyState
          title="No purchase returns recorded"
          description="Record material returns against defective vendor supplies to deduct stock and adjust ledger credit."
          actionLabel="Create Return"
          onAction={() => setMode('create')}
        />
      ) : (
        <DataTable columns={columns} data={returns} keyExtractor={(r) => r.id} />
      )}
    </ListPageTemplate>
  );
};
