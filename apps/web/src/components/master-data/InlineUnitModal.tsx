'use client';

/**
 * SHEHSWAR ONE360 - Inline Unit of Measure Creation Modal
 *
 * Full Enterprise UI matching Canonical Shehswar ERP Design System:
 * - Uses standard Modal component from '../ui'
 * - Standard Input, Select, Button from '../ui'
 */
import React, { useState } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import { Modal, Button, Input, Select } from '../ui';

interface InlineUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (createdUnit: { id: string; code: string; name: string }) => void;
}

export const InlineUnitModal: React.FC<InlineUnitModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'VOLUME' | 'WEIGHT' | 'COUNT' | 'LENGTH'>('VOLUME');
  const [symbol, setSymbol] = useState('');
  const decimalPlaces = 3;
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ title: 'Validation', message: 'Unit Name is required', type: 'warning' });
      return;
    }

    setIsSaving(true);
    try {
      const generatedCode = code.trim().toUpperCase() || name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const res = await ApiClient.post<any>('/api/v1/master-data/units-of-measure', {
        code: generatedCode,
        name: name.trim(),
        category,
        symbol: symbol.trim() || generatedCode,
        decimalPlaces,
        isBaseUnit: false,
      });

      const unit = res.data?.data || res.data;
      showToast({
        title: 'Unit Created',
        message: `Created unit "${unit.name}" (${unit.code})`,
        type: 'success',
      });

      onCreated({
        id: unit.id,
        code: unit.code,
        name: unit.name,
      });
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Error',
        message: err.response?.data?.message || err.message || 'Failed to create unit',
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
      title="Create Unit of Measure (UOM)"
      description="Registers a standard measuring unit for formulations or packaging"
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
            Create Unit
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Unit Name *
          </label>
          <Input
            required
            placeholder="e.g. Milliliter, Gallon, Carton"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!symbol) setSymbol(e.target.value.slice(0, 3));
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Unit Code
            </label>
            <Input
              placeholder="e.g. ML, GAL"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{ fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Symbol
            </label>
            <Input
              placeholder="e.g. mL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              style={{ fontFamily: 'var(--font-mono, monospace)' }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Measurement Category
          </label>
          <Select
            value={category}
            onChange={(e) => setCategory((typeof e === 'string' ? e : e.target?.value || 'VOLUME') as any)}
            options={[
              { label: 'Volume (Liquid)', value: 'VOLUME' },
              { label: 'Weight (Solid / Powder)', value: 'WEIGHT' },
              { label: 'Count (Pieces / Items)', value: 'COUNT' },
              { label: 'Length (Dimension)', value: 'LENGTH' },
            ]}
          />
        </div>
      </form>
    </Modal>
  );
};
