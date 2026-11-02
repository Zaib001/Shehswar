'use client';

/**
 * SHEHSWAR ONE360 - Inline Category Creation Modal
 *
 * Full Enterprise UI matching Canonical Shehswar ERP Design System:
 * - Uses standard Modal component from '../ui'
 * - Standard Input, Select, Button from '../ui'
 */
import React, { useState } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import { Modal, Button, Input, Select } from '../ui';

interface InlineCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (createdCategory: { id: string; code: string; name: string; entityType: string }) => void;
}

export const InlineCategoryModal: React.FC<InlineCategoryModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [categoryType, setCategoryType] = useState<'FINISHED_PRODUCT' | 'RAW_MATERIAL' | 'PACKING_MATERIAL'>('PACKING_MATERIAL');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ title: 'Validation', message: 'Category Name is required', type: 'warning' });
      return;
    }

    setIsSaving(true);
    try {
      if (categoryType === 'FINISHED_PRODUCT') {
        const res = await ApiClient.post<any>('/api/v1/master-data/product-categories', {
          name: name.trim(),
          description: description.trim() || undefined,
        });
        const cat = res.data?.data || res.data;
        showToast({ title: 'Category Created', message: `Created "${cat.name}" (${cat.code})`, type: 'success' });
        onCreated({ id: cat.id, code: cat.code, name: cat.name, entityType: 'FINISHED_PRODUCT' });
      } else {
        const res = await ApiClient.post<any>('/api/v1/master-data/material-categories', {
          name: name.trim(),
          categoryType: categoryType === 'RAW_MATERIAL' ? 'RAW_MATERIAL' : 'PACKING_MATERIAL',
          description: description.trim() || undefined,
        });
        const cat = res.data?.data || res.data;
        showToast({ title: 'Category Created', message: `Created "${cat.name}" (${cat.code})`, type: 'success' });
        onCreated({ id: cat.id, code: cat.code, name: cat.name, entityType: categoryType });
      }
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Error',
        message: err.response?.data?.message || err.message || 'Failed to create category',
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
      title="Create New Category"
      description="Registers a new classification under the 41-XX master hierarchy"
      size="sm"
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
            Create Category
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Category Group *
          </label>
          <Select
            value={categoryType}
            onChange={(e) => setCategoryType((typeof e === 'string' ? e : e.target?.value || 'PACKING_MATERIAL') as any)}
            options={[
              { label: 'Packing Material (Bottles, Cartons, Shrink, etc.)', value: 'PACKING_MATERIAL' },
              { label: 'Raw Material (Active Ingredients, Solvents)', value: 'RAW_MATERIAL' },
              { label: 'Finished Goods (Commercial Formulations)', value: 'FINISHED_PRODUCT' },
            ]}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Category Name *
          </label>
          <Input
            required
            placeholder="e.g. Drums, Jerry Cans, Foil Seals"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Description (Optional)
          </label>
          <Input
            placeholder="Purpose and classification notes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
};
