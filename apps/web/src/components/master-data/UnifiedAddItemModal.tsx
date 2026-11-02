'use client';

/**
 * SHEHSWAR ONE360 - Unified "+ Add Item" Modal
 *
 * Full Enterprise UI matching Canonical Shehswar ERP Design System:
 * - Uses standard Modal component from '../ui'
 * - Standard Input, Select, Button, StatusBadge from '../ui'
 * - Clean light SaaS layout with design tokens
 * - Category determines entity, fields, sequential code, and destination
 * - Strict Packaging vs Pack Size separation
 * - Submodals for + Add Packaging, + Add Unit, + Add Category
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import {
  Modal,
  Button,
  Input,
  Select,
} from '../ui';
import {
  IconCheck,
  IconAlertTriangle,
  IconPackage,
  IconTag,
} from '../icons';
import { InlinePackagingModal } from './InlinePackagingModal';
import { InlineUnitModal } from './InlineUnitModal';
import { InlineCategoryModal } from './InlineCategoryModal';

export interface UnifiedAddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemCreated?: (createdItem: any, destinationUrl: string) => void;
  defaultCategoryId?: string;
}

export const UnifiedAddItemModal: React.FC<UnifiedAddItemModalProps> = ({
  isOpen,
  onClose,
  onItemCreated,
  defaultCategoryId,
}) => {
  const { showToast } = useToast();

  // Categories & Routing State
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(defaultCategoryId || '');
  const [routeInfo, setRouteInfo] = useState<any | null>(null);
  const [previewCode, setPreviewCode] = useState<string>('ITEM-XXXXXX');

  // Form Fields - Core Master
  const [itemName, setItemName] = useState('');
  const [urduName, setUrduName] = useState('');
  const [description, setDescription] = useState('');

  // Form Fields - Finished Goods Specific
  const [productType, setProductType] = useState('Insecticide');
  const [mType, setMType] = useState('Insecticides');
  const [packagingMaterials, setPackagingMaterials] = useState<any[]>([]);
  const [selectedPackagingId, setSelectedPackagingId] = useState<string>('');
  const [packSizeQuantity, setPackSizeQuantity] = useState<number>(2);
  const [packSizeUnit, setPackSizeUnit] = useState('Liter');
  const [uoms, setUoms] = useState<any[]>([]);
  const [selectedBaseUomId, setSelectedBaseUomId] = useState<string>('');
  const [ppc, setPpc] = useState<number>(12); // Pack Per Carton
  const [baseSellingPrice, setBaseSellingPrice] = useState<number>(2800);
  const [brand, setBrand] = useState('Shehswar Agro');
  const [grade, setGrade] = useState('Standard');

  // Form Fields - Raw Material Specific
  const [purchaseUoms, setPurchaseUoms] = useState<any[]>([]);
  const [selectedPurchaseUomId, setSelectedPurchaseUomId] = useState<string>('');
  const [conversionFactor, setConversionFactor] = useState<number>(1);
  const [batchControlled, setBatchControlled] = useState(true);
  const [qcRequired, setQcRequired] = useState(false);
  const [storageRequirements, setStorageRequirements] = useState('');

  // Form Fields - Packing Material Specific
  const [packCompatibility, setPackCompatibility] = useState('');
  const [minStock, setMinStock] = useState<number>(500);
  const [reorderLevel, setReorderLevel] = useState<number>(200);

  // Sub-modals
  const [isPackagingModalOpen, setIsPackagingModalOpen] = useState(false);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Status & Validation
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [createdResult, setCreatedResult] = useState<any | null>(null);

  // 1. Fetch Categories, Packaging Materials & UOMs on Open
  const loadPrerequisites = useCallback(async () => {
    try {
      const [catsRes, pmRes, uomRes] = await Promise.all([
        ApiClient.get<any[]>('/api/v1/master-data/unified-categories'),
        ApiClient.get<any[]>('/api/v1/master-data/packing-materials'),
        ApiClient.get<any[]>('/api/v1/master-data/units-of-measure'),
      ]);

      const catList = Array.isArray(catsRes.data) ? catsRes.data : (catsRes.data as any)?.data || [];
      setCategories(catList);

      const pmList = Array.isArray(pmRes.data) ? pmRes.data : (pmRes.data as any)?.data || [];
      setPackagingMaterials(pmList);

      const uomList = Array.isArray(uomRes.data) ? uomRes.data : (uomRes.data as any)?.data || [];
      setUoms(uomList);
      setPurchaseUoms(uomList);

      if (!selectedCategoryId && catList.length > 0) {
        // Default to Finished Goods 41-01 if available
        const defaultCat = catList.find((c: any) => c.code === '41-01') || catList[0];
        setSelectedCategoryId(defaultCat.id);
      }
    } catch (err: any) {
      console.error('Failed to load item creation prerequisites', err);
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    if (defaultCategoryId) {
      setSelectedCategoryId(defaultCategoryId);
    }
  }, [defaultCategoryId]);

  useEffect(() => {
    if (isOpen) {
      loadPrerequisites();
      setCreatedResult(null);
      setDuplicateWarning(null);
      setItemName('');
      setUrduName('');
      setDescription('');
    }
  }, [isOpen, loadPrerequisites]);

  // 2. When Category Changes, Resolve Route & Code Prefix
  useEffect(() => {
    if (!selectedCategoryId) return;

    ApiClient.get<any>(`/api/v1/master-data/category-router/${selectedCategoryId}`)
      .then((res) => {
        setRouteInfo(res.data);
        return ApiClient.get<any>(`/api/v1/master-data/next-code?entityType=${res.data.targetEntity}`);
      })
      .then((codeRes) => {
        setPreviewCode(codeRes.data?.nextCode || `${routeInfo?.codePrefix || 'ITEM'}-XXXXXX`);
      })
      .catch((err) => {
        console.error('Routing resolution failed:', err);
      });
  }, [selectedCategoryId]);

  // 3. Real-time Duplicate Check
  useEffect(() => {
    if (!itemName.trim() || !routeInfo?.targetEntity) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(() => {
      ApiClient.get<any>(
        `/api/v1/master-data/check-duplicate-item?name=${encodeURIComponent(itemName.trim())}&entityType=${routeInfo.targetEntity}`
      )
        .then((res) => {
          if (res.data?.hasDuplicate) {
            setDuplicateWarning(res.data.matchedItem);
          } else {
            setDuplicateWarning(null);
          }
        })
        .catch(console.error);
    }, 400);

    return () => clearTimeout(timer);
  }, [itemName, routeInfo?.targetEntity]);

  // 4. Handle Submit
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) {
      showToast({ title: 'Validation', message: 'Please select an item category', type: 'warning' });
      return;
    }
    if (!itemName.trim()) {
      showToast({ title: 'Validation', message: 'Item Name is required', type: 'warning' });
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        categoryId: selectedCategoryId,
        itemName: itemName.trim(),
        urduName: urduName.trim() || undefined,
        description: description.trim() || undefined,
        brand,
        grade,
      };

      if (routeInfo?.targetEntity === 'FINISHED_PRODUCT') {
        payload.productType = productType;
        payload.mType = mType;
        payload.packagingMaterialId = selectedPackagingId || undefined;
        payload.packSizeQuantity = packSizeQuantity;
        payload.packSizeUnit = packSizeUnit;
        payload.ppc = ppc;
        payload.baseSellingPrice = baseSellingPrice;
        payload.baseUomId = selectedBaseUomId || undefined;
      } else if (routeInfo?.targetEntity === 'RAW_MATERIAL') {
        payload.baseUomId = selectedBaseUomId || undefined;
        payload.purchaseUomId = selectedPurchaseUomId || undefined;
        payload.purchaseConversionFactor = conversionFactor;
        payload.batchControlled = batchControlled;
        payload.qcRequired = qcRequired;
        payload.storageRequirements = storageRequirements || undefined;
        payload.minimumStock = minStock;
        payload.reorderLevel = reorderLevel;
      } else {
        // Packing Material
        payload.baseUomId = selectedBaseUomId || undefined;
        payload.packCompatibility = packCompatibility || undefined;
        payload.minimumStock = minStock;
        payload.reorderLevel = reorderLevel;
      }

      const res = await ApiClient.post<any>('/api/v1/master-data/unified-items', payload);
      setCreatedResult(res.data);
      showToast({
        title: 'Item Created Successfully',
        message: res.data?.message || 'Item saved to database',
        type: 'success',
      });
      if (onItemCreated) {
        onItemCreated(res.data.item, res.data.destinationUrl);
      }
    } catch (err: any) {
      showToast({
        title: 'Save Failed',
        message: err.response?.data?.message || err.message || 'Failed to create item',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Register Master Item"
        description="Single entry point: selected category routes to Finished Goods, Raw Materials, or Packing Materials"
        size="xl"
        footer={
          createdResult ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCreatedResult(null);
                  setItemName('');
                  setUrduName('');
                  setDescription('');
                }}
              >
                + Register Another Item
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onClose}
                style={{ backgroundColor: '#10B981', borderColor: '#10B981', color: '#fff' }}
              >
                Done
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                Next Code:{' '}
                <strong style={{ fontFamily: 'var(--font-mono, monospace)', color: '#2563EB' }}>
                  {previewCode}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  isLoading={isSaving}
                  style={{ backgroundColor: '#10B981', borderColor: '#10B981', color: '#fff' }}
                >
                  Save Item
                </Button>
              </div>
            </div>
          )
        }
      >
        {createdResult ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <IconCheck size={28} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
              {createdResult.item?.productName || createdResult.item?.materialName}
            </h3>
            <div
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 700,
                color: '#2563EB',
                fontSize: '1rem',
                marginBottom: '10px',
              }}
            >
              Code: {createdResult.code}
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '380px', margin: '0 auto' }}>
              Successfully recorded in database table: <strong>{createdResult.destinationLabel}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Step 1: Category Routing Layer */}
            <div style={{ padding: '14px 16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconTag size={16} /> 1. Select Item Category / Type (Routing Layer) *
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  style={{ fontSize: '0.75rem', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Add New Category
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                <Select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(typeof e === 'string' ? e : e.target?.value || '')}
                  options={categories.map((c) => ({
                    label: `${c.code ? `[${c.code}] ` : ''}${c.name} (${c.badge || c.entityType})`,
                    value: c.id,
                  }))}
                />

                <div style={{ padding: '8px 12px', background: '#FFFFFF', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Target Destination:</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>
                    {routeInfo?.destinationLabel || 'Loading routing...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Duplicate Alert */}
            {duplicateWarning && (
              <div style={{ padding: '10px 14px', background: '#FEF3C7', borderRadius: '8px', border: '1px solid #FDE68A', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <IconAlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0 }} />
                <div style={{ fontSize: '0.8rem', color: '#92400E' }}>
                  Possible duplicate: <strong>{duplicateWarning.name}</strong> already exists with Code{' '}
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}>{duplicateWarning.code}</span>.
                </div>
              </div>
            )}

            {/* Basic Identity Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {routeInfo?.targetEntity === 'FINISHED_PRODUCT' ? 'Product Name' : 'Material Name'} *
                </label>
                <Input
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder={
                    routeInfo?.targetEntity === 'FINISHED_PRODUCT'
                      ? 'e.g. ABC 20% EC'
                      : routeInfo?.targetEntity === 'RAW_MATERIAL'
                      ? 'e.g. Chlorpyrifos 97% Tech'
                      : 'e.g. 2 Liter HDPE Bottle'
                  }
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Urdu Name / Local Specification
                </label>
                <Input
                  dir="rtl"
                  value={urduName}
                  onChange={(e) => setUrduName(e.target.value)}
                  placeholder="اے بی سی بیس فیصد"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Description / Technical Notes (Optional)
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional specifications or formulation remarks..."
              />
            </div>

            {/* ============================================================== */}
            {/* FINISHED PRODUCT DYNAMIC SUBFORM */}
            {/* ============================================================== */}
            {routeInfo?.targetEntity === 'FINISHED_PRODUCT' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Packaging & Pack Size Separation */}
                <div style={{ padding: '14px 16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <IconPackage size={16} /> Packaging Material & Unit Logistics
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsPackagingModalOpen(true)}
                      style={{ fontSize: '0.75rem', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      + Add New Packaging
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748B', marginBottom: '4px' }}>
                        Physical Packaging (Bottle/Bag)
                      </label>
                      <Select
                        value={selectedPackagingId}
                        onChange={(e) => setSelectedPackagingId(typeof e === 'string' ? e : e.target?.value || '')}
                        options={[
                          { label: '-- Select Physical Packaging --', value: '' },
                          ...packagingMaterials.map((pm) => ({
                            label: `${pm.materialCode} ${pm.materialName}`,
                            value: pm.id,
                          })),
                        ]}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748B', marginBottom: '4px' }}>
                        Pack Size Quantity *
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        required
                        value={packSizeQuantity}
                        onChange={(e) => setPackSizeQuantity(parseFloat(e.target.value) || 1)}
                        style={{ fontFamily: 'var(--font-mono, monospace)' }}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.72rem', color: '#64748B' }}>Pack Size Unit</label>
                        <button
                          type="button"
                          onClick={() => setIsUnitModalOpen(true)}
                          style={{ fontSize: '0.7rem', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          + Add Unit
                        </button>
                      </div>
                      <Select
                        value={packSizeUnit}
                        onChange={(e) => setPackSizeUnit(typeof e === 'string' ? e : e.target?.value || 'Liter')}
                        options={[
                          { label: 'Liter', value: 'Liter' },
                          { label: 'KG', value: 'KG' },
                          { label: 'ML', value: 'ML' },
                          { label: 'GM', value: 'GM' },
                          { label: 'Pack', value: 'Pack' },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* Classification & Commercial Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      MType (Classification)
                    </label>
                    <Select
                      value={mType}
                      onChange={(e) => setMType(typeof e === 'string' ? e : e.target?.value || 'Insecticides')}
                      options={[
                        { label: 'Insecticides', value: 'Insecticides' },
                        { label: 'Herbicides', value: 'Herbicides' },
                        { label: 'Weedicides', value: 'Weedicides' },
                        { label: 'Fungicides', value: 'Fungicides' },
                        { label: 'Fertilizers', value: 'Fertilizers' },
                        { label: 'Seeds', value: 'Seeds' },
                        { label: 'PGRs / Nutrients', value: 'PGRs / Nutrients' },
                        { label: 'Others', value: 'Others' },
                      ]}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      PPC (Packs / Carton)
                    </label>
                    <Input
                      type="number"
                      value={ppc}
                      onChange={(e) => setPpc(parseInt(e.target.value, 10) || 1)}
                      style={{ fontFamily: 'var(--font-mono, monospace)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Base Commercial Price (PKR)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={baseSellingPrice}
                      onChange={(e) => setBaseSellingPrice(parseFloat(e.target.value) || 0)}
                      style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Product Type
                    </label>
                    <Input
                      value={productType}
                      onChange={(e) => setProductType(e.target.value)}
                      placeholder="e.g. EC, SC, Granules"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Brand
                    </label>
                    <Input
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="e.g. Shehswar Agro"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Grade
                    </label>
                    <Input
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="e.g. Premium / Technical"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* RAW MATERIAL DYNAMIC SUBFORM */}
            {/* ============================================================== */}
            {routeInfo?.targetEntity === 'RAW_MATERIAL' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Base Unit of Measure (UOM)
                    </label>
                    <Select
                      value={selectedBaseUomId}
                      onChange={(e) => setSelectedBaseUomId(typeof e === 'string' ? e : e.target?.value || '')}
                      options={[
                        { label: '-- Select Base UOM --', value: '' },
                        ...uoms.map((u) => ({
                          label: `${u.name} (${u.symbol || u.code})`,
                          value: u.id,
                        })),
                      ]}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Purchase Unit (Drum/Bag)
                    </label>
                    <Select
                      value={selectedPurchaseUomId}
                      onChange={(e) => setSelectedPurchaseUomId(typeof e === 'string' ? e : e.target?.value || '')}
                      options={[
                        { label: '-- Select Purchase UOM --', value: '' },
                        ...purchaseUoms.map((u) => ({
                          label: `${u.name} (${u.symbol || u.code})`,
                          value: u.id,
                        })),
                      ]}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Conversion Factor
                    </label>
                    <Input
                      type="number"
                      step="0.001"
                      value={conversionFactor}
                      onChange={(e) => setConversionFactor(parseFloat(e.target.value) || 1)}
                      placeholder="1 Drum = X Liters"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={batchControlled}
                      onChange={(e) => setBatchControlled(e.target.checked)}
                      style={{ borderRadius: '4px' }}
                    />
                    Batch Controlled Material
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={qcRequired}
                      onChange={(e) => setQcRequired(e.target.checked)}
                      style={{ borderRadius: '4px' }}
                    />
                    QC Inspection Required
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Storage Requirements / Handling Specs
                  </label>
                  <Input
                    value={storageRequirements}
                    onChange={(e) => setStorageRequirements(e.target.value)}
                    placeholder="e.g. Keep in cool, ventilated bay below 30°C"
                  />
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* PACKING MATERIAL DYNAMIC SUBFORM (Bottles, Cartons, Shrink...) */}
            {/* ============================================================== */}
            {routeInfo?.targetEntity === 'PACKING_MATERIAL' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Unit of Count
                    </label>
                    <Select
                      value={selectedBaseUomId}
                      onChange={(e) => setSelectedBaseUomId(typeof e === 'string' ? e : e.target?.value || '')}
                      options={[
                        { label: '-- Select Unit --', value: '' },
                        ...uoms.map((u) => ({
                          label: `${u.name} (${u.symbol || u.code})`,
                          value: u.id,
                        })),
                      ]}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Pack Compatibility
                    </label>
                    <Input
                      value={packCompatibility}
                      onChange={(e) => setPackCompatibility(e.target.value)}
                      placeholder="e.g. Fits 2L liquid bottles or 10KG boxes"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Minimum Stock Level
                    </label>
                    <Input
                      type="number"
                      value={minStock}
                      onChange={(e) => setMinStock(parseInt(e.target.value, 10) || 0)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Reorder Stock Level
                    </label>
                    <Input
                      type="number"
                      value={reorderLevel}
                      onChange={(e) => setReorderLevel(parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                </div>
              </div>
            )}
          </form>
        )}
      </Modal>

      {/* Sub-Modals */}
      <InlinePackagingModal
        isOpen={isPackagingModalOpen}
        onClose={() => setIsPackagingModalOpen(false)}
        onCreated={(created) => {
          setPackagingMaterials((prev) => [created, ...prev]);
          setSelectedPackagingId(created.id);
        }}
      />

      <InlineUnitModal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        onCreated={(created) => {
          setUoms((prev) => [created, ...prev]);
          setPackSizeUnit(created.name);
          setSelectedBaseUomId(created.id);
        }}
      />

      <InlineCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCreated={(created) => {
          setCategories((prev) => [created, ...prev]);
          setSelectedCategoryId(created.id);
        }}
      />
    </>
  );
};
