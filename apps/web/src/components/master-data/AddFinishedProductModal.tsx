'use client';

/**
 * SHEHSWAR ONE360 - Dedicated Add Finished Product Modal
 *
 * Full Enterprise UI matching Canonical Shehswar ERP Design System:
 * - Exclusively for creating Finished Products (FG-XXXXXX)
 * - Zero cross-entity category routing layer (no Raw/Packing Material switching)
 * - Auto-generated sequential code preview (FG-XXXXXX)
 * - Strict separation between Product Master and Product Costing
 * - Supports inline creation of Packaging, Units, and Categories via submodals
 * - Directly persists to live PostgreSQL database via unified-items API
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
  IconFlask,
  IconTag,
} from '../icons';
import { InlinePackagingModal } from './InlinePackagingModal';
import { InlineUnitModal } from './InlineUnitModal';
import { InlineCategoryModal } from './InlineCategoryModal';

export interface AddFinishedProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated?: (createdProduct: any) => void;
  defaultCategoryId?: string;
}

export const AddFinishedProductModal: React.FC<AddFinishedProductModalProps> = ({
  isOpen,
  onClose,
  onProductCreated,
  defaultCategoryId,
}) => {
  const { showToast } = useToast();

  // Core Form Fields
  const [previewCode, setPreviewCode] = useState<string>('FG-XXXXXX');
  const [productName, setProductName] = useState('');
  const [urduName, setUrduName] = useState('');
  const [description, setDescription] = useState('');

  // Classification & Formulation
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(defaultCategoryId || '');
  const [categories, setCategories] = useState<any[]>([]);
  const [productType, setProductType] = useState('EC');
  const [mType, setMType] = useState('Insecticides');

  // Packaging & Commercial Details
  const [packagingMaterials, setPackagingMaterials] = useState<any[]>([]);
  const [selectedPackagingId, setSelectedPackagingId] = useState<string>('');
  const [packSizeQuantity, setPackSizeQuantity] = useState<number>(1000);
  const [packSizeUnit, setPackSizeUnit] = useState('ML');
  const [uoms, setUoms] = useState<any[]>([]);
  const [ppc, setPpc] = useState<number>(12); // Packs Per Carton
  const [baseSellingPrice, setBaseSellingPrice] = useState<number>(1250);
  const [brand, setBrand] = useState('Shehswar Agro');
  const [grade, setGrade] = useState('Standard');
  const [isActive, setIsActive] = useState(true);

  // Sub-modals for inline creation
  const [isPackagingModalOpen, setIsPackagingModalOpen] = useState(false);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Status & Validation
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);

  // 1. Fetch Prerequisites (Categories, Packaging Materials, Units, Next Code)
  const loadPrerequisites = useCallback(async () => {
    try {
      const [catsRes, pmRes, uomRes, codeRes] = await Promise.all([
        ApiClient.get<any[]>('/api/v1/master-data/unified-categories'),
        ApiClient.get<any[]>('/api/v1/master-data/packing-materials'),
        ApiClient.get<any[]>('/api/v1/master-data/units-of-measure'),
        ApiClient.get<{ nextCode: string }>('/api/v1/master-data/next-code?entityType=FINISHED_PRODUCT'),
      ]);

      const catList = Array.isArray(catsRes.data) ? catsRes.data : (catsRes.data as any)?.data || [];
      // Filter to Finished Goods categories
      const fgCats = catList.filter(
        (c: any) =>
          c.code === '41-01' ||
          c.categoryType === 'FINISHED_PRODUCT' ||
          c.categoryType === 'FINISHED_GOODS' ||
          c.name?.toLowerCase().includes('finished') ||
          c.name?.toLowerCase().includes('insecticide') ||
          c.name?.toLowerCase().includes('herbicide')
      );
      const effectiveCats = fgCats.length > 0 ? fgCats : catList;
      setCategories(effectiveCats);

      if (!selectedCategoryId && effectiveCats.length > 0) {
        setSelectedCategoryId(effectiveCats[0].id);
      }

      const pmList = Array.isArray(pmRes.data) ? pmRes.data : (pmRes.data as any)?.data || [];
      setPackagingMaterials(pmList);
      if (pmList.length > 0 && !selectedPackagingId) {
        setSelectedPackagingId(pmList[0].id);
      }

      const uomList = Array.isArray(uomRes.data) ? uomRes.data : (uomRes.data as any)?.data || [];
      setUoms(uomList);

      if (codeRes.data?.nextCode) {
        setPreviewCode(codeRes.data.nextCode);
      }
    } catch {
      // Ignore background load error
    }
  }, [selectedCategoryId, selectedPackagingId]);

  useEffect(() => {
    if (isOpen) {
      loadPrerequisites();
    }
  }, [isOpen, loadPrerequisites]);

  // Duplicate Check
  const checkDuplicateName = async (name: string) => {
    if (!name || name.trim().length < 3) {
      setDuplicateWarning(null);
      return;
    }
    try {
      const res = await ApiClient.get<any>(
        `/api/v1/master-data/check-duplicate?name=${encodeURIComponent(name.trim())}&entityType=FINISHED_PRODUCT`
      );
      if (res.data?.isDuplicate) {
        setDuplicateWarning(res.data);
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      setDuplicateWarning(null);
    }
  };

  // Reset Form
  const resetForm = () => {
    setProductName('');
    setUrduName('');
    setDescription('');
    setProductType('EC');
    setMType('Insecticides');
    setPackSizeQuantity(1000);
    setPackSizeUnit('ML');
    setPpc(12);
    setBaseSellingPrice(1250);
    setBrand('Shehswar Agro');
    setGrade('Standard');
    setIsActive(true);
    setDuplicateWarning(null);
  };

  // Submit Handler
  const handleSaveProduct = async () => {
    if (!productName.trim()) {
      showToast({ title: 'Validation Error', message: 'Product Name is required', type: 'error' });
      return;
    }

    if (!selectedCategoryId) {
      showToast({ title: 'Validation Error', message: 'Product Category is required', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        categoryId: selectedCategoryId,
        itemName: productName.trim(),
        urduName: urduName.trim() || undefined,
        description: description.trim() || undefined,
        brand: brand.trim() || 'Shehswar Agro',
        grade: grade.trim() || 'Standard',
        productType: productType.trim() || 'EC',
        mType: mType.trim() || 'Insecticides',
        packagingMaterialId: selectedPackagingId || undefined,
        packingQuantity: packSizeQuantity ? Number(packSizeQuantity) : 1,
        packingUnit: packSizeUnit || 'ML',
        ppc: ppc ? Number(ppc) : 1,
        baseSellingPrice: baseSellingPrice ? Number(baseSellingPrice) : undefined,
        status: isActive ? 'ACTIVE' : 'INACTIVE',
      };

      const res = await ApiClient.post<any>('/api/v1/master-data/unified-items', payload);

      showToast({
        title: 'Finished Product Created',
        message: `${res.data?.data?.productName || productName} (${res.data?.generatedCode || previewCode}) registered in Master Catalog`,
        type: 'success',
      });

      if (onProductCreated) {
        onProductCreated(res.data?.data);
      }

      resetForm();
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Creation Failed',
        message: err.response?.data?.message || err.message || 'Failed to create finished product',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Finished Product"
      description="Register a new commercial formulation to the Product Master catalog. Cost calculations are segregated into the Product Costing Engine."
      size="xl"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Assigned Code:</span>
            <code
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 700,
                color: '#10B981',
                background: '#ECFDF5',
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid #A7F3D0',
                fontSize: '0.8rem',
              }}
            >
              {previewCode}
            </code>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveProduct}
              isLoading={isSaving}
              style={{ backgroundColor: '#10B981', borderColor: '#10B981', color: '#fff' }}
            >
              <IconCheck size={16} /> Save Finished Product
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Top Architecture Notice Banner */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#DCFCE7',
                color: '#15803D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconFlask size={18} />
            </div>
            <div>
              <strong style={{ fontSize: '0.82rem', color: '#166534', display: 'block' }}>
                Product Master Entry Point (Finished Goods)
              </strong>
              <span style={{ fontSize: '0.74rem', color: '#15803D' }}>
                Defines product identity, commercial packing size, PPC, and selling rates. Raw material BOMs and batch costing are segregated in the Costing Engine.
              </span>
            </div>
          </div>
        </div>

        {/* 1. Basic Product Identity */}
        <div>
          <h4
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#475569',
              marginBottom: '12px',
              borderBottom: '1px solid #E2E8F0',
              paddingBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <IconTag size={15} color="#10B981" /> 1. Formulation Identity & Classification
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <Input
                label="Product Name *"
                placeholder="e.g. Chlorpyrifos 40% EC Max"
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value);
                  checkDuplicateName(e.target.value);
                }}
              />
              {duplicateWarning && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#D97706',
                    fontSize: '0.74rem',
                    marginTop: '4px',
                    fontWeight: 600,
                  }}
                >
                  <IconAlertTriangle size={14} />
                  <span>Existing product found: {duplicateWarning.existingCode} - {duplicateWarning.existingName}</span>
                </div>
              )}
            </div>

            <div>
              <Input
                label="Urdu Name (RTL)"
                placeholder="مثال: کلورپائریفوس ۴۰٪ ای سی"
                value={urduName}
                onChange={(e) => setUrduName(e.target.value)}
                style={{ direction: 'rtl', fontFamily: 'sans-serif' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>Category *</label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  style={{ background: 'none', border: 'none', color: '#10B981', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Add Category
                </button>
              </div>
              <Select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                options={categories.map((c) => ({
                  value: c.id,
                  label: `${c.code ? `[${c.code}] ` : ''}${c.name}`,
                }))}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Classification (MType) *
              </label>
              <Select
                value={mType}
                onChange={(e) => setMType(e.target.value)}
                options={[
                  { value: 'Insecticides', label: 'Insecticides' },
                  { value: 'Herbicides', label: 'Herbicides' },
                  { value: 'Fungicides', label: 'Fungicides' },
                  { value: 'Fertilizers', label: 'Fertilizers / Nutrients' },
                  { value: 'Seeds', label: 'Seeds' },
                  { value: 'PGR_Nutrients', label: 'PGRs & Biostimulants' },
                  { value: 'Granules', label: 'Granules (GR)' },
                  { value: 'Others', label: 'Other Formulations' },
                ]}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Formulation Type *
              </label>
              <Select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                options={[
                  { value: 'EC', label: 'EC (Emulsifiable Concentrate)' },
                  { value: 'SC', label: 'SC (Suspension Concentrate)' },
                  { value: 'WDG', label: 'WDG (Water Dispersible Granules)' },
                  { value: 'SL', label: 'SL (Soluble Liquid)' },
                  { value: 'WP', label: 'WP (Wettable Powder)' },
                  { value: 'GR', label: 'GR (Granules)' },
                  { value: 'SP', label: 'SP (Soluble Powder)' },
                  { value: 'Liquid', label: 'Liquid Solution' },
                  { value: 'Powder', label: 'Dry Powder' },
                  { value: 'Granular', label: 'Granular Blend' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* 2. Packaging & Commercial Specifications */}
        <div>
          <h4
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#475569',
              marginBottom: '12px',
              borderBottom: '1px solid #E2E8F0',
              paddingBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <IconPackage size={15} color="#6366F1" /> 2. Packaging Configuration & Selling Rates
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '14px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>Packaging Container</label>
                <button
                  type="button"
                  onClick={() => setIsPackagingModalOpen(true)}
                  style={{ background: 'none', border: 'none', color: '#6366F1', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Add Packaging
                </button>
              </div>
              <Select
                value={selectedPackagingId}
                onChange={(e) => setSelectedPackagingId(e.target.value)}
                options={[
                  { value: '', label: '-- None / Custom Bottle --' },
                  ...packagingMaterials.map((p) => ({
                    value: p.id,
                    label: `${p.materialCode ? `[${p.materialCode}] ` : ''}${p.materialName}`,
                  })),
                ]}
              />
            </div>

            <div>
              <Input
                label="Pack Quantity *"
                type="number"
                value={packSizeQuantity}
                onChange={(e) => setPackSizeQuantity(Number(e.target.value))}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>Pack Unit *</label>
                <button
                  type="button"
                  onClick={() => setIsUnitModalOpen(true)}
                  style={{ background: 'none', border: 'none', color: '#6366F1', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Add Unit
                </button>
              </div>
              <Select
                value={packSizeUnit}
                onChange={(e) => setPackSizeUnit(e.target.value)}
                options={
                  uoms.length > 0
                    ? uoms.map((u) => ({
                        value: u.symbol || u.code,
                        label: `${u.name} (${u.symbol || u.code})`,
                      }))
                    : [
                        { value: 'ML', label: 'ML (Milliliter)' },
                        { value: 'Liter', label: 'Liter (L)' },
                        { value: 'GM', label: 'GM (Gram)' },
                        { value: 'KG', label: 'KG (Kilogram)' },
                        { value: 'Pack', label: 'Pack / Pouch' },
                        { value: 'Bottle', label: 'Bottle' },
                        { value: 'Drum', label: 'Drum' },
                      ]
                }
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div>
              <Input
                label="PPC (Packs Per Carton) *"
                type="number"
                value={ppc}
                onChange={(e) => setPpc(Number(e.target.value))}
                helperText="Units packed in 1 master box"
              />
            </div>

            <div>
              <Input
                label="Base Selling Price (PKR) *"
                type="number"
                value={baseSellingPrice}
                onChange={(e) => setBaseSellingPrice(Number(e.target.value))}
                helperText="Commercial seasonal rate"
              />
            </div>

            <div>
              <Input
                label="Brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>

            <div>
              <Input
                label="Grade / Formulation Strength"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 3. Description & Notes */}
        <div>
          <Input
            label="Commercial Notes & Technical Description"
            placeholder="Usage instructions, crop target, registration number, etc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* Sub-modals for inline creation */}
      <InlinePackagingModal
        isOpen={isPackagingModalOpen}
        onClose={() => setIsPackagingModalOpen(false)}
        onCreated={(newPm) => {
          setPackagingMaterials((prev) => [newPm, ...prev]);
          setSelectedPackagingId(newPm.id);
          setIsPackagingModalOpen(false);
        }}
      />

      <InlineUnitModal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        onCreated={(newUom) => {
          setUoms((prev) => [newUom, ...prev]);
          setPackSizeUnit(newUom.code);
          setIsUnitModalOpen(false);
        }}
      />

      <InlineCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCreated={(newCat) => {
          setCategories((prev) => [newCat, ...prev]);
          setSelectedCategoryId(newCat.id);
          setIsCategoryModalOpen(false);
        }}
      />
    </Modal>
  );
};
