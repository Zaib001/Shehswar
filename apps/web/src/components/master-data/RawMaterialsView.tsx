'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import { Card, CardContent, Button, Input, Select, DataTable, KpiCard, StatusBadge, TableSkeleton, EmptyState, ErrorState, SearchableCombobox } from '../ui';
import { useToast } from '../../context/toast-context';
import { IconPackage, IconPlus, IconRefresh, IconDownload, IconEdit, IconCheck, IconTrash } from '../icons';

interface RawMaterial {
  id: string;
  code: string;
  name: string;
  description?: string;
  categoryId: string;
  category?: { id: string; name: string; code?: string };
  uomId: string;
  uom?: { id: string; name: string; symbol: string; code?: string };
  purchaseUomId?: string;
  purchaseUom?: { id: string; name: string; symbol: string; code?: string };
  alternateUomId?: string;
  grade?: string;
  specifications?: string;
  minStock?: number;
  reorderPoint?: number;
  leadTimeDays?: number;
  isHazardous: boolean;
  storageRequirements?: string;
  standardCost?: number;
  purchaseConversionFactor?: number;
  totalPurchasedQty?: number;
  totalPurchasedValue?: number;
  unitRate?: number;
  costPerBaseUnit?: number;
  totalBulkVolume?: number;
  bulkPacking?: string;
  isActive: boolean;
}

export const RawMaterialsView: React.FC = () => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<RawMaterial | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [hazardFilter, setHazardFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    categoryId: '',
    uomId: '',
    purchaseUomId: '',
    purchaseConversionFactor: '1',
    grade: '',
    specifications: '',
    minStock: '',
    reorderPoint: '',
    leadTimeDays: '',
    isHazardous: false,
    storageRequirements: '',
    standardCost: '',
    isActive: true,
  });

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({ name: '', description: '' });
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const [isAddUomOpen, setIsAddUomOpen] = useState(false);
  const [newUomData, setNewUomData] = useState({ name: '', symbol: '', category: 'WEIGHT' });
  const [isSavingUom, setIsSavingUom] = useState(false);

  const handleCreateCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCategoryData.name.trim()) {
      showToast({ title: 'Validation Error', message: 'Category Name is required', type: 'error' });
      return;
    }
    setIsSavingCategory(true);
    try {
      const res = await ApiClient.post<any>('/api/v1/master-data/material-categories', {
        name: newCategoryData.name.trim(),
        description: newCategoryData.description.trim() || undefined,
        categoryType: 'RAW_MATERIAL',
        code: 'AUTO',
      });
      const createdCat = res.data;
      showToast({ title: 'Category Created', message: `${createdCat.name} was added`, type: 'success' });
      const catRes = await ApiClient.get<any[]>('/api/v1/master-data/material-categories');
      setCategories(catRes.data || []);
      setFormData((prev) => ({ ...prev, categoryId: createdCat.id }));
      setIsAddCategoryOpen(false);
      setNewCategoryData({ name: '', description: '' });
      setTimeout(() => {
        document.getElementById('field-rm-uom')?.focus();
      }, 100);
    } catch (err: any) {
      showToast({ title: 'Failed to create category', message: err.message || 'Error creating category', type: 'error' });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleCreateUom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newUomData.name.trim() || !newUomData.symbol.trim()) {
      showToast({ title: 'Validation Error', message: 'UOM Name and Symbol are required', type: 'error' });
      return;
    }
    setIsSavingUom(true);
    try {
      const res = await ApiClient.post<any>('/api/v1/master-data/uoms', {
        name: newUomData.name.trim(),
        symbol: newUomData.symbol.trim(),
        category: newUomData.category,
        code: newUomData.symbol.toUpperCase().trim(),
      });
      const createdUom = res.data;
      showToast({ title: 'UOM Created', message: `${createdUom.name} (${createdUom.symbol}) was added`, type: 'success' });
      const uomRes = await ApiClient.get<any[]>('/api/v1/master-data/uoms');
      setUoms(uomRes.data || []);
      setFormData((prev) => ({
        ...prev,
        uomId: createdUom.id,
        purchaseUomId: prev.purchaseUomId || createdUom.id,
      }));
      setIsAddUomOpen(false);
      setNewUomData({ name: '', symbol: '', category: 'WEIGHT' });
      setTimeout(() => {
        document.getElementById('field-rm-cost')?.focus();
      }, 100);
    } catch (err: any) {
      showToast({ title: 'Failed to create UOM', message: err.message || 'Error creating UOM', type: 'error' });
    } finally {
      setIsSavingUom(false);
    }
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [matRes, catRes, uomRes] = await Promise.all([
        ApiClient.get<any[]>('/api/v1/master-data/raw-materials'),
        ApiClient.get<any[]>('/api/v1/master-data/material-categories'),
        ApiClient.get<any[]>('/api/v1/master-data/uoms'),
      ]);
      const normalized = (matRes.data || []).map((m: any) => ({
        ...m,
        code: m.code || m.materialCode || '',
        name: m.name || m.materialName || '',
        categoryId: m.categoryId || m.category?.id || '',
        category: m.category || null,
        uomId: m.uomId || m.baseUomId || '',
        uom: m.uom || m.baseUom || null,
        purchaseUomId: m.purchaseUomId || m.alternateUomId || '',
        purchaseUom: m.purchaseUom || null,
        standardCost: m.standardCost !== undefined && m.standardCost !== null && Number(m.standardCost) > 0
          ? Number(m.standardCost)
          : (m.lastPurchaseCost !== undefined && m.lastPurchaseCost !== null && Number(m.lastPurchaseCost) > 0
            ? Number(m.lastPurchaseCost)
            : (m.averageCost !== undefined && m.averageCost !== null ? Number(m.averageCost) : undefined)),
        storageRequirements: m.storageRequirements || '',
        purchaseConversionFactor: m.purchaseConversionFactor ? Number(m.purchaseConversionFactor) : 1,
        totalPurchasedQty: m.totalPurchasedQty !== undefined ? Number(m.totalPurchasedQty) : undefined,
        totalPurchasedValue: m.totalPurchasedValue !== undefined ? Number(m.totalPurchasedValue) : undefined,
        unitRate: m.unitRate !== undefined ? Number(m.unitRate) : (m.lastPurchaseCost ? Number(m.lastPurchaseCost) : undefined),
        costPerBaseUnit: m.costPerBaseUnit !== undefined ? Number(m.costPerBaseUnit) : undefined,
        totalBulkVolume: m.totalBulkVolume !== undefined ? Number(m.totalBulkVolume) : undefined,
        bulkPacking: m.bulkPacking || m.specifications || '',
        minStock: m.minStock !== undefined ? m.minStock : (m.minimumStock !== undefined ? Number(m.minimumStock) : undefined),
        reorderPoint: m.reorderPoint !== undefined ? m.reorderPoint : (m.reorderLevel !== undefined ? Number(m.reorderLevel) : undefined),
        leadTimeDays: m.leadTimeDays !== undefined ? m.leadTimeDays : (m.shelfLifeDays !== undefined ? Number(m.shelfLifeDays) : undefined),
        isHazardous: !!m.isHazardous,
        isActive: m.isActive !== undefined ? m.isActive : m.status === 'ACTIVE',
      }));
      setMaterials(normalized);
      setCategories(catRes.data || []);
      setUoms(uomRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load raw materials');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = materials.filter((m: any) => {
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch =
      String(m.code || '').toLowerCase().includes(q) ||
      String(m.name || '').toLowerCase().includes(q) ||
      String(m.grade || '').toLowerCase().includes(q) ||
      String(m.storageRequirements || '').toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'ALL' || m.categoryId === categoryFilter;
    const matchesHazard =
      hazardFilter === 'ALL' ||
      (hazardFilter === 'HAZARDOUS' && m.isHazardous) ||
      (hazardFilter === 'SAFE' && !m.isHazardous);
    return matchesSearch && matchesCategory && matchesHazard;
  });

  const handleSave = async () => {
    const finalName = formData.name.trim();
    if (!finalName) {
      showToast({ title: 'Validation Error', message: 'Material Name is required', type: 'error' });
      return;
    }

    const finalCode = (formData.code || 'AUTO').trim().toUpperCase();
    const finalUomId = formData.uomId || uoms.find((u) => /kg|liter|ltr/i.test(u.name))?.id || uoms[0]?.id;
    const finalCategoryId = formData.categoryId || rawCategories[0]?.id || categories[0]?.id;

    if (!finalUomId) {
      showToast({ title: 'Validation Error', message: 'Please select a Base Unit (UOM)', type: 'error' });
      return;
    }
    if (!finalCategoryId) {
      showToast({ title: 'Validation Error', message: 'A material category is required', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        materialCode: finalCode,
        materialName: finalName,
        description: formData.description?.trim() || undefined,
        categoryId: finalCategoryId,
        baseUomId: finalUomId,
        purchaseUomId: formData.purchaseUomId || finalUomId,
        purchaseConversionFactor: formData.purchaseConversionFactor ? Number(formData.purchaseConversionFactor) : 1,
        grade: formData.grade?.trim() || undefined,
        specifications: formData.specifications?.trim() || undefined,
        storageRequirements: formData.storageRequirements?.trim() || undefined,
        standardCost: formData.standardCost !== '' ? Number(formData.standardCost) : 0,
        minStock: formData.minStock !== '' ? Number(formData.minStock) : undefined,
        reorderPoint: formData.reorderPoint !== '' ? Number(formData.reorderPoint) : undefined,
        leadTimeDays: formData.leadTimeDays !== '' ? Number(formData.leadTimeDays) : undefined,
        isHazardous: formData.isHazardous,
        isActive: formData.isActive,
      };

      if (mode === 'edit' && selectedMaterial) {
        await ApiClient.patch(`/api/v1/master-data/raw-materials/${selectedMaterial.id}`, payload);
        showToast({ title: 'Updated', message: `${finalName} has been updated`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/raw-materials', payload);
        showToast({ title: 'Created', message: `${finalName} registered in Raw Material Master`, type: 'success' });
      }
      await fetchData();
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const rawCategories = categories.filter(
    (c) => c.categoryType === 'RAW_MATERIAL' || c.categoryType === 'BOTH' || c.type === 'RAW_MATERIAL' || c.type === 'BOTH' || (!c.categoryType && !c.type)
  );

  const handleDelete = async () => {
    if (!deletingMaterial) return;
    setIsDeleting(true);
    try {
      await ApiClient.delete(`/api/v1/master-data/raw-materials/${deletingMaterial.id}`);
      showToast({ title: 'Material Deleted', message: `Raw material "${deletingMaterial.name}" has been removed`, type: 'success' });
      setDeletingMaterial(null);
      await fetchData();
    } catch (err: any) {
      showToast({ title: 'Delete Failed', message: err.message || 'Failed to delete raw material', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Material Code',
      render: (row: RawMaterial) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary-600)' }}>
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Material Name',
      render: (row: RawMaterial) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {row.grade && <span>Grade: <strong>{row.grade}</strong></span>}
            {row.storageRequirements && (
              <span title={row.storageRequirements} style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.storageRequirements}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row: RawMaterial) => {
        const cat = row.category || categories.find((c) => c.id === row.categoryId);
        return (
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {cat ? (cat.code ? `${cat.code} · ${cat.name}` : cat.name) : '—'}
          </span>
        );
      },
    },
    {
      key: 'uom',
      label: 'Base UOM',
      render: (row: RawMaterial) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.78rem' }}>
          {row.uom?.symbol || row.uom?.code || uoms.find((u) => u.id === row.uomId)?.symbol || '—'}
        </span>
      ),
    },
    {
      key: 'packing',
      label: 'Packing / Bulk',
      render: (row: RawMaterial) => {
        const factor = Number(row.purchaseConversionFactor || 1);
        const uomSymbol = row.uom?.symbol || row.uom?.code || 'Units';
        const packLabel = row.bulkPacking || row.storageRequirements || row.specifications || (factor > 1 ? `${factor} ${uomSymbol}` : 'Bulk');
        return (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            {packLabel}
          </span>
        );
      },
    },
    {
      key: 'purchasedTotal',
      label: 'Purchased Qty & Value',
      render: (row: RawMaterial) => {
        const qty = row.totalPurchasedQty || 0;
        const totalVal = row.totalPurchasedValue || (qty * (row.unitRate || row.standardCost || 0));
        const factor = Number(row.purchaseConversionFactor || 1);
        const bulkVol = factor > 1 && qty > 0 ? qty * factor : null;
        const uomSymbol = row.uom?.symbol || row.uom?.code || 'L';
        return (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              {qty > 0 ? `${qty} Qty ${bulkVol ? `(${bulkVol.toLocaleString()} ${uomSymbol})` : ''}` : '—'}
            </div>
            {totalVal > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                PKR {totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'costing',
      label: 'Purchase Rate / Base Cost',
      render: (row: RawMaterial) => {
        const unitRate = row.unitRate || row.standardCost || 0;
        const factor = Number(row.purchaseConversionFactor || 1);
        const baseCost = row.costPerBaseUnit || (factor > 1 && unitRate > 0 ? unitRate / factor : unitRate);
        const uomSymbol = row.uom?.symbol || row.uom?.code || 'Unit';
        return (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#047857', fontSize: '0.85rem' }}>
              PKR {baseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {uomSymbol}
            </div>
            {factor > 1 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                (PKR {unitRate.toLocaleString()} / Pack)
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'isHazardous',
      label: 'Hazardous',
      render: (row: RawMaterial) =>
        row.isHazardous ? (
          <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            HAZARDOUS
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Safe</span>
        ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: RawMaterial) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: RawMaterial) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<IconEdit size={14} />}
            onClick={() => {
              setSelectedMaterial(row);
              setFormData({
                code: row.code,
                name: row.name,
                description: row.description || '',
                categoryId: row.categoryId,
                uomId: row.uomId,
                purchaseUomId: row.purchaseUomId || row.uomId,
                purchaseConversionFactor: row.purchaseConversionFactor ? row.purchaseConversionFactor.toString() : '1',
                grade: row.grade || '',
                specifications: row.specifications || '',
                minStock: row.minStock !== undefined ? row.minStock.toString() : '',
                reorderPoint: row.reorderPoint !== undefined ? row.reorderPoint.toString() : '',
                leadTimeDays: row.leadTimeDays !== undefined ? row.leadTimeDays.toString() : '',
                isHazardous: row.isHazardous,
                storageRequirements: row.storageRequirements || '',
                standardCost: row.standardCost !== undefined ? row.standardCost.toString() : '',
                isActive: row.isActive,
              });
              setMode('edit');
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            style={{ color: '#DC2626' }}
            icon={<IconTrash size={14} />}
            onClick={() => setDeletingMaterial(row)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (mode === 'create' || mode === 'edit') {
    return (
      <>
        <FormPageTemplate
          title={mode === 'create' ? 'Register Raw Material' : `Edit — ${selectedMaterial?.name}`}
          subtitle="Keyboard-first fast entry: Type Name -> Category -> UoM -> Rate/Cost -> Grade -> Enter to Save"
          breadcrumbs={[
            { label: 'Master Data', href: '#' },
            { label: 'Raw Materials', href: '#' },
            { label: mode === 'create' ? 'New Material' : 'Edit' },
          ]}
          onSave={handleSave}
          onCancel={() => setMode('list')}
          isSaving={isSaving}
          sections={[
            {
              title: '1. Primary Material Details (Keyboard Flow)',
              fields: [
                {
                  label: 'Material Name *',
                  required: true,
                  field: (
                    <Input
                      id="field-rm-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          document.getElementById('field-rm-category')?.focus();
                        }
                      }}
                      placeholder="e.g. FOOD, Chlorpyrifos Technical, Solvent (Press Enter for Category)"
                      autoFocus
                    />
                  ),
                },
                {
                  label: 'Material Category *',
                  required: true,
                  field: (
                    <SearchableCombobox
                      id="field-rm-category"
                      value={formData.categoryId || (rawCategories[0]?.id ?? '')}
                      onChange={(val) => setFormData({ ...formData, categoryId: val })}
                      options={rawCategories.map((c) => ({
                        value: c.id,
                        label: c.code ? `${c.code} — ${c.name}` : c.name,
                      }))}
                      placeholder="Type to search category..."
                      addNewLabel="+ Add Material Category"
                      onAddNew={() => setIsAddCategoryOpen(true)}
                      nextFocusId="field-rm-uom"
                    />
                  ),
                },
                {
                  label: 'Base Unit of Measure (UOM) *',
                  required: true,
                  field: (
                    <SearchableCombobox
                      id="field-rm-uom"
                      value={formData.uomId}
                      onChange={(val) => {
                        setFormData({
                          ...formData,
                          uomId: val,
                          purchaseUomId: formData.purchaseUomId || val,
                        });
                      }}
                      options={uoms.map((u) => ({
                        value: u.id,
                        label: `${u.name} (${u.symbol || u.code})`,
                      }))}
                      placeholder="Type to search Unit (e.g. Kg, Liter)..."
                      addNewLabel="+ Add UoM"
                      onAddNew={() => setIsAddUomOpen(true)}
                      nextFocusId="field-rm-cost"
                    />
                  ),
                },
                {
                  label: 'Standard Cost / Purchase Price (PKR) *',
                  required: true,
                  field: (
                    <Input
                      id="field-rm-cost"
                      type="number"
                      step="any"
                      value={formData.standardCost}
                      onChange={(e) => setFormData({ ...formData, standardCost: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          document.getElementById('field-rm-grade')?.focus();
                        }
                      }}
                      placeholder="e.g. 400000 (Press Enter for Grade)"
                      style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                    />
                  ),
                },
                {
                  label: 'Grade / Quality',
                  field: (
                    <Input
                      id="field-rm-grade"
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSave();
                        }
                      }}
                      placeholder="e.g. Technical Grade, Food (Press Enter to Save)"
                    />
                  ),
                },
                {
                  label: 'Material Code (Backend Auto-Generated)',
                  field: (
                    <Input
                      value={formData.code || 'AUTO (Generated sequentially by Backend)'}
                      disabled
                      placeholder="Auto-generated e.g. RM-000001"
                      style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, background: '#f8fafc', color: '#64748b' }}
                    />
                  ),
                },
              ],
            },
            {
              title: '2. Classification & Technical Attributes (Optional)',
              fields: [
                {
                  label: 'Storage Requirements',
                  field: (
                    <Input
                      value={formData.storageRequirements}
                      onChange={(e) => setFormData({ ...formData, storageRequirements: e.target.value })}
                      placeholder="e.g. Cool, dry ventilated bay, keep below 30°C"
                    />
                  ),
                },
                {
                  label: 'Hazardous Material',
                  field: (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 0' }}>
                      <input
                        type="checkbox"
                        checked={formData.isHazardous}
                        onChange={(e) => setFormData({ ...formData, isHazardous: e.target.checked })}
                      />
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Classified as hazardous / dangerous goods</span>
                    </label>
                  ),
                },
                {
                  label: 'Minimum Stock Level',
                  field: (
                    <Input
                      type="number"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                      placeholder="e.g. 0"
                    />
                  ),
                },
                {
                  label: 'Description / Remarks',
                  field: (
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional notes or formulation details"
                    />
                  ),
                },
              ],
            },
          ]}
        />

        {isAddCategoryOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          }}>
            <div style={{
              background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                + Add Material Category
              </h3>
              <form onSubmit={handleCreateCategory}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Category Name *
                  </label>
                  <Input
                    value={newCategoryData.name}
                    onChange={(e) => setNewCategoryData({ ...newCategoryData, name: e.target.value })}
                    placeholder="e.g. Solvents, Emulsifiers, Technicals"
                    autoFocus
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Description (Optional)
                  </label>
                  <Input
                    value={newCategoryData.description}
                    onChange={(e) => setNewCategoryData({ ...newCategoryData, description: e.target.value })}
                    placeholder="Category description"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <Button variant="secondary" type="button" onClick={() => setIsAddCategoryOpen(false)} disabled={isSavingCategory}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={isSavingCategory}>
                    {isSavingCategory ? 'Saving...' : 'Save & Select'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isAddUomOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          }}>
            <div style={{
              background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                + Add Unit of Measure (UOM)
              </h3>
              <form onSubmit={handleCreateUom}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    UOM Name *
                  </label>
                  <Input
                    value={newUomData.name}
                    onChange={(e) => setNewUomData({ ...newUomData, name: e.target.value })}
                    placeholder="e.g. Kilogram, Litre, Gram"
                    autoFocus
                  />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    UOM Symbol *
                  </label>
                  <Input
                    value={newUomData.symbol}
                    onChange={(e) => setNewUomData({ ...newUomData, symbol: e.target.value })}
                    placeholder="e.g. kg, L, gm"
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Category
                  </label>
                  <Select
                    value={newUomData.category}
                    onChange={(e) => setNewUomData({ ...newUomData, category: e.target.value })}
                    options={[
                      { value: 'WEIGHT', label: 'Weight' },
                      { value: 'VOLUME', label: 'Volume' },
                      { value: 'UNIT', label: 'Unit / Piece' },
                      { value: 'LENGTH', label: 'Length' },
                    ]}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <Button variant="secondary" type="button" onClick={() => setIsAddUomOpen(false)} disabled={isSavingUom}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={isSavingUom}>
                    {isSavingUom ? 'Saving...' : 'Save & Select'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <ListPageTemplate
      title="Raw Material Master"
      subtitle="Chemical inputs, active technical ingredients, and solvent carriers used in pesticide & fertilizer manufacturing."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Raw Materials' }]}
      primaryAction={{
        label: 'Register Material',
        icon: <IconPlus size={16} />,
        onClick: () => {
          const defaultUom = uoms.find((u) => /kg|liter|ltr/i.test(u.name))?.id || uoms[0]?.id || '';
          setFormData({
            code: '',
            name: '',
            description: '',
            categoryId: rawCategories[0]?.id || categories[0]?.id || '',
            uomId: defaultUom,
            purchaseUomId: defaultUom,
            purchaseConversionFactor: '1',
            grade: '',
            specifications: '',
            minStock: '',
            reorderPoint: '',
            leadTimeDays: '',
            isHazardous: false,
            storageRequirements: '',
            standardCost: '',
            isActive: true,
          });
          setMode('create');
        },
      }}
      secondaryActions={[
        { label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData },
        { label: 'Export', icon: <IconDownload size={16} />, onClick: () => showToast({ title: 'Export Ready', message: 'Raw materials exported', type: 'info' }) },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Materials" value={materials.length} icon={<IconPackage size={20} />} />
        <KpiCard title="Active Materials" value={materials.filter((m) => m.isActive).length} icon={<IconCheck size={20} />} />
        <KpiCard title="Hazardous Items" value={materials.filter((m) => m.isHazardous).length} icon={<IconPackage size={20} />} status="warning" />
        <KpiCard title="Categories" value={rawCategories.length} icon={<IconPackage size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 260px' }}>
            <Input placeholder="Search by code, name, grade, or storage..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div style={{ width: '280px' }}>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Raw Material Categories' },
                ...rawCategories.map((c) => ({ value: c.id, label: c.code ? `${c.code} — ${c.name}` : c.name })),
              ]}
            />
          </div>
          <div style={{ width: '180px' }}>
            <Select
              value={hazardFilter}
              onChange={(e) => setHazardFilter(e.target.value)}
              options={[{ value: 'ALL', label: 'All Materials' }, { value: 'HAZARDOUS', label: 'Hazardous Only' }, { value: 'SAFE', label: 'Non-Hazardous' }]}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={6} columns={8} />
      ) : error ? (
        <ErrorState title="Failed to Load Raw Materials" message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Raw Materials Found"
          description={searchQuery ? 'No materials match your search.' : 'No raw materials have been registered yet.'}
          actionLabel={searchQuery ? 'Clear Search' : undefined}
          onAction={searchQuery ? () => { setSearchQuery(''); setCategoryFilter('ALL'); } : undefined}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowDoubleClick={(row: RawMaterial) => {
            setSelectedMaterial(row);
            setFormData({
              code: row.code,
              name: row.name,
              description: row.description || '',
              categoryId: row.categoryId,
              uomId: row.uomId,
              purchaseUomId: row.purchaseUomId || row.uomId,
              purchaseConversionFactor: row.purchaseConversionFactor ? row.purchaseConversionFactor.toString() : '1',
              grade: row.grade || '',
              specifications: row.specifications || '',
              minStock: row.minStock !== undefined ? row.minStock.toString() : '',
              reorderPoint: row.reorderPoint !== undefined ? row.reorderPoint.toString() : '',
              leadTimeDays: row.leadTimeDays !== undefined ? row.leadTimeDays.toString() : '',
              isHazardous: row.isHazardous,
              storageRequirements: row.storageRequirements || '',
              standardCost: row.standardCost !== undefined ? row.standardCost.toString() : '',
              isActive: row.isActive,
            });
            setMode('edit');
          }}
        />
      )}

      {deletingMaterial && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
              Delete Raw Material
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{deletingMaterial.name} ({deletingMaterial.code})</strong>?
              This action will remove the raw material from active records.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button variant="secondary" onClick={() => setDeletingMaterial(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="primary" style={{ background: '#DC2626', borderColor: '#DC2626', color: '#fff' }} onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Material'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ListPageTemplate>
  );
};
