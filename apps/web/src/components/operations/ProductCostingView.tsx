'use client';

/**
 * SHEHSWAR ONE360 - Product Costing Engine Workspace
 *
 * Full Enterprise UI matching Canonical Shehswar ERP Design System:
 * - ListPageTemplate structure with breadcrumbs and actions
 * - 4 Executive KpiCard metrics (Calculated Cost, Current Cost, Variance, Total Batch Investment)
 * - Dual-Mode selection (Select Existing Finished Product OR Type & Register New Product Name)
 * - Authoritative read-only procurement rates from real Purchase Orders & Inventory
 * - Structured Card-based BOM line items for Raw Materials and Packaging Materials
 * - Transparent arithmetic: (Total RM Cost + Total Packaging Cost) ÷ Output Qty = Cost Per Unit
 * - "ADD TO PRODUCT" atomic transaction with confirmation dialog
 * - Versioned Costing History Modal ($V_1, V_2, V_3$)
 * - Connected directly to live localhost PostgreSQL
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import { ListPageTemplate } from '../templates';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
  KpiCard,
  Modal,
  TableSkeleton,
} from '../ui';
import {
  IconFlask,
  IconPackage,
  IconPlus,
  IconRefresh,
  IconCheck,
  IconTrash,
  IconTrendingUp,
  IconTrendingDown,
  IconFileText,
  IconBuilding,
} from '../icons';

interface RawMaterialItem {
  id: string;
  materialCode: string;
  materialName: string;
  lastPurchaseCost?: number;
  standardCost?: number;
  baseUom?: { name: string; symbol: string };
}

interface PackingMaterialItem {
  id: string;
  materialCode: string;
  materialName: string;
  lastPurchaseCost?: number;
  standardCost?: number;
  baseUom?: { name: string; symbol: string };
  category?: { code: string; name: string };
}

interface CostingLine {
  id: string;
  selectedId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export const ProductCostingView: React.FC = () => {
  const { showToast } = useToast();

  // Mode: 'existing' vs 'new'
  const [productMode, setProductMode] = useState<'existing' | 'new'>('existing');

  // Master Data Catalogs
  const [finishedProducts, setFinishedProducts] = useState<any[]>([]);
  const [rawMaterialsList, setRawMaterialsList] = useState<RawMaterialItem[]>([]);
  const [packingMaterialsList, setPackingMaterialsList] = useState<PackingMaterialItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Existing Product Selection
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // New Product Name Inline Inputs
  const [newProductName, setNewProductName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newPackSize, setNewPackSize] = useState<number>(2);
  const [newPackUnit, setNewPackUnit] = useState('Liter');
  const [newBasePrice, setNewBasePrice] = useState<number>(2800);

  // Batch Parameters
  const [batchOutputQuantity, setBatchOutputQuantity] = useState<number>(100);
  const [packSize, setPackSize] = useState<number>(2);
  const [packSizeUnit, setPackSizeUnit] = useState<string>('Liter');

  // Costing Recipe Component Lines
  const [rmLines, setRmLines] = useState<CostingLine[]>([]);
  const [pmLines, setPmLines] = useState<CostingLine[]>([]);

  // Confirmation & History State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [costingHistory, setCostingHistory] = useState<any[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  // 1. Fetch Masters
  const loadPrerequisites = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fpRes, rmRes, pmRes, catRes] = await Promise.all([
        ApiClient.get<any[]>('/api/v1/master-data/finished-products'),
        ApiClient.get<any[]>('/api/v1/master-data/raw-materials'),
        ApiClient.get<any[]>('/api/v1/master-data/packing-materials'),
        ApiClient.get<any[]>('/api/v1/master-data/unified-categories'),
      ]);

      const fps = Array.isArray(fpRes.data) ? fpRes.data : (fpRes.data as any)?.data || [];
      const rms = Array.isArray(rmRes.data) ? rmRes.data : (rmRes.data as any)?.data || [];
      const pms = Array.isArray(pmRes.data) ? pmRes.data : (pmRes.data as any)?.data || [];
      const cats = Array.isArray(catRes.data) ? catRes.data : (catRes.data as any)?.data || [];

      setFinishedProducts(fps);
      setRawMaterialsList(rms);
      setPackingMaterialsList(pms);
      setCategories(cats);

      // Check if URL has ?product=ID
      if (typeof window !== 'undefined' && window.location.hash.includes('product=')) {
        const prodId = window.location.hash.split('product=')[1]?.split('&')[0];
        if (prodId && fps.some((p: any) => p.id === prodId)) {
          setSelectedProductId(prodId);
        }
      } else if (fps.length > 0 && !selectedProductId) {
        setSelectedProductId(fps[0].id);
      }
    } catch (err: any) {
      showToast({
        title: 'Error',
        message: err?.message || 'Failed to load master data catalogs',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast, selectedProductId]);

  useEffect(() => {
    loadPrerequisites();
  }, [loadPrerequisites]);

  // 2. When Product Changes, sync details & load costing history
  useEffect(() => {
    if (!selectedProductId || finishedProducts.length === 0) return;
    const found = finishedProducts.find((p) => p.id === selectedProductId);
    if (found) {
      setSelectedProduct(found);
      setPackSize(found.packingQuantity || 2);
      setPackSizeUnit(found.packingUnit || 'Liter');

      // Fetch Costing History for this product
      ApiClient.get<any[]>(`/api/v1/costing/product/${selectedProductId}/history`)
        .then((res) => {
          const hist = Array.isArray(res.data) ? res.data : [];
          setCostingHistory(hist);
        })
        .catch(() => {
          setCostingHistory([]);
        });
    }
  }, [selectedProductId, finishedProducts]);

  // Total Production Volume = Output Qty * Pack Size
  const totalVolume = useMemo(() => {
    const ps = productMode === 'new' ? newPackSize : packSize;
    return (Number(batchOutputQuantity) || 0) * (Number(ps) || 0);
  }, [batchOutputQuantity, packSize, newPackSize, productMode]);

  // Initial Recipe Seed when RM/PM catalogs load if lines are empty
  useEffect(() => {
    if (rawMaterialsList.length > 0 && rmLines.length === 0 && rawMaterialsList[0]) {
      const firstRm = rawMaterialsList[0];
      const cost = Number(firstRm.lastPurchaseCost || firstRm.standardCost || 1000);
      setRmLines([
        {
          id: 'rm-1',
          selectedId: firstRm.id,
          quantity: 200,
          unitCost: cost,
          totalCost: 200 * cost,
        },
      ]);
    }
    if (packingMaterialsList.length > 0 && pmLines.length === 0 && packingMaterialsList[0]) {
      const firstPm = packingMaterialsList[0];
      const cost = Number(firstPm.lastPurchaseCost || firstPm.standardCost || 45);
      setPmLines([
        {
          id: 'pm-1',
          selectedId: firstPm.id,
          quantity: 100,
          unitCost: cost,
          totalCost: 100 * cost,
        },
      ]);
    }
  }, [rawMaterialsList, packingMaterialsList, rmLines.length, pmLines.length]);

  // Handlers for RM lines
  const handleAddRmLine = () => {
    const defaultRm = rawMaterialsList[0];
    const cost = Number(defaultRm?.lastPurchaseCost || defaultRm?.standardCost || 0);
    setRmLines((prev) => [
      ...prev,
      {
        id: `rm-${Date.now()}`,
        selectedId: defaultRm?.id || '',
        quantity: 10,
        unitCost: cost,
        totalCost: 10 * cost,
      },
    ]);
  };

  const handleUpdateRmLine = (id: string, field: 'selectedId' | 'quantity', value: any) => {
    setRmLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;

        if (field === 'selectedId') {
          const rm = rawMaterialsList.find((r) => r.id === value);
          const unitCost = Number(rm?.lastPurchaseCost || rm?.standardCost || 0);
          return {
            ...line,
            selectedId: value,
            unitCost,
            totalCost: line.quantity * unitCost,
          };
        } else {
          const qty = Number(value) || 0;
          return {
            ...line,
            quantity: qty,
            totalCost: qty * line.unitCost,
          };
        }
      })
    );
  };

  const handleRemoveRmLine = (id: string) => {
    setRmLines((prev) => prev.filter((l) => l.id !== id));
  };

  // Handlers for PM lines
  const handleAddPmLine = () => {
    const defaultPm = packingMaterialsList[0];
    const cost = Number(defaultPm?.lastPurchaseCost || defaultPm?.standardCost || 0);
    setPmLines((prev) => [
      ...prev,
      {
        id: `pm-${Date.now()}`,
        selectedId: defaultPm?.id || '',
        quantity: batchOutputQuantity || 100,
        unitCost: cost,
        totalCost: (batchOutputQuantity || 100) * cost,
      },
    ]);
  };

  const handleUpdatePmLine = (id: string, field: 'selectedId' | 'quantity', value: any) => {
    setPmLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;

        if (field === 'selectedId') {
          const pm = packingMaterialsList.find((p) => p.id === value);
          const unitCost = Number(pm?.lastPurchaseCost || pm?.standardCost || 0);
          return {
            ...line,
            selectedId: value,
            unitCost,
            totalCost: line.quantity * unitCost,
          };
        } else {
          const qty = Number(value) || 0;
          return {
            ...line,
            quantity: qty,
            totalCost: qty * line.unitCost,
          };
        }
      })
    );
  };

  const handleRemovePmLine = (id: string) => {
    setPmLines((prev) => prev.filter((l) => l.id !== id));
  };

  // Cost Aggregations
  const totalRmCost = useMemo(() => {
    return rmLines.reduce((sum, l) => sum + (Number(l.totalCost) || 0), 0);
  }, [rmLines]);

  const totalPmCost = useMemo(() => {
    return pmLines.reduce((sum, l) => sum + (Number(l.totalCost) || 0), 0);
  }, [pmLines]);

  const totalBatchCost = useMemo(() => {
    return totalRmCost + totalPmCost;
  }, [totalRmCost, totalPmCost]);

  const calculatedCostPerUnit = useMemo(() => {
    const qty = Number(batchOutputQuantity) || 1;
    return qty > 0 ? Math.round((totalBatchCost / qty) * 100) / 100 : 0;
  }, [totalBatchCost, batchOutputQuantity]);

  // Current Standard Cost & Variance
  const currentCost = Number(selectedProduct?.standardCost || 0);
  const costDifference = currentCost > 0 ? calculatedCostPerUnit - currentCost : 0;
  const costDiffPct = currentCost > 0 ? (costDifference / currentCost) * 100 : 0;

  // Commercial Base Price
  const commercialPrice =
    productMode === 'existing'
      ? Number(selectedProduct?.defaultSellingPrice || 0)
      : Number(newBasePrice || 0);
  const grossMargin = commercialPrice > 0 ? commercialPrice - calculatedCostPerUnit : 0;
  const grossMarginPct = commercialPrice > 0 ? (grossMargin / commercialPrice) * 100 : 0;

  // Execute "ADD TO PRODUCT" Atomic Transaction
  const handleApplyCosting = async () => {
    setIsApplying(true);
    try {
      const payload: any = {
        batchOutputQuantity: Number(batchOutputQuantity),
        packSize: productMode === 'new' ? Number(newPackSize) : Number(packSize),
        packSizeUnitName: productMode === 'new' ? newPackUnit : packSizeUnit,
        totalRawMaterialCost: totalRmCost,
        totalPackagingCost: totalPmCost,
        totalBatchCost,
        costPerUnit: calculatedCostPerUnit,
        rawMaterials: rmLines.map((l) => ({
          rawMaterialId: l.selectedId,
          quantity: l.quantity,
          unitCost: l.unitCost,
          totalCost: l.totalCost,
        })),
        packagingMaterials: pmLines.map((l) => ({
          packingMaterialId: l.selectedId,
          quantity: l.quantity,
          unitCost: l.unitCost,
          totalCost: l.totalCost,
        })),
      };

      if (productMode === 'existing') {
        payload.finishedProductId = selectedProductId;
      } else {
        payload.newProductName = newProductName.trim();
        payload.categoryId = newCategoryId || undefined;
        payload.packSizeQuantity = Number(newPackSize);
        payload.packSizeUnit = newPackUnit;
        payload.baseSellingPrice = Number(newBasePrice);
      }

      const res = await ApiClient.post<any>('/api/v1/costing/apply-to-product', payload);

      showToast({
        title: 'Costing Applied Successfully',
        message: res.data?.message || `Costing snapshot saved and applied to Finished Product.`,
        type: 'success',
      });

      setIsConfirmModalOpen(false);
      loadPrerequisites();
    } catch (err: any) {
      showToast({
        title: 'Application Error',
        message: err.response?.data?.message || err.message || 'Failed to apply costing to product',
        type: 'error',
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <ListPageTemplate
      title="Product Costing Engine"
      subtitle="Authoritative finished product manufacturing cost calculator, batch allocation, procurement rates connection, and atomic product updates."
      breadcrumbs={[
        { label: 'Operations', href: '#' },
        { label: 'Product Costing Engine' },
      ]}
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            startIcon={<IconRefresh size={14} />}
            onClick={loadPrerequisites}
          >
            Refresh Rates
          </Button>
          <Button
            variant="outline"
            size="sm"
            startIcon={<IconFileText size={14} />}
            onClick={() => setIsHistoryDrawerOpen(true)}
          >
            Costing History ({costingHistory.length})
          </Button>
          <Button
            variant="primary"
            size="sm"
            startIcon={<IconCheck size={14} />}
            onClick={() => setIsConfirmModalOpen(true)}
            style={{ backgroundColor: '#10B981', borderColor: '#10B981', color: '#fff' }}
          >
            ADD TO PRODUCT
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={6} columns={4} />
      ) : (
        <>
          {/* 4 Executive KPI Metrics Cards matching Shehswar ERP */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
        <KpiCard
          title="Calculated Manufacturing Cost"
          value={`PKR ${calculatedCostPerUnit.toLocaleString()} / Pack`}
          subtitle={`Batch Output: ${batchOutputQuantity} Units (${totalVolume} Liters)`}
          icon={<IconFlask size={20} />}
          accentColor="#10B981"
        />
        <KpiCard
          title="Master Standard Cost"
          value={currentCost > 0 ? `PKR ${currentCost.toLocaleString()} / Pack` : 'Not Configured'}
          subtitle={
            productMode === 'existing'
              ? `${selectedProduct?.productCode || 'FG-Item'} Standard Cost`
              : 'New Formulation Setup'
          }
          icon={<IconPackage size={20} />}
          accentColor="#6366F1"
        />
        <KpiCard
          title="Cost Variance vs Master"
          value={
            currentCost > 0
              ? `${costDifference >= 0 ? '+' : ''}PKR ${costDifference.toFixed(2)} (${costDiffPct.toFixed(1)}%)`
              : 'Baseline V1'
          }
          subtitle={
            costDifference < 0
              ? 'Savings achieved vs master standard'
              : costDifference > 0
              ? 'Cost increase vs master standard'
              : 'Exact parity with master standard'
          }
          icon={costDifference <= 0 ? <IconTrendingDown size={20} /> : <IconTrendingUp size={20} />}
          accentColor={costDifference <= 0 ? '#10B981' : '#F59E0B'}
        />
        <KpiCard
          title="Total Batch Investment"
          value={`PKR ${totalBatchCost.toLocaleString()}`}
          subtitle={`RM: PKR ${totalRmCost.toLocaleString()} | PM: PKR ${totalPmCost.toLocaleString()}`}
          icon={<IconBuilding size={20} />}
          accentColor="#06B6D4"
        />
      </div>

      {/* Product Selection & Batch Parameters Card */}
      <Card style={{ marginBottom: '20px' }}>
        <CardHeader style={{ padding: '16px 20px 8px 20px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <CardTitle style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                Product Selection & Batch Volume Parameters
              </CardTitle>
              <p style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                Select an existing product or type a new product name inline to calculate and assign manufacturing cost.
              </p>
            </div>

            {/* Segmented Mode Switcher */}
            <div style={{ display: 'flex', gap: '6px', background: '#F1F5F9', padding: '4px', borderRadius: '8px' }}>
              <Button
                variant={productMode === 'existing' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setProductMode('existing')}
                style={{ fontSize: '0.78rem', height: '30px' }}
              >
                Select Existing Finished Product
              </Button>
              <Button
                variant={productMode === 'new' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setProductMode('new')}
                style={{ fontSize: '0.78rem', height: '30px' }}
              >
                + Type & Add New Product Name
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent style={{ padding: '16px 20px' }}>
          {productMode === 'existing' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Target Finished Product *
                </label>
                <Select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(typeof e === 'string' ? e : e.target?.value || '')}
                  options={finishedProducts.map((p) => ({
                    label: `${p.productCode} — ${p.productName} (${p.packingQuantity || 2} ${p.packingUnit || 'L'})`,
                    value: p.id,
                  }))}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Batch Output Quantity (Units / Bottles) *
                </label>
                <Input
                  type="number"
                  value={batchOutputQuantity}
                  onChange={(e) => setBatchOutputQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  placeholder="e.g. 100"
                  style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Pack Size & Unit
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Input
                    type="number"
                    value={packSize}
                    onChange={(e) => setPackSize(parseFloat(e.target.value) || 1)}
                    style={{ width: '90px', fontFamily: 'var(--font-mono, monospace)' }}
                  />
                  <Input
                    value={packSizeUnit}
                    onChange={(e) => setPackSizeUnit(e.target.value)}
                    placeholder="Unit (Liter)"
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>Total Production Volume:</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#2563EB', fontFamily: 'var(--font-mono, monospace)' }}>
                  {totalVolume} {packSizeUnit}s
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  New Product Name *
                </label>
                <Input
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="e.g. Chlorpyrifos 40% EC Max"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Category
                </label>
                <Select
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(typeof e === 'string' ? e : e.target?.value || '')}
                  options={[
                    { label: '41-01 Finished Goods (Default)', value: '' },
                    ...categories.map((c) => ({
                      label: `${c.code ? `[${c.code}] ` : ''}${c.name}`,
                      value: c.id,
                    })),
                  ]}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Pack Size & Unit *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Input
                    type="number"
                    value={newPackSize}
                    onChange={(e) => setNewPackSize(parseFloat(e.target.value) || 1)}
                    style={{ width: '80px', fontFamily: 'var(--font-mono, monospace)' }}
                  />
                  <Select
                    value={newPackUnit}
                    onChange={(e) => setNewPackUnit(typeof e === 'string' ? e : e.target?.value || 'Liter')}
                    options={[
                      { label: 'Liter', value: 'Liter' },
                      { label: 'KG', value: 'KG' },
                      { label: 'ML', value: 'ML' },
                      { label: 'GM', value: 'GM' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Batch Output Quantity (Units) *
                </label>
                <Input
                  type="number"
                  value={batchOutputQuantity}
                  onChange={(e) => setBatchOutputQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  placeholder="e.g. 100"
                  style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Base Commercial Price (PKR)
                </label>
                <Input
                  type="number"
                  value={newBasePrice}
                  onChange={(e) => setNewBasePrice(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 2800"
                  style={{ fontFamily: 'var(--font-mono, monospace)' }}
                />
              </div>

              <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>Total Production Volume:</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#2563EB', fontFamily: 'var(--font-mono, monospace)' }}>
                  {totalVolume} {newPackUnit}s
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two Formula Breakdown Cards Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        {/* Card 1: Raw Materials Breakdown */}
        <Card>
          <CardHeader style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <CardTitle style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
                1. Raw Materials Breakdown
              </CardTitle>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Authoritative read-only rates from procurement records
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              startIcon={<IconPlus size={14} />}
              onClick={handleAddRmLine}
              style={{ fontSize: '0.75rem', height: '28px' }}
            >
              + Add Raw Material
            </Button>
          </CardHeader>

          <CardContent style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rmLines.map((line, idx) => (
                <div
                  key={line.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr auto',
                    gap: '10px',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: '#F8FAFC',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748B', marginBottom: '4px' }}>
                      Raw Material #{idx + 1}
                    </label>
                    <Select
                      value={line.selectedId}
                      onChange={(e) => handleUpdateRmLine(line.id, 'selectedId', typeof e === 'string' ? e : e.target?.value)}
                      options={rawMaterialsList.map((r) => ({
                        label: `${r.materialCode} — ${r.materialName}`,
                        value: r.id,
                      }))}
                    />
                    <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '3px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                      Rate: PKR {Number(line.unitCost).toLocaleString()} / {rawMaterialsList.find((r) => r.id === line.selectedId)?.baseUom?.symbol || 'L'}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748B', marginBottom: '4px' }}>
                      Batch Qty
                    </label>
                    <Input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => handleUpdateRmLine(line.id, 'quantity', e.target.value)}
                      style={{ fontFamily: 'var(--font-mono, monospace)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748B', marginBottom: '4px' }}>
                      Total Cost
                    </label>
                    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: '#0F172A', fontSize: '0.85rem' }}>
                      PKR {line.totalCost.toLocaleString()}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<IconTrash size={14} />}
                    onClick={() => handleRemoveRmLine(line.id)}
                    style={{ color: '#EF4444', height: '32px', width: '32px', padding: 0 }}
                    title="Remove Line"
                  />
                </div>
              ))}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: '#EEF2FF',
                  borderRadius: '8px',
                  border: '1px solid #C7D2FE',
                  marginTop: '8px',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#3730A3' }}>
                  Total Raw Material Batch Cost:
                </span>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#312E81', fontFamily: 'var(--font-mono, monospace)' }}>
                  PKR {totalRmCost.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Packaging Materials Breakdown */}
        <Card>
          <CardHeader style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <CardTitle style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
                2. Packaging Materials Breakdown
              </CardTitle>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Bottles, Cartons, Shrink, Labels, Caps & Tape rates
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              startIcon={<IconPlus size={14} />}
              onClick={handleAddPmLine}
              style={{ fontSize: '0.75rem', height: '28px' }}
            >
              + Add Packaging Material
            </Button>
          </CardHeader>

          <CardContent style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pmLines.map((line, idx) => (
                <div
                  key={line.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr auto',
                    gap: '10px',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: '#F8FAFC',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748B', marginBottom: '4px' }}>
                      Packaging Material #{idx + 1}
                    </label>
                    <Select
                      value={line.selectedId}
                      onChange={(e) => handleUpdatePmLine(line.id, 'selectedId', typeof e === 'string' ? e : e.target?.value)}
                      options={packingMaterialsList.map((p) => ({
                        label: `${p.materialCode} — ${p.materialName}${p.category ? ` [${p.category.name}]` : ''}`,
                        value: p.id,
                      }))}
                    />
                    <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '3px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                      Rate: PKR {Number(line.unitCost).toLocaleString()} / Unit
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748B', marginBottom: '4px' }}>
                      Required Qty
                    </label>
                    <Input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => handleUpdatePmLine(line.id, 'quantity', e.target.value)}
                      style={{ fontFamily: 'var(--font-mono, monospace)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#64748B', marginBottom: '4px' }}>
                      Total Cost
                    </label>
                    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: '#0F172A', fontSize: '0.85rem' }}>
                      PKR {line.totalCost.toLocaleString()}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<IconTrash size={14} />}
                    onClick={() => handleRemovePmLine(line.id)}
                    style={{ color: '#EF4444', height: '32px', width: '32px', padding: 0 }}
                    title="Remove Line"
                  />
                </div>
              ))}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: '#FEF3C7',
                  borderRadius: '8px',
                  border: '1px solid #FDE68A',
                  marginTop: '8px',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#92400E' }}>
                  Total Packaging Batch Cost:
                </span>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#78350F', fontFamily: 'var(--font-mono, monospace)' }}>
                  PKR {totalPmCost.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Arithmetic Summary & Impact Analysis Card */}
      <Card style={{ marginBottom: '24px' }}>
        <CardContent style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Batch Costing Arithmetic Formula
              </div>
              <div style={{ fontSize: '0.9rem', color: '#1E293B', marginTop: '6px', lineHeight: 1.6 }}>
                (RM: <strong>PKR {totalRmCost.toLocaleString()}</strong> + PM: <strong>PKR {totalPmCost.toLocaleString()}</strong>) = <strong>PKR {totalBatchCost.toLocaleString()}</strong>
                <br />
                Divided by <strong>{batchOutputQuantity} Output Units</strong> =
              </div>
              <div style={{ marginTop: '10px', fontSize: '1.75rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono, monospace)' }}>
                PKR {calculatedCostPerUnit.toLocaleString()} <span style={{ fontSize: '0.9rem', color: '#64748B' }}>/ Pack</span>
              </div>
            </div>

            <div style={{ padding: '14px 18px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Commercial Pricing & Gross Margin
              </div>
              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748B' }}>Commercial Base Selling Price:</span>
                <strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  {commercialPrice > 0 ? `PKR ${commercialPrice.toLocaleString()}` : 'Not Set'}
                </strong>
              </div>
              <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748B' }}>Calculated Manufacturing Cost:</span>
                <strong style={{ fontFamily: 'var(--font-mono, monospace)', color: '#059669' }}>
                  PKR {calculatedCostPerUnit.toLocaleString()}
                </strong>
              </div>
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>Estimated Gross Profit:</span>
                <strong style={{ fontFamily: 'var(--font-mono, monospace)', color: grossMargin >= 0 ? '#059669' : '#DC2626' }}>
                  PKR {grossMargin.toFixed(2)} ({grossMarginPct.toFixed(1)}%)
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
              <Button
                variant="primary"
                size="lg"
                startIcon={<IconCheck size={18} />}
                onClick={() => setIsConfirmModalOpen(true)}
                style={{
                  backgroundColor: '#10B981',
                  borderColor: '#10B981',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  height: '46px',
                }}
              >
                ADD TO PRODUCT
              </Button>
              <span style={{ fontSize: '0.72rem', color: '#64748B', textAlign: 'center' }}>
                Creates immutable versioned snapshot and updates product standardCost.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title="Confirm Costing Application (ADD TO PRODUCT)"
          description="Authoritative update to Finished Product standard cost"
          size="md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)} disabled={isApplying}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleApplyCosting}
                isLoading={isApplying}
                style={{ backgroundColor: '#10B981', borderColor: '#10B981', color: '#fff' }}
              >
                {isApplying ? 'Applying Transaction...' : 'Confirm & Apply'}
              </Button>
            </div>
          }
        >
          <div style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 12px 0' }}>
              You are applying a calculated manufacturing cost of{' '}
              <strong style={{ color: '#059669', fontFamily: 'var(--font-mono, monospace)' }}>
                PKR {calculatedCostPerUnit.toLocaleString()} / Pack
              </strong>{' '}
              to{' '}
              <strong>
                {productMode === 'existing'
                  ? selectedProduct?.productName || 'Finished Product'
                  : newProductName || 'New Product'}
              </strong>
              .
            </p>
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '12px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '4px' }}>Transaction Guarantees:</div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', color: '#475569' }}>
                <li>Product ID and Product Code remain 100% unchanged.</li>
                <li>Base Selling Price remains preserved.</li>
                <li>Immutable versioned snapshot ($V_{costingHistory.length + 1}$) recorded in audit history.</li>
                <li>Procurement rate linkages preserved.</li>
              </ul>
            </div>
          </div>
        </Modal>
      )}

          {/* Costing History Modal */}
          {isHistoryDrawerOpen && (
            <Modal
              isOpen={isHistoryDrawerOpen}
              onClose={() => setIsHistoryDrawerOpen(false)}
              title="Costing Version History"
              description={`Versioned snapshots for ${selectedProduct?.productName || 'Finished Product'}`}
              size="lg"
              footer={
                <Button variant="outline" size="sm" onClick={() => setIsHistoryDrawerOpen(false)}>
                  Close History
                </Button>
              }
            >
              {costingHistory.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '0.85rem' }}>
                  No historical costing snapshots found for this product. Click &quot;ADD TO PRODUCT&quot; to record Version 1.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {costingHistory.map((hist) => (
                    <div
                      key={hist.id}
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        background: hist.status === 'ACTIVE' ? '#F0FDF4' : '#F8FAFC',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: hist.status === 'ACTIVE' ? '#DCFCE7' : '#E2E8F0',
                              color: hist.status === 'ACTIVE' ? '#166534' : '#475569',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              fontFamily: 'var(--font-mono, monospace)',
                            }}
                          >
                            Version {hist.version}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                            {new Date(hist.createdAt).toLocaleDateString()} {new Date(hist.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>
                          PKR {Number(hist.costPerUnit).toLocaleString()} / Pack
                        </div>
                      </div>

                      <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#475569', display: 'flex', gap: '16px' }}>
                        <span>Batch Output: {hist.batchOutputQuantity} Units</span>
                        <span>Total RM: PKR {Number(hist.totalRawMaterialCost).toLocaleString()}</span>
                        <span>Total Packaging: PKR {Number(hist.totalPackagingCost).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Modal>
          )}
        </>
      )}
    </ListPageTemplate>
  );
};
