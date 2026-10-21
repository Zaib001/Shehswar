'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  DataTable,
  KpiCard,
  StatusBadge,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Badge,
} from '../ui';
import { useToast } from '../../context/toast-context';
import {
  IconCheck,
  IconPlus,
  IconRefresh,
  IconFlask,
  IconPackage,
  IconDownload,
  IconBuilding,
} from '../icons';
import { exportBomToPdf } from '../../lib/pdf-export';

interface BomComponent {
  id?: string;
  componentType: 'RAW_MATERIAL' | 'PACKING_MATERIAL';
  rawMaterialId?: string;
  packingMaterialId?: string;
  rawMaterialTotalCost?: number | string;
  quantity: number | string;
  uomId?: string;
  expectedWastagePercent?: number | string;
  notes?: string;
  rawMaterial?: { materialCode: string; materialName: string; standardCost?: number; totalPurchasedValue?: number; costPerBaseUnit?: number };
  packingMaterial?: { materialCode: string; materialName: string; standardCost?: number; lastPurchaseCost?: number };
  uom?: { code: string; symbol: string };
}

interface FormulaBom {
  id: string;
  formulaCode: string;
  version: number;
  standardBatchSize: number;
  packSizeLiters?: number;
  batchSizeUomId?: string;
  finishedProductId: string;
  status: string;
  approvalStatus: string;
  notes?: string;
  finishedProduct?: { productCode: string; productName: string; standardCost?: number; packSize?: { quantity?: number; name?: string } };
  batchSizeUom?: { code: string; symbol: string };
  components?: BomComponent[];
}

export const FormulaBomsView: React.FC = () => {
  const [boms, setBoms] = useState<FormulaBom[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [packingMaterials, setPackingMaterials] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit' | 'detail'>('list');
  const [selectedBom, setSelectedBom] = useState<FormulaBom | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState<{
    formulaCode: string;
    finishedProductId: string;
    standardBatchSize: string;
    packSizeLiters: string;
    batchSizeUomId: string;
    notes: string;
    components: BomComponent[];
  }>({
    formulaCode: '',
    finishedProductId: '',
    standardBatchSize: '200',
    packSizeLiters: '2',
    batchSizeUomId: '',
    notes: '',
    components: [
      {
        componentType: 'RAW_MATERIAL',
        rawMaterialId: '',
        rawMaterialTotalCost: '300000',
        quantity: '400',
        expectedWastagePercent: '0',
        notes: 'Bulk Technical Chemical Input',
      },
      {
        componentType: 'PACKING_MATERIAL',
        packingMaterialId: '',
        quantity: '200',
        expectedWastagePercent: '0',
        notes: '2L Packaging Bottle with induction cap',
      },
    ],
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [bomRes, fpRes, rmRes, pmRes, uomRes] = await Promise.all([
        ApiClient.get<FormulaBom[]>('/api/v1/master-data/formula-boms'),
        ApiClient.get<any[]>('/api/v1/master-data/finished-products'),
        ApiClient.get<any[]>('/api/v1/master-data/raw-materials'),
        ApiClient.get<any[]>('/api/v1/master-data/packing-materials'),
        ApiClient.get<any[]>('/api/v1/master-data/uoms'),
      ]);
      setBoms(bomRes.data || []);
      setFinishedProducts(fpRes.data || []);
      setRawMaterials(rmRes.data || []);
      setPackingMaterials(pmRes.data || []);
      setUoms(uomRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load Formula BOMs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddComponent = (type: 'RAW_MATERIAL' | 'PACKING_MATERIAL') => {
    const prodQty = Number(formData.standardBatchSize) || 200;
    const pSize = Number(formData.packSizeLiters) || 2;
    const totVol = prodQty * pSize;

    setFormData((prev) => ({
      ...prev,
      components: [
        ...prev.components,
        {
          componentType: type,
          rawMaterialId: type === 'RAW_MATERIAL' ? rawMaterials[0]?.id : undefined,
          packingMaterialId: type === 'PACKING_MATERIAL' ? packingMaterials[0]?.id : undefined,
          rawMaterialTotalCost: type === 'RAW_MATERIAL' ? '300000' : undefined,
          quantity: type === 'RAW_MATERIAL' ? String(totVol) : String(prodQty),
          expectedWastagePercent: '0',
          notes: '',
        },
      ],
    }));
  };

  const handleRemoveComponent = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }));
  };

  const handleComponentChange = (index: number, field: keyof BomComponent, value: any) => {
    setFormData((prev) => {
      const next = [...prev.components];
      next[index] = { ...next[index], [field]: value } as BomComponent;
      return { ...prev, components: next };
    });
  };

  // Dynamic Calculation:
  // Production Quantity = Number of Packs (e.g. 200)
  // Pack Size = Liters per Pack (e.g. 2L)
  // Total Volume = Production Quantity × Pack Size (e.g. 200 × 2 = 400 Liters)
  const productionQuantity = Number(formData.standardBatchSize) || 200;
  const packSizeLiters = Number(formData.packSizeLiters) || 2;
  const totalProductionVolume = productionQuantity * packSizeLiters;

  const getComponentCostInfo = (comp: BomComponent) => {
    let uomSymbol = '';
    let matName = '';
    let matCode = '';

    if (comp.componentType === 'RAW_MATERIAL') {
      const rm = rawMaterials.find(
        (r) => r.id === comp.rawMaterialId || r.code === comp.rawMaterialId || r.materialCode === comp.rawMaterialId
      );
      if (rm) {
        uomSymbol = rm.uom?.symbol || rm.baseUom?.symbol || rm.uom?.code || 'LTR';
        matName = rm.materialName || rm.name;
        matCode = rm.materialCode || rm.code;
      }

      // Raw Material Total Cost (e.g. 300,000 PKR)
      const rmTotalCost = comp.rawMaterialTotalCost !== undefined && comp.rawMaterialTotalCost !== ''
        ? Number(comp.rawMaterialTotalCost)
        : (Number(rm?.totalPurchasedValue || rm?.standardCost || 300000));

      // Required Formula:
      // Cost per Liter = Total Raw Material Cost ÷ (Number of Packs × Pack Size)
      const costPerLiter = totalProductionVolume > 0 ? rmTotalCost / totalProductionVolume : 0;
      // Cost per Pack = Cost per Liter × Pack Size
      const rmCostPerPack = costPerLiter * packSizeLiters;

      return {
        rmTotalCost,
        costPerLiter,
        rmCostPerPack,
        productionQuantity,
        packSize: packSizeLiters,
        totalVolume: totalProductionVolume,
        uomSymbol,
        matName,
        matCode,
        effectiveQty: totalProductionVolume,
        totalCost: rmTotalCost, // Total batch RM cost
      };
    } else {
      const pm = packingMaterials.find(
        (p) => p.id === comp.packingMaterialId || p.code === comp.packingMaterialId || p.materialCode === comp.packingMaterialId
      );
      let pmUnitCost = 0;
      if (pm) {
        pmUnitCost = Number(pm.lastPurchaseCost || pm.standardCost || 0);
        uomSymbol = pm.uom?.symbol || pm.baseUom?.symbol || pm.uom?.code || 'PCS';
        matName = pm.materialName || pm.name;
        matCode = pm.materialCode || pm.code;
      }

      const unitsPerPack = Number(comp.quantity) > 0 && productionQuantity > 0
        ? (Number(comp.quantity) >= productionQuantity ? Number(comp.quantity) / productionQuantity : Number(comp.quantity))
        : 1;
      const pmCostPerPack = pmUnitCost * unitsPerPack;
      const totalCost = pmCostPerPack * productionQuantity;

      return {
        pmUnitCost,
        pmCostPerPack,
        unitsPerPack,
        productionQuantity,
        packSize: packSizeLiters,
        totalVolume: totalProductionVolume,
        uomSymbol,
        matName,
        matCode,
        effectiveQty: unitsPerPack * productionQuantity,
        totalCost,
      };
    }
  };

  const resolveComponentUnitCost = (comp: any, parentBom?: any) => {
    if (comp.componentType === 'RAW_MATERIAL') {
      const rm = rawMaterials.find(
        (r) =>
          r.id === comp.rawMaterialId ||
          r.code === comp.rawMaterialId ||
          r.materialCode === comp.rawMaterialId ||
          (comp.rawMaterial?.materialCode && (r.materialCode === comp.rawMaterial?.materialCode || r.code === comp.rawMaterial?.materialCode))
      );
      const rmRaw = Number(rm?.totalPurchasedValue || rm?.standardCost || comp.rawMaterial?.standardCost || 300000);
      const pQty = Number(parentBom?.standardBatchSize || 200);
      const pSize = Number(parentBom?.finishedProduct?.packSize?.quantity || 2);
      const totVol = pQty * pSize;
      const costPerLiter = totVol > 0 ? rmRaw / totVol : 0;
      return costPerLiter * pSize; // Cost per pack
    } else {
      const pm = packingMaterials.find(
        (p) =>
          p.id === comp.packingMaterialId ||
          p.code === comp.packingMaterialId ||
          p.materialCode === comp.packingMaterialId ||
          (comp.packingMaterial?.materialCode && (p.materialCode === comp.packingMaterial?.materialCode || p.code === comp.packingMaterial?.materialCode))
      );
      return Number(pm?.lastPurchaseCost || pm?.standardCost || comp.packingMaterial?.standardCost || 0);
    }
  };

  let rawMaterialsTotal = 0;
  let packagingTotal = 0;

  formData.components.forEach((c) => {
    const info = getComponentCostInfo(c);
    if (c.componentType === 'RAW_MATERIAL') {
      rawMaterialsTotal += info.totalCost;
    } else {
      packagingTotal += info.totalCost;
    }
  });

  const totalBatchCost = rawMaterialsTotal + packagingTotal;
  const unitCost = productionQuantity > 0 ? totalBatchCost / productionQuantity : 0;

  const handleSave = async () => {
    if (!formData.formulaCode || !formData.finishedProductId) {
      showToast({ title: 'Validation Error', message: 'Formula Code and Target Finished Product are required', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'create') {
        const payload = {
          formulaCode: formData.formulaCode.toUpperCase(),
          finishedProductId: formData.finishedProductId,
          standardBatchSize: Number(formData.standardBatchSize) || 1000,
          batchSizeUomId: formData.batchSizeUomId || undefined,
          notes: formData.notes,
          components: formData.components.map((c) => ({
            componentType: c.componentType,
            rawMaterialId: c.componentType === 'RAW_MATERIAL' ? c.rawMaterialId : undefined,
            packingMaterialId: c.componentType === 'PACKING_MATERIAL' ? c.packingMaterialId : undefined,
            quantity: Number(c.quantity) || 0,
            uomId: c.uomId || undefined,
            expectedWastagePercent: Number(c.expectedWastagePercent) || 0,
            notes: c.notes,
          })),
        };
        await ApiClient.post('/api/v1/master-data/formula-boms', payload);
        showToast({ title: 'Success', message: `Formula BOM created (Unit Cost: ${unitCost.toFixed(2)} PKR synced)`, type: 'success' });
      } else if (mode === 'edit' && selectedBom) {
        await ApiClient.patch(`/api/v1/master-data/formula-boms/${selectedBom.id}`, {
          notes: formData.notes,
        });
        showToast({ title: 'Updated', message: 'Formula BOM updated successfully', type: 'success' });
      }
      setMode('list');
      fetchData();
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (bom: FormulaBom) => {
    try {
      await ApiClient.patch(`/api/v1/master-data/formula-boms/${bom.id}`, {
        approvalStatus: 'APPROVED',
        status: 'ACTIVE',
      });
      showToast({ title: 'Formula Approved', message: `Formula ${bom.formulaCode} is now active for manufacturing`, type: 'success' });
      fetchData();
    } catch (err: any) {
      showToast({ title: 'Approval Failed', message: err.message, type: 'error' });
    }
  };

  const filtered = boms.filter((b) => {
    const matchesSearch =
      b.formulaCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.finishedProduct?.productName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.finishedProduct?.productCode || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      key: 'formulaCode',
      header: 'Formula Code',
      render: (row: FormulaBom) => (
        <div>
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-brand-600)' }}>
            {row.formulaCode}
          </span>
          <span style={{ marginLeft: 'var(--space-xs)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            v{row.version}
          </span>
        </div>
      ),
    },
    {
      key: 'finishedProduct',
      header: 'Target Finished Product',
      render: (row: FormulaBom) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.finishedProduct?.productName || '—'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {row.finishedProduct?.productCode}
          </div>
        </div>
      ),
    },
    {
      key: 'batchSize',
      header: 'Batch Yield Size',
      render: (row: FormulaBom) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {Number(row.standardBatchSize).toLocaleString()} {row.batchSizeUom?.symbol || 'Units'}
        </span>
      ),
    },
    {
      key: 'unitCost',
      header: 'Std Unit Cost',
      render: (row: FormulaBom) => {
        let calcBatch = 0;
        (row.components || []).forEach((c) => {
          const waste = Number(c.expectedWastagePercent) || 0;
          const effQty = Number(c.quantity) * (1 + waste / 100);
          const cCost = resolveComponentUnitCost(c);
          calcBatch += effQty * cCost;
        });
        const unitC =
          Number(row.standardBatchSize) > 0 && calcBatch > 0
            ? calcBatch / Number(row.standardBatchSize)
            : Number(row.finishedProduct?.standardCost || 0);
        return (
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#047857' }}>
            {unitC > 0 ? `${Number(unitC).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR` : '—'}
          </span>
        );
      },
    },
    {
      key: 'components',
      header: 'BOM Items',
      render: (row: FormulaBom) => {
        const rmCount = row.components?.filter((c) => c.componentType === 'RAW_MATERIAL').length || 0;
        const pmCount = row.components?.filter((c) => c.componentType === 'PACKING_MATERIAL').length || 0;
        return (
          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            <Badge variant="info">{rmCount} Chemicals</Badge>
            <Badge variant="secondary">{pmCount} Packaging</Badge>
          </div>
        );
      },
    },
    {
      key: 'approvalStatus',
      header: 'Approval',
      render: (row: FormulaBom) => <StatusBadge status={row.approvalStatus} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: FormulaBom) => (
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportBomToPdf(row, rawMaterials, packingMaterials)}
            title="Download Official BOM Specification (PDF)"
          >
            <IconDownload size={14} /> PDF
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedBom(row);
              setMode('detail');
            }}
          >
            Cost Breakdown
          </Button>
          {row.approvalStatus !== 'APPROVED' && (
            <Button size="sm" variant="outline" onClick={() => handleApprove(row)}>
              <IconCheck size={14} /> Approve
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (mode === 'create' || mode === 'edit') {
    return (
      <FormPageTemplate
        title={mode === 'create' ? 'Create Master Formula / Bill of Materials (BOM)' : `Edit Formula ${selectedBom?.formulaCode}`}
        subtitle="Specify standard batch quantity, recipe inputs, raw chemical actives, packaging requirements, and live cost rollups"
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Formula BOM', href: '#' },
          { label: mode === 'create' ? 'New Formula' : 'Edit' },
        ]}
        onCancel={() => setMode('list')}
        onSave={handleSave}
        isSaving={isSaving}
        sections={[
          {
            title: 'Recipe Header',
            description: 'Core identifying formulation code and commercial finished product reference',
            fields: [
              {
                label: 'Formula Code',
                required: true,
                field: (
                  <Input
                    value={formData.formulaCode}
                    onChange={(e) => setFormData({ ...formData, formulaCode: e.target.value })}
                    placeholder="e.g. BOM-BIO-GROW-1L-V1"
                    disabled={mode === 'edit'}
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                ),
              },
              {
                label: 'Finished Product',
                required: true,
                field: (
                  <Select
                    value={formData.finishedProductId}
                    onChange={(e) => {
                      const fpId = e.target.value;
                      const fp = finishedProducts.find((p) => p.id === fpId);
                      const packQty = fp?.packSize?.quantity ? String(fp.packSize.quantity) : (formData.packSizeLiters || '2');
                      setFormData({
                        ...formData,
                        finishedProductId: fpId,
                        packSizeLiters: packQty,
                      });
                    }}
                    disabled={mode === 'edit'}
                    options={[
                      { value: '', label: 'Select Finished Product...' },
                      ...finishedProducts.map((p) => ({
                        value: p.id,
                        label: `${p.productCode} - ${p.productName}`,
                      })),
                    ]}
                  />
                ),
              },
              {
                label: 'Production Quantity (Number of Finished Packs)',
                required: true,
                field: (
                  <Input
                    type="number"
                    value={formData.standardBatchSize}
                    onChange={(e) => setFormData({ ...formData, standardBatchSize: e.target.value })}
                    placeholder="e.g. 200 Packs"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                ),
              },
              {
                label: 'Pack Size (Liters per Pack)',
                required: true,
                field: (
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.packSizeLiters}
                    onChange={(e) => setFormData({ ...formData, packSizeLiters: e.target.value })}
                    placeholder="e.g. 2 Liters"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                ),
              },
              {
                label: 'Total Production Volume (Liters)',
                field: (
                  <div
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: '#1E40AF',
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><IconFlask size={14} /> Total Volume:</span>
                    <span>
                      {totalProductionVolume.toLocaleString()} Liters ({productionQuantity} Packs × {packSizeLiters}L)
                    </span>
                  </div>
                ),
              },
            ],
          },
          {
            title: 'Bill of Materials Component Breakdown',
            description: 'Active chemicals, auxiliary technical ingredients, and rigid packaging components allocated across production packs',
            fields: [
              {
                label: 'Formulation Components',
                field: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {formData.components.map((comp, idx) => {
                      const costInfo = getComponentCostInfo(comp);
                      return (
                        <Card key={idx} style={{ padding: 'var(--space-md)', background: 'var(--bg-card)' }}>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns:
                                comp.componentType === 'RAW_MATERIAL'
                                  ? '140px 1.8fr 160px 130px 1.2fr auto'
                                  : '140px 2.2fr 130px 1.2fr auto',
                              gap: 'var(--space-sm)',
                              alignItems: 'center',
                            }}
                          >
                            <Select
                              value={comp.componentType}
                              onChange={(e) =>
                                handleComponentChange(idx, 'componentType', e.target.value as any)
                              }
                              options={[
                                { value: 'RAW_MATERIAL', label: 'Raw Chemical' },
                                { value: 'PACKING_MATERIAL', label: 'Packaging' },
                              ]}
                            />
                            {comp.componentType === 'RAW_MATERIAL' ? (
                              <>
                                <Select
                                  value={comp.rawMaterialId || ''}
                                  onChange={(e) => {
                                    const rmId = e.target.value;
                                    const rm = rawMaterials.find((r) => r.id === rmId);
                                    const rmCost = rm?.totalPurchasedValue || rm?.standardCost || 300000;
                                    handleComponentChange(idx, 'rawMaterialId', rmId);
                                    handleComponentChange(idx, 'rawMaterialTotalCost', String(rmCost));
                                    handleComponentChange(idx, 'quantity', String(totalProductionVolume));
                                  }}
                                  options={[
                                    { value: '', label: 'Select Raw Material...' },
                                    ...rawMaterials.map((r) => ({
                                      value: r.id,
                                      label: `${r.materialCode} - ${r.materialName} (Total RM Cost: PKR ${Number(r.totalPurchasedValue || r.standardCost || 300000).toLocaleString()})`,
                                    })),
                                  ]}
                                />
                                <div>
                                  <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '2px', fontWeight: 600 }}>
                                    RM Total Cost (PKR)
                                  </label>
                                  <Input
                                    placeholder="Total RM Cost"
                                    type="number"
                                    value={String(comp.rawMaterialTotalCost ?? '300000')}
                                    onChange={(e) => handleComponentChange(idx, 'rawMaterialTotalCost', e.target.value)}
                                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '2px', fontWeight: 600 }}>
                                    Batch Volume (L)
                                  </label>
                                  <Input
                                    placeholder="Total Liters"
                                    type="number"
                                    value={String(comp.quantity || totalProductionVolume)}
                                    onChange={(e) => handleComponentChange(idx, 'quantity', e.target.value)}
                                    style={{ fontFamily: 'var(--font-mono)' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '2px', fontWeight: 600 }}>
                                    Notes
                                  </label>
                                  <Input
                                    placeholder="Component Notes"
                                    value={comp.notes || ''}
                                    onChange={(e) => handleComponentChange(idx, 'notes', e.target.value)}
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <Select
                                  value={comp.packingMaterialId || ''}
                                  onChange={(e) =>
                                    handleComponentChange(idx, 'packingMaterialId', e.target.value)
                                  }
                                  options={[
                                    { value: '', label: 'Select Packing Material...' },
                                    ...packingMaterials.map((p) => ({
                                      value: p.id,
                                      label: `${p.materialCode} - ${p.materialName}${p.standardCost ? ` (${Number(p.standardCost).toLocaleString()} PKR)` : ''}`,
                                    })),
                                  ]}
                                />
                                <div>
                                  <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '2px', fontWeight: 600 }}>
                                    Units Required
                                  </label>
                                  <Input
                                    placeholder="Units"
                                    type="number"
                                    value={String(comp.quantity || productionQuantity)}
                                    onChange={(e) => handleComponentChange(idx, 'quantity', e.target.value)}
                                    style={{ fontFamily: 'var(--font-mono)' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '2px', fontWeight: 600 }}>
                                    Notes
                                  </label>
                                  <Input
                                    placeholder="Notes"
                                    value={comp.notes || ''}
                                    onChange={(e) => handleComponentChange(idx, 'notes', e.target.value)}
                                  />
                                </div>
                              </>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRemoveComponent(idx);
                              }}
                              disabled={formData.components.length <= 1}
                            >
                              Remove
                            </Button>
                          </div>

                          {/* Dynamic Cost Allocation Breakdown per Component */}
                          {comp.componentType === 'RAW_MATERIAL' ? (
                            <div
                              style={{
                                marginTop: '10px',
                                padding: '12px 16px',
                                borderRadius: '8px',
                                background: '#F0FDF4',
                                border: '1.5px solid #86EFAC',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                gap: '12px',
                              }}
                            >
                              <div>
                                <div style={{ color: '#166534', fontSize: '0.72rem', fontWeight: 600 }}>Raw Material Total Cost</div>
                                <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: '#15803D' }}>
                                  PKR {Number(costInfo.rmTotalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div>
                                <div style={{ color: '#166534', fontSize: '0.72rem', fontWeight: 600 }}>Production Quantity</div>
                                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#1e293b' }}>
                                  {costInfo.productionQuantity} Packs
                                </div>
                              </div>
                              <div>
                                <div style={{ color: '#166534', fontSize: '0.72rem', fontWeight: 600 }}>Pack Size</div>
                                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#1e293b' }}>
                                  {costInfo.packSize} Liters
                                </div>
                              </div>
                              <div>
                                <div style={{ color: '#166534', fontSize: '0.72rem', fontWeight: 600 }}>Total Volume</div>
                                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#2563EB' }}>
                                  {costInfo.totalVolume} Liters
                                </div>
                              </div>
                              <div>
                                <div style={{ color: '#166534', fontSize: '0.72rem', fontWeight: 600 }}>Allocated Cost per Liter</div>
                                <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '1rem', color: '#047857' }}>
                                  PKR {Number(costInfo.costPerLiter || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / L
                                </div>
                              </div>
                              <div style={{ borderLeft: '2px solid #86EFAC', paddingLeft: '12px' }}>
                                <div style={{ color: '#065F46', fontSize: '0.72rem', fontWeight: 700 }}>RM Cost per {costInfo.packSize}L Pack</div>
                                <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '1.05rem', color: '#047857' }}>
                                  PKR {Number(costInfo.rmCostPerPack || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                marginTop: '8px',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                background: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '8px',
                              }}
                            >
                              <span>
                                Packaging Rate: <strong style={{ color: '#7C3AED' }}>PKR {Number(costInfo.pmUnitCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> / pack
                              </span>
                              <span style={{ fontWeight: 700, color: '#7C3AED', fontFamily: 'var(--font-mono)' }}>
                                Batch Packaging Subtotal: PKR {Number(costInfo.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddComponent('RAW_MATERIAL');
                        }}
                      >
                        <IconFlask size={14} /> Add Raw Chemical
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddComponent('PACKING_MATERIAL');
                        }}
                      >
                        <IconPackage size={14} /> Add Packaging Component
                      </Button>
                    </div>
                  </div>
                ),
              },
            ],
          },
          {
            title: 'Real-Time Standard Batch Cost Rollup & Valuation',
            description: 'Automated valuation of recipe inputs, finished unit manufacturing cost, and corporate margin markup',
            fields: [
              {
                label: 'Batch Cost Breakdown',
                field: (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', width: '100%' }}>
                    <Card style={{ padding: '1rem', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>BULK CHEMICALS COST</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#047857', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                        {rawMaterialsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Allocated across {totalProductionVolume.toLocaleString()} Liters
                      </div>
                    </Card>
                    <Card style={{ padding: '1rem', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>PACKAGING & LABELS COST</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#7C3AED', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                        {packagingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Bottles, caps, cartons & printed sleeves
                      </div>
                    </Card>
                    <Card style={{ padding: '1rem', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL STANDARD BATCH COST</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                        {totalBatchCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Total cost for {productionQuantity.toLocaleString()} packs
                      </div>
                    </Card>
                    <Card style={{ padding: '1rem', background: '#ECFDF5', border: '2px solid #10B981' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065F46' }}>COMPLETE COST OF 1 PACK</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#047857', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                        {unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#065F46', marginTop: '2px', fontWeight: 600 }}>
                        Auto-synced to Finished Product Master
                      </div>
                    </Card>

                    {/* Single Bottle Decomposition Bar */}
                    <div style={{
                      gridColumn: '1 / -1',
                      padding: '1rem 1.25rem',
                      background: '#ffffff',
                      border: '1.5px solid #10b981',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <IconPackage size={24} style={{ color: '#0284c7' }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                            Cost Breakdown per Single Finished Pack ({productionQuantity.toLocaleString()} Packs of {packSizeLiters}L Produced)
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Calculated dynamically: bulk chemical liquid content + packaging bottle & label
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                        <div style={{ textAlign: 'right', padding: '4px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <div style={{ color: '#047857', fontWeight: 700 }}>
                            {(productionQuantity > 0 ? rawMaterialsTotal / productionQuantity : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Bulk Liquid ({packSizeLiters}L)</div>
                        </div>
                        <span style={{ color: '#94a3b8', fontWeight: 800, fontSize: '1.1rem' }}>+</span>
                        <div style={{ textAlign: 'right', padding: '4px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <div style={{ color: '#7c3aed', fontWeight: 700 }}>
                            {(productionQuantity > 0 ? packagingTotal / productionQuantity : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Bottle + Label + Cap</div>
                        </div>
                        <span style={{ color: '#94a3b8', fontWeight: 800, fontSize: '1.1rem' }}>=</span>
                        <div style={{ textAlign: 'right', padding: '6px 14px', background: '#ecfdf5', borderRadius: '8px', border: '2px solid #10b981' }}>
                          <div style={{ color: '#047857', fontWeight: 800, fontSize: '1.2rem' }}>
                            {unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#065f46', fontWeight: 700 }}>Complete Cost / Pack</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              },

              {
                label: 'Parent Company Intercompany Markup Simulator',
                field: (
                  <Card style={{ padding: '1.25rem', background: '#EEF2FF', border: '1px solid #C7D2FE', width: '100%' }}>
                    <div style={{ fontWeight: 700, color: '#3730A3', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <IconBuilding size={16} /> Parent Company Intercompany Transfer Pricing Mechanism
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#4338CA', marginBottom: '1rem', lineHeight: '1.5' }}>
                      Parent Company (Shehswar Manufacturing) manufactures at standard unit cost of <strong>{unitCost.toFixed(2)} PKR</strong>. When supplying child distribution entities (consceptAG, Nectar, AgriventurePakistan), the system applies the defined corporate markup:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                      <div style={{ padding: '10px', background: '#FFFFFF', borderRadius: '6px', border: '1px solid #E0E7FF' }}>
                        <div style={{ fontSize: '0.72rem', color: '#6366F1', fontWeight: 600 }}>+15% MARKUP RULE</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1E1B4B', fontFamily: 'var(--font-mono)' }}>
                          {(unitCost * 1.15).toFixed(2)} PKR
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>Parent profit: +{(unitCost * 0.15).toFixed(2)} PKR/unit</div>
                      </div>
                      <div style={{ padding: '10px', background: '#FFFFFF', borderRadius: '6px', border: '2px solid #6366F1' }}>
                        <div style={{ fontSize: '0.72rem', color: '#4338CA', fontWeight: 700 }}>+20% STANDARD MARKUP</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E1B4B', fontFamily: 'var(--font-mono)' }}>
                          {(unitCost * 1.20).toFixed(2)} PKR
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#4338CA', fontWeight: 600 }}>Parent profit: +{(unitCost * 0.20).toFixed(2)} PKR/unit</div>
                      </div>
                      <div style={{ padding: '10px', background: '#FFFFFF', borderRadius: '6px', border: '1px solid #E0E7FF' }}>
                        <div style={{ fontSize: '0.72rem', color: '#6366F1', fontWeight: 600 }}>+25% PREMIUM MARKUP</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1E1B4B', fontFamily: 'var(--font-mono)' }}>
                          {(unitCost * 1.25).toFixed(2)} PKR
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>Parent profit: +{(unitCost * 0.25).toFixed(2)} PKR/unit</div>
                      </div>
                    </div>
                  </Card>
                ),
              },
            ],
          },
        ]}
      />
    );
  }

  if (mode === 'detail' && selectedBom) {
    const detailBatchSize = Number(selectedBom.standardBatchSize) || 200;
    const detailPackSize = Number(selectedBom.finishedProduct?.packSize?.quantity) || (selectedBom.packSizeLiters || 2);
    const detailTotalVol = detailBatchSize * detailPackSize;

    let detailRawTotal = 0;
    let detailPackTotal = 0;
    (selectedBom.components || []).forEach((c) => {
      if (c.componentType === 'RAW_MATERIAL') {
        const rm = rawMaterials.find(
          (r) =>
            r.id === c.rawMaterialId ||
            r.code === c.rawMaterialId ||
            r.materialCode === c.rawMaterialId ||
            (c.rawMaterial?.materialCode && (r.materialCode === c.rawMaterial?.materialCode || r.code === c.rawMaterial?.materialCode))
        );
        const rmTotalCost = Number(c.rawMaterialTotalCost || rm?.totalPurchasedValue || rm?.standardCost || 300000);
        detailRawTotal += rmTotalCost;
      } else {
        const pm = packingMaterials.find(
          (p) =>
            p.id === c.packingMaterialId ||
            p.code === c.packingMaterialId ||
            p.materialCode === c.packingMaterialId ||
            (c.packingMaterial?.materialCode && (p.materialCode === c.packingMaterial?.materialCode || p.code === c.packingMaterial?.materialCode))
        );
        const pmUnitCost = Number(pm?.lastPurchaseCost || pm?.standardCost || c.packingMaterial?.standardCost || 0);
        const unitsPerPack = Number(c.quantity) > 0 && detailBatchSize > 0
          ? (Number(c.quantity) >= detailBatchSize ? Number(c.quantity) / detailBatchSize : Number(c.quantity))
          : 1;
        detailPackTotal += pmUnitCost * unitsPerPack * detailBatchSize;
      }
    });
    const detailBatchTotal = detailRawTotal + detailPackTotal;
    const detailUnitCost = detailBatchSize > 0 ? detailBatchTotal / detailBatchSize : 0;
    const detailUnitRaw = detailBatchSize > 0 ? detailRawTotal / detailBatchSize : 0;
    const detailUnitPack = detailBatchSize > 0 ? detailPackTotal / detailBatchSize : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{selectedBom.formulaCode}</h1>
            <div style={{ color: 'var(--text-muted)' }}>
              Product: <strong>{selectedBom.finishedProduct?.productName}</strong> ({selectedBom.finishedProduct?.productCode}) | Batch: {detailBatchSize.toLocaleString()} Packs ({detailTotalVol.toLocaleString()} Liters @ {detailPackSize}L/pack) | Version: {selectedBom.version}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <Button
              variant="primary"
              onClick={() => exportBomToPdf(selectedBom, rawMaterials, packingMaterials)}
            >
              <IconDownload size={14} /> Download Official BOM (PDF)
            </Button>
            <Button variant="outline" onClick={() => setMode('list')}>
              Back to List
            </Button>
            {selectedBom.approvalStatus !== 'APPROVED' && (
              <Button variant="secondary" onClick={() => handleApprove(selectedBom)}>
                <IconCheck size={14} /> Approve Recipe
              </Button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <KpiCard title="Bulk Chemicals Total" value={`${detailRawTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR`} icon={<IconFlask size={20} />} />
          <KpiCard title="Packaging & Labels Total" value={`${detailPackTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR`} icon={<IconPackage size={20} />} />
          <KpiCard title="Total Batch Cost" value={`${detailBatchTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR`} icon={<IconCheck size={20} />} />
          <KpiCard title="Complete Cost / Pack" value={`${detailUnitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR`} icon={<IconCheck size={20} />} status="success" />
        </div>

        {/* Single Pack Breakdown Banner in Detail View */}
        <div style={{
          padding: '1rem 1.25rem',
          background: '#ffffff',
          border: '1.5px solid #10b981',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <IconPackage size={24} style={{ color: '#0284c7' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                Complete Cost Breakdown of 1 Single Finished Pack ({detailBatchSize.toLocaleString()} Packs of {detailPackSize}L Produced)
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Bulk active chemical content allocated across batch volume + packaging container & labeling costs
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
            <div style={{ textAlign: 'right', padding: '4px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#047857', fontWeight: 700 }}>
                {detailUnitRaw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Bulk Liquid ({detailPackSize}L)</div>
            </div>
            <span style={{ color: '#94a3b8', fontWeight: 800, fontSize: '1.1rem' }}>+</span>
            <div style={{ textAlign: 'right', padding: '4px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#7c3aed', fontWeight: 700 }}>
                {detailUnitPack.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Bottle + Label + Cap</div>
            </div>
            <span style={{ color: '#94a3b8', fontWeight: 800, fontSize: '1.1rem' }}>=</span>
            <div style={{ textAlign: 'right', padding: '6px 14px', background: '#ecfdf5', borderRadius: '8px', border: '2px solid #10b981' }}>
              <div style={{ color: '#047857', fontWeight: 800, fontSize: '1.2rem' }}>
                {detailUnitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR
              </div>
              <div style={{ fontSize: '0.7rem', color: '#065f46', fontWeight: 700 }}>Complete Cost / Pack</div>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bill of Materials Ingredients, Packaging & Cost Rollup Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: 'var(--space-sm)' }}>Type</th>
                    <th style={{ padding: 'var(--space-sm)' }}>Material Description</th>
                    <th style={{ padding: 'var(--space-sm)' }}>Total Material Cost</th>
                    <th style={{ padding: 'var(--space-sm)' }}>Production Volume</th>
                    <th style={{ padding: 'var(--space-sm)' }}>Allocated Cost / Liter</th>
                    <th style={{ padding: 'var(--space-sm)' }}>Cost / Pack</th>
                    <th style={{ padding: 'var(--space-sm)' }}>Batch Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedBom.components || []).map((comp, idx) => {
                    if (comp.componentType === 'RAW_MATERIAL') {
                      const rm = rawMaterials.find(
                        (r) =>
                          r.id === comp.rawMaterialId ||
                          r.code === comp.rawMaterialId ||
                          r.materialCode === comp.rawMaterialId ||
                          (comp.rawMaterial?.materialCode && (r.materialCode === comp.rawMaterial?.materialCode || r.code === comp.rawMaterial?.materialCode))
                      );
                      const rmTotalCost = Number(comp.rawMaterialTotalCost || rm?.totalPurchasedValue || rm?.standardCost || 300000);
                      const costPerL = detailTotalVol > 0 ? rmTotalCost / detailTotalVol : 0;
                      const costPerPk = costPerL * detailPackSize;

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: 'var(--space-sm)' }}>
                            <Badge variant="primary">Raw Chemical</Badge>
                          </td>
                          <td style={{ padding: 'var(--space-sm)', fontWeight: 600 }}>
                            {comp.rawMaterial
                              ? `${comp.rawMaterial.materialCode} - ${comp.rawMaterial.materialName}`
                              : rm
                              ? `${rm.materialCode} - ${rm.materialName}`
                              : 'Raw Chemical Input'}
                          </td>
                          <td style={{ padding: 'var(--space-sm)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#15803D' }}>
                            PKR {rmTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: 'var(--space-sm)', fontFamily: 'var(--font-mono)' }}>
                            {detailTotalVol.toLocaleString()} Liters ({detailBatchSize} Packs × {detailPackSize}L)
                          </td>
                          <td style={{ padding: 'var(--space-sm)', fontFamily: 'var(--font-mono)', color: '#047857', fontWeight: 600 }}>
                            PKR {costPerL.toFixed(2)} / L
                          </td>
                          <td style={{ padding: 'var(--space-sm)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#047857' }}>
                            PKR {costPerPk.toFixed(2)}
                          </td>
                          <td style={{ padding: 'var(--space-sm)', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#15803D' }}>
                            PKR {rmTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    } else {
                      const pm = packingMaterials.find(
                        (p) =>
                          p.id === comp.packingMaterialId ||
                          p.code === comp.packingMaterialId ||
                          p.materialCode === comp.packingMaterialId ||
                          (comp.packingMaterial?.materialCode && (p.materialCode === comp.packingMaterial?.materialCode || p.code === comp.packingMaterial?.materialCode))
                      );
                      const pmUnitCost = Number(pm?.lastPurchaseCost || pm?.standardCost || comp.packingMaterial?.standardCost || 0);
                      const unitsPerPack = Number(comp.quantity) > 0 && detailBatchSize > 0
                        ? (Number(comp.quantity) >= detailBatchSize ? Number(comp.quantity) / detailBatchSize : Number(comp.quantity))
                        : 1;
                      const pmCostPerPk = pmUnitCost * unitsPerPack;
                      const subtotal = pmCostPerPk * detailBatchSize;

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: 'var(--space-sm)' }}>
                            <Badge variant="secondary">Packaging</Badge>
                          </td>
                          <td style={{ padding: 'var(--space-sm)', fontWeight: 600 }}>
                            {comp.packingMaterial
                              ? `${comp.packingMaterial.materialCode} - ${comp.packingMaterial.materialName}`
                              : pm
                              ? `${pm.materialCode} - ${pm.materialName}`
                              : 'Packaging Component'}
                          </td>
                          <td style={{ padding: 'var(--space-sm)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            PKR {pmUnitCost.toFixed(2)} / unit
                          </td>
                          <td style={{ padding: 'var(--space-sm)', fontFamily: 'var(--font-mono)' }}>
                            {detailBatchSize.toLocaleString()} units
                          </td>
                          <td style={{ padding: 'var(--space-sm)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            —
                          </td>
                          <td style={{ padding: 'var(--space-sm)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7C3AED' }}>
                            PKR {pmCostPerPk.toFixed(2)}
                          </td>
                          <td style={{ padding: 'var(--space-sm)', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#7C3AED' }}>
                            PKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ListPageTemplate
      title="Formula & Bill of Materials (BOM) Master"
      subtitle="Standard recipes, active chemical ratios, and rigid packaging specifications for finished goods."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Formula BOM' }]}
      primaryAction={{
        label: 'Create Formula',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({
            formulaCode: '',
            finishedProductId: finishedProducts[0]?.id || '',
            standardBatchSize: '200',
            packSizeLiters: '2',
            batchSizeUomId: uoms[0]?.id || '',
            notes: '',
            components: [
              {
                componentType: 'RAW_MATERIAL',
                rawMaterialId: rawMaterials[0]?.id || '',
                rawMaterialTotalCost: '300000',
                quantity: '400',
                expectedWastagePercent: '0',
                notes: 'Active Technical Chemical Input',
              },
              {
                componentType: 'PACKING_MATERIAL',
                packingMaterialId: packingMaterials[0]?.id || '',
                quantity: '200',
                expectedWastagePercent: '0',
                notes: '2L Packaging Bottle with induction cap',
              },
            ],
          });
          setMode('create');
        },
      }}
      secondaryActions={[
        { label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Master Recipes" value={boms.length} icon={<IconFlask size={20} />} />
        <KpiCard title="Active Approved BOMs" value={boms.filter((b) => b.approvalStatus === 'APPROVED').length} icon={<IconCheck size={20} />} />
        <KpiCard title="Finished Products" value={finishedProducts.length} />
        <KpiCard title="Chemical Actives" value={rawMaterials.length} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 300px' }}>
            <Input
              placeholder="Search by formula code, product code, or finished product name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ width: '200px' }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'DRAFT', label: 'Draft' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Master Formulas Found"
          description={searchQuery ? 'No recipes match your search.' : 'No formula BOMs registered yet.'}
          actionLabel={searchQuery ? 'Clear Search' : undefined}
          onAction={searchQuery ? () => setSearchQuery('') : undefined}
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </ListPageTemplate>
  );
};
