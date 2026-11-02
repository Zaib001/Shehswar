'use client';

/**
 * SHEHSWAR ONE360 - Inline Packaging Creation Modal
 *
 * Mandate: "+ Add New Packaging" creates a REAL PackingMaterial record in the database
 * (e.g. 2L HDPE Bottle, Code PM-XXXXXX, Category = Bottles 41-82).
 * Styled using the standard Shehswar ERP Modal and Form controls.
 */
import React, { useState, useEffect } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import { Modal, Button, Input, Select } from '../ui';

interface InlinePackagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (createdPackaging: { id: string; materialCode: string; materialName: string; lastPurchaseCost?: number }) => void;
}

export const InlinePackagingModal: React.FC<InlinePackagingModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [urduName, setUrduName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [baseUomId, setBaseUomId] = useState('');
  const [uoms, setUoms] = useState<any[]>([]);
  const [unitCost, setUnitCost] = useState<number>(45);
  const [packCompatibility, setPackCompatibility] = useState('2L Liquid Formulations');
  const [minStock, setMinStock] = useState<number>(500);
  const [reorderLevel, setReorderLevel] = useState<number>(200);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      ApiClient.get<any[]>('/api/v1/master-data/material-categories').then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
        setCategories(list);
        const bottles = list.find((c: any) => c.code === '41-82' || c.name.toLowerCase().includes('bottle'));
        if (bottles) setCategoryId(bottles.id);
        else if (list.length > 0) setCategoryId(list[0].id);
      }).catch(console.error);

      ApiClient.get<any[]>('/api/v1/master-data/units-of-measure').then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
        setUoms(list);
        const nos = list.find((u: any) => u.code === 'NOS' || u.name.toLowerCase().includes('piece'));
        if (nos) setBaseUomId(nos.id);
        else if (list.length > 0) setBaseUomId(list[0].id);
      }).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ title: 'Validation', message: 'Packaging Name is required', type: 'warning' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await ApiClient.post<any>('/api/v1/master-data/unified-items', {
        categoryId,
        itemName: name.trim(),
        urduName: urduName.trim() || undefined,
        baseUomId: baseUomId || undefined,
        packCompatibility,
        minimumStock: minStock,
        reorderLevel,
      });

      const item = res.data?.item || res.data;
      showToast({
        title: 'Packaging Created',
        message: `Created ${item.materialCode || ''} ${item.materialName}`,
        type: 'success',
      });

      onCreated({
        id: item.id,
        materialCode: item.materialCode || res.data?.code,
        materialName: item.materialName || name.trim(),
        lastPurchaseCost: unitCost,
      });
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Error',
        message: err.response?.data?.message || err.message || 'Failed to create packaging material',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Packaging Material"
      description="Registers a real physical packaging item (e.g. 2L HDPE Bottle, 10KG Box) in Packing Materials"
      size="md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSaving}
            style={{ backgroundColor: '#2563EB', borderColor: '#2563EB', color: '#fff' }}
          >
            Create Packaging
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Packaging Material Name *
          </label>
          <Input
            required
            placeholder="e.g. 2 Liter HDPE Square Bottle"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Urdu Name
          </label>
          <Input
            dir="rtl"
            placeholder="دو لیٹر بوتل"
            value={urduName}
            onChange={(e) => setUrduName(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Category
            </label>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(typeof e === 'string' ? e : e.target?.value || '')}
              options={categories.map((c) => ({
                label: `${c.code ? `[${c.code}] ` : ''}${c.name}`,
                value: c.id,
              }))}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Unit of Count
            </label>
            <Select
              value={baseUomId}
              onChange={(e) => setBaseUomId(typeof e === 'string' ? e : e.target?.value || '')}
              options={uoms.map((u) => ({
                label: `${u.name} (${u.symbol || u.code})`,
                value: u.id,
              }))}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Pack Compatibility
          </label>
          <Input
            placeholder="e.g. 2L Liquid Formulations"
            value={packCompatibility}
            onChange={(e) => setPackCompatibility(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Standard Purchase Cost (PKR)
            </label>
            <Input
              type="number"
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
              style={{ fontFamily: 'var(--font-mono, monospace)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Minimum Stock
            </label>
            <Input
              type="number"
              value={minStock}
              onChange={(e) => setMinStock(parseInt(e.target.value, 10) || 0)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Reorder Level
            </label>
            <Input
              type="number"
              value={reorderLevel}
              onChange={(e) => setReorderLevel(parseInt(e.target.value, 10) || 0)}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};
