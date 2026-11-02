'use client';

/**
 * SHEHSWAR ONE360 - Inline Commercial Pack Size Creation Modal
 *
 * Full Enterprise UI matching Canonical Shehswar ERP Design System:
 * - Creates dynamic PackSize records with auto-generated PS-XXXXXX codes
 * - Zero hardcoding: completely data-driven
 * - Real UOM integration with inline "+ Add New Unit" modal trigger
 * - Auto-selects the created PackSize in Finished Product creation without page reload
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import { Modal, Button, Input, Select } from '../ui';
import { IconPackage, IconPlus } from '../icons';
import { InlineUnitModal } from './InlineUnitModal';

export interface CreatedPackSizeItem {
  id: string;
  code: string;
  name: string;
  quantity: number;
  uomId?: string;
  uom?: { id: string; code: string; name: string; symbol?: string };
}

interface InlinePackSizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (createdPackSize: CreatedPackSizeItem) => void;
  defaultUnit?: string;
}

export const InlinePackSizeModal: React.FC<InlinePackSizeModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  defaultUnit,
}) => {
  const { showToast } = useToast();
  const [previewCode, setPreviewCode] = useState('PS-XXXXXX');
  const [quantity, setQuantity] = useState<number | ''>(2);
  const [uoms, setUoms] = useState<any[]>([]);
  const [selectedUomId, setSelectedUomId] = useState<string>('');
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load next code and active UOMs
  const loadPrerequisites = useCallback(async () => {
    try {
      const [uomRes, codeRes] = await Promise.all([
        ApiClient.get<any[]>('/api/v1/master-data/units-of-measure'),
        ApiClient.get<{ nextCode: string }>('/api/v1/master-data/next-code?entityType=PACK_SIZE'),
      ]);

      const uomList = Array.isArray(uomRes.data) ? uomRes.data : (uomRes.data as any)?.data || [];
      setUoms(uomList);

      if (uomList.length > 0 && !selectedUomId) {
        if (defaultUnit) {
          const match = uomList.find(
            (u: any) =>
              u.code?.toLowerCase() === defaultUnit.toLowerCase() ||
              u.symbol?.toLowerCase() === defaultUnit.toLowerCase() ||
              u.name?.toLowerCase() === defaultUnit.toLowerCase()
          );
          setSelectedUomId(match ? match.id : uomList[0].id);
        } else {
          const defaultL = uomList.find((u: any) => u.code === 'LITER' || u.name === 'Liter') || uomList[0];
          setSelectedUomId(defaultL.id);
        }
      }

      if (codeRes.data?.nextCode) {
        setPreviewCode(codeRes.data.nextCode);
      }
    } catch {
      // background load
    }
  }, [defaultUnit, selectedUomId]);

  useEffect(() => {
    if (isOpen) {
      loadPrerequisites();
    }
  }, [isOpen, loadPrerequisites]);

  if (!isOpen) return null;

  const selectedUom = uoms.find((u) => u.id === selectedUomId);
  const unitLabel = selectedUom?.symbol || selectedUom?.name || 'Unit';
  const previewLabel = quantity ? `${quantity} ${unitLabel}` : '—';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || Number(quantity) <= 0) {
      showToast({ title: 'Validation', message: 'Please enter a valid commercial volume / quantity', type: 'warning' });
      return;
    }

    if (!selectedUomId) {
      showToast({ title: 'Validation', message: 'Please select a unit of measure', type: 'warning' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await ApiClient.post<any>('/api/v1/master-data/pack-sizes', {
        code: 'AUTO',
        quantity: Number(quantity),
        uomId: selectedUomId,
        name: `${quantity} ${unitLabel}`,
      });

      const ps = res.data?.data || res.data;
      showToast({
        title: 'Pack Size Created',
        message: `Registered "${ps.name}" with Code ${ps.code || previewCode}`,
        type: 'success',
      });

      onCreated({
        id: ps.id,
        code: ps.code || previewCode,
        name: ps.name || `${quantity} ${unitLabel}`,
        quantity: Number(ps.quantity || quantity),
        uomId: selectedUomId,
        uom: selectedUom,
      });

      onClose();
    } catch (err: any) {
      showToast({
        title: 'Creation Failed',
        message: err.response?.data?.message || err.message || 'Failed to create Pack Size',
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
      title="Add Commercial Pack Size"
      description="Define a dynamic commercial pack volume and unit. Pack Size Code is automatically generated."
      size="sm"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Code:</span>
            <code
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 700,
                color: '#6366F1',
                background: '#EEF2FF',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid #C7D2FE',
                fontSize: '0.75rem',
              }}
            >
              {previewCode}
            </code>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              isLoading={isSaving}
              style={{ backgroundColor: '#6366F1', borderColor: '#6366F1', color: '#fff' }}
            >
              Save Pack Size
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconPackage size={16} color="#6366F1" />
            <span style={{ fontSize: '0.78rem', color: '#475569' }}>Resulting Commercial Label:</span>
          </div>
          <strong style={{ fontSize: '0.88rem', color: '#0F172A', fontFamily: 'var(--font-mono, monospace)' }}>
            {previewLabel}
          </strong>
        </div>

        <div>
          <Input
            label="Commercial Volume / Quantity *"
            type="number"
            step="any"
            placeholder="e.g. 3.5, 750, 25, 2, 0.5"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
            autoFocus
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
              Unit of Measure Master *
            </label>
            <button
              type="button"
              onClick={() => setIsUnitModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6366F1',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <IconPlus size={12} /> Add New Unit
            </button>
          </div>
          <Select
            value={selectedUomId}
            onChange={(e) => setSelectedUomId(e.target.value)}
            options={uoms.map((u) => ({
              value: u.id,
              label: `${u.name} (${u.symbol || u.code})`,
            }))}
          />
        </div>
      </form>

      {/* Inline Unit Modal */}
      <InlineUnitModal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        onCreated={(newUom) => {
          setUoms((prev) => [newUom, ...prev]);
          setSelectedUomId(newUom.id);
          setIsUnitModalOpen(false);
        }}
      />
    </Modal>
  );
};

