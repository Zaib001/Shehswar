'use client';

/**
 * SHEHSWAR ONE360 - Intercompany Parent → Child Company Flow
 *
 * Implements Canonical Flow:
 * - Parent Company manufactures / stocks finished goods.
 * - One atomic action creates:
 *   1. Parent Company: Sale Invoice + Warehouse Stock OUT (-)
 *   2. Child Company: Purchase Invoice + Warehouse Stock IN (+)
 * - Automatically links both documents under the same Intercompany Transfer transaction ID.
 */
import React, { useState, useEffect, useCallback } from 'react';
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
  TableSkeleton,
} from '../ui';
import { IconRefresh, IconCheck } from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export interface IntercompanyTransferRecord {
  id: string;
  invoiceNumber: string;
  date: string;
  targetCompany?: string;
  warehouse?: string;
  amount: number;
  items: Array<{ productName: string; quantity: number; rate: number }>;
  notes?: string;
}

export const IntercompanyTransferView: React.FC = () => {
  const { showToast } = useToast();

  const [companies, setCompanies] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [history, setHistory] = useState<IntercompanyTransferRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form Fields
  const [parentCompanyId, setParentCompanyId] = useState<string>('');
  const [childCompanyId, setChildCompanyId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [parentWarehouseId, setParentWarehouseId] = useState<string>('');
  const [childWarehouseId, setChildWarehouseId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(100);
  const [transferCost, setTransferCost] = useState<number>(500);
  const [sellingPrice, setSellingPrice] = useState<number>(550);
  const [transferNotes, setTransferNotes] = useState<string>('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [compRes, whRes, prodRes, histRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/master-data/companies'),
        ApiClient.get<any>('/api/v1/master-data/warehouses'),
        ApiClient.get<any>('/api/v1/master-data/finished-products'),
        ApiClient.get<any>('/api/v1/operations/intercompany/history'),
      ]);

      const compList = Array.isArray(compRes.data) ? compRes.data : compRes.data?.data || [];
      const whList = Array.isArray(whRes.data) ? whRes.data : whRes.data?.data || [];
      const prodList = Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data || [];
      const histList = Array.isArray(histRes.data) ? histRes.data : histRes.data?.data || [];

      setCompanies(compList);
      setWarehouses(whList);
      setProducts(prodList);
      setHistory(histList);

      if (compList.length > 0 && !parentCompanyId) {
        setParentCompanyId(compList[0].id);
        if (compList.length > 1) setChildCompanyId(compList[1].id);
      }
      if (whList.length > 0 && !parentWarehouseId) {
        setParentWarehouseId(whList[0].id);
        if (whList.length > 1) setChildWarehouseId(whList[1].id);
        else setChildWarehouseId(whList[0].id);
      }
      if (prodList.length > 0 && !selectedProductId) {
        setSelectedProductId(prodList[0].id);
        setTransferCost(Number(prodList[0].standardCost || 500));
        setSellingPrice(Number(prodList[0].defaultSellingPrice || 550));
      }
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load transfer data', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [showToast, parentCompanyId, parentWarehouseId, selectedProductId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Finished Product selection to update default prices
  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setTransferCost(Number(prod.standardCost || 500));
      setSellingPrice(Number(prod.defaultSellingPrice || 550));
    }
  };

  // Execute Transfer
  const handleTransfer = async () => {
    if (!parentCompanyId || !childCompanyId) {
      showToast({ title: 'Validation', message: 'Please select Parent and Child company', type: 'warning' });
      return;
    }
    if (parentCompanyId === childCompanyId) {
      showToast({ title: 'Validation', message: 'Parent and Child company cannot be identical', type: 'warning' });
      return;
    }
    if (!selectedProductId) {
      showToast({ title: 'Validation', message: 'Please select a finished product', type: 'warning' });
      return;
    }
    if (quantity <= 0) {
      showToast({ title: 'Validation', message: 'Quantity must be greater than zero', type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await ApiClient.post<any>('/api/v1/operations/intercompany/transfer', {
        parentCompanyId,
        childCompanyId,
        finishedProductId: selectedProductId,
        parentWarehouseId,
        childWarehouseId,
        quantity,
        transferCost,
        sellingPrice,
        notes: transferNotes,
      });

      showToast({
        title: 'Transfer Completed!',
        message: `Parent Sale (${res.data?.parentSale?.invoiceNumber}) & Child Purchase (${res.data?.childPurchase?.voucherNumber}) posted atomically!`,
        type: 'success',
      });

      loadData();
    } catch (err: any) {
      showToast({ title: 'Transfer Failed', message: err?.message || 'Error executing intercompany transfer', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalTransferAmount = quantity * sellingPrice;
  const marginPerUnit = sellingPrice - transferCost;
  const marginPercent = transferCost > 0 ? ((marginPerUnit / transferCost) * 100).toFixed(1) : '0';

  const columns: ColumnDef<IntercompanyTransferRecord>[] = [
    { key: 'invoiceNumber', header: 'Transfer / Sale No', render: (t) => <span style={{ fontWeight: 600 }}>{t.invoiceNumber}</span> },
    { key: 'date', header: 'Date', render: (t) => new Date(t.date).toLocaleDateString() },
    { key: 'targetCompany', header: 'Recipient Company', render: (t) => t.targetCompany || 'Child Company' },
    { key: 'warehouse', header: 'Dispatch Warehouse', render: (t) => t.warehouse || 'Central' },
    {
      key: 'items',
      header: 'Products Transferred',
      render: (t) => (t.items || []).map((i) => `${i.productName} (${i.quantity} @ PKR ${i.rate})`).join(', ') || '-',
    },
    { key: 'amount', header: 'Total Value', render: (t) => `PKR ${Number(t.amount || 0).toLocaleString()}` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Intercompany Transfer (Parent → Child Company)
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          One-click atomic transfer: Posts Parent Sale & Stock (-) while automatically creating Child Purchase & Stock (+).
        </p>
      </div>

      {/* Transfer Execution Form */}
      <Card>
        <CardHeader>
          <CardTitle>Execute Intercompany Transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {/* Companies */}
            <Select
              label="Source Parent Company"
              value={parentCompanyId}
              onChange={(e) => setParentCompanyId(e.target.value)}
              options={companies.map((c) => ({ label: `${c.code} - ${c.name}`, value: c.id }))}
            />
            <Select
              label="Destination Child Company"
              value={childCompanyId}
              onChange={(e) => setChildCompanyId(e.target.value)}
              options={companies.map((c) => ({ label: `${c.code} - ${c.name}`, value: c.id }))}
            />

            {/* Product */}
            <Select
              label="Finished Product"
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              options={products.map((p) => ({ label: `${p.productCode} - ${p.productName}`, value: p.id }))}
            />

            {/* Warehouses */}
            <Select
              label="Parent Warehouse (Stock Out)"
              value={parentWarehouseId}
              onChange={(e) => setParentWarehouseId(e.target.value)}
              options={warehouses.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
            />
            <Select
              label="Child Warehouse (Stock In)"
              value={childWarehouseId}
              onChange={(e) => setChildWarehouseId(e.target.value)}
              options={warehouses.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
            />

            {/* Quantity & Pricing */}
            <Input
              label="Transfer Quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            />
            <Input
              label="Internal Cost Rate (PKR)"
              type="number"
              value={transferCost}
              onChange={(e) => setTransferCost(parseFloat(e.target.value) || 0)}
            />
            <Input
              label="Transfer / Billing Rate (PKR)"
              type="number"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div style={{ marginTop: '16px' }}>
            <Input
              label="Transfer Notes / Reference"
              placeholder="e.g. Monthly replenishment batch #2026-04"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
            />
          </div>

          {/* Transfer Summary KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginTop: '20px',
              padding: '16px',
              background: 'var(--surface-subtle)',
              borderRadius: '8px',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Transfer Value</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--brand-primary)' }}>
                PKR {totalTransferAmount.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Margin per Unit</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>PKR {marginPerUnit.toFixed(2)} ({marginPercent}%)</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Action Preview</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--brand-success)' }}>
                Parent Stock (-{quantity}) & Child Stock (+{quantity})
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <Button variant="primary" onClick={handleTransfer} disabled={isSubmitting}>
              <IconCheck size={16} /> {isSubmitting ? 'Posting Transfer...' : 'POST Intercompany Transfer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transfer History Table */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <CardTitle>Recent Intercompany Transfers</CardTitle>
            <Button variant="secondary" size="sm" onClick={loadData}>
              <IconRefresh size={14} /> Refresh History
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={4} columns={6} />
          ) : history.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', padding: '24px', textAlign: 'center' }}>
              No intercompany transfers recorded yet.
            </p>
          ) : (
            <DataTable columns={columns} data={history} keyExtractor={(t) => t.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
