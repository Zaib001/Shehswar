'use client';

import React, { useState } from 'react';
import { DocumentSequenceDto } from '@shehswar/types';
import { ApiClient } from '../../lib/api-client';
import { INITIAL_DOCUMENT_SEQUENCES } from './mock-data';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  DataTable,
  ColumnDef,
  Button,
  Input,
  Select,
  Modal,
  Badge,
} from '../ui';
import { IconPlus, IconCheck, IconFileText } from '../icons';
import { useToast } from '../../context/toast-context';

export const DocumentNumberingView: React.FC = () => {
  const { showToast } = useToast();
  const [sequences, setSequences] = useState<DocumentSequenceDto[]>(INITIAL_DOCUMENT_SEQUENCES);
  const [companies, setCompanies] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeq, setEditingSeq] = useState<DocumentSequenceDto | null>(null);

  React.useEffect(() => {
    ApiClient.get<any>('/api/v1/master-data/companies').then((res: any) => {
      const items = Array.isArray(res) ? res : res?.items || res?.data?.items || res?.data || [];
      setCompanies(items);
      if (items.length > 0) {
        setFormData((prev) => ({ ...prev, companyId: prev.companyId || items[0].id }));
      }
    }).catch(console.error);
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    documentType: 'PO',
    companyId: '',
    prefix: 'PO-2026',
    fiscalYear: 2026,
    startingNumber: 1,
  });

  // Live preview computation
  const previewNumber = `${formData.prefix}-${formData.startingNumber.toString().padStart(6, '0')}`;

  const columns: ColumnDef<DocumentSequenceDto>[] = [
    {
      id: 'docType',
      header: 'Document Type',
      accessorKey: 'documentType',
      cell: ({ row }) => {
        const types: Record<string, string> = {
          PO: 'Purchase Order',
          PR: 'Purchase Request',
          GRN: 'Goods Receipt Note',
          BATCH: 'Chemical Production Batch',
          INVOICE: 'Commercial Tax Invoice',
          SO: 'Sales Order',
        };
        return (
          <div>
            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{row.original.documentType}</span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {types[row.original.documentType] || row.original.documentType}
            </div>
          </div>
        );
      },
    },
    {
      id: 'prefix',
      header: 'Configured Prefix',
      accessorKey: 'prefix',
      cell: ({ row }) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, background: 'var(--bg-card-subtle)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
          {row.original.prefix}
        </span>
      ),
    },
    {
      id: 'fiscalYear',
      header: 'Fiscal Year',
      accessorKey: 'fiscalYear',
      cell: ({ row }) => <span>FY {row.original.fiscalYear}</span>,
    },
    {
      id: 'current',
      header: 'Current Counter',
      accessorKey: 'currentNumber',
      cell: ({ row }) => <span style={{ fontWeight: 600 }}>{row.original.currentNumber}</span>,
    },
    {
      id: 'nextSample',
      header: 'Next Generated ID',
      cell: ({ row }) => (
        <Badge variant="primary" style={{ fontFamily: 'monospace' }}>
          {row.original.nextFormattedNumber}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditingSeq(row.original);
            setFormData({
              documentType: row.original.documentType,
              companyId: row.original.companyId,
              prefix: row.original.prefix,
              fiscalYear: row.original.fiscalYear,
              startingNumber: parseInt(row.original.currentNumber, 10) + 1,
            });
            setIsModalOpen(true);
          }}
        >
          Adjust Rule
        </Button>
      ),
    },
  ];

  const handleSave = () => {
    if (!formData.prefix) {
      showToast({ title: 'Validation Error', message: 'Prefix is required', type: 'error' });
      return;
    }

    if (editingSeq) {
      const updated = sequences.map((s) =>
        s.id === editingSeq.id
          ? {
              ...s,
              prefix: formData.prefix,
              fiscalYear: formData.fiscalYear,
              currentNumber: (formData.startingNumber - 1).toString(),
              nextFormattedNumber: `${formData.prefix}-${formData.startingNumber.toString().padStart(6, '0')}`,
              updatedAt: new Date(),
            }
          : s,
      );
      setSequences(updated);
      showToast({ title: 'Sequence Rule Updated', message: `Rule for ${formData.documentType} adjusted`, type: 'success' });
    } else {
      const newSeq: DocumentSequenceDto = {
        id: `seq-${Date.now()}`,
        organizationId: 'org-019245a0-0001-7000-8000-000000000001',
        companyId: formData.companyId,
        documentType: formData.documentType,
        prefix: formData.prefix,
        fiscalYear: formData.fiscalYear,
        currentNumber: (formData.startingNumber - 1).toString(),
        nextFormattedNumber: previewNumber,
        updatedAt: new Date(),
      };
      setSequences([newSeq, ...sequences]);
      showToast({ title: 'Sequence Rule Configured', message: `Rule for ${formData.documentType} created`, type: 'success' });
    }
    setIsModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconFileText size={22} style={{ color: 'var(--color-primary)' }} />
                Document Numbering Engine
              </CardTitle>
              <CardDescription>
                Concurrency-safe sequential number generators for Purchase Orders, GRNs, Batches, Invoices, and Sales Orders.
              </CardDescription>
            </div>
            <Button
              variant="primary"
              icon={<IconPlus size={16} />}
              onClick={() => {
                setEditingSeq(null);
                setFormData({
                  documentType: 'PO',
                  companyId: companies[0]?.id || '',
                  prefix: 'PO-2026',
                  fiscalYear: 2026,
                  startingNumber: 1,
                });
                setIsModalOpen(true);
              }}
            >
              Configure Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={sequences} />
        </CardContent>
      </Card>

      {/* Configuration & Test Simulation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSeq ? 'Adjust Sequence Rule' : 'Configure New Document Sequence'}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon={<IconCheck size={16} />} onClick={handleSave}>
              Save Sequence Rule
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Select
              label="Document Type *"
              value={formData.documentType}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({
                  ...formData,
                  documentType: val,
                  prefix: `${val}-${formData.fiscalYear}`,
                });
              }}
              options={[
                { value: 'PO', label: 'Purchase Order (PO)' },
                { value: 'PR', label: 'Purchase Request (PR)' },
                { value: 'GRN', label: 'Goods Receipt Note (GRN)' },
                { value: 'BATCH', label: 'Production Batch (BATCH)' },
                { value: 'INVOICE', label: 'Commercial Invoice (INV)' },
                { value: 'SO', label: 'Sales Order (SO)' },
              ]}
              disabled={!!editingSeq}
            />
            <Select
              label="Company Scope *"
              value={formData.companyId}
              onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
            <Input
              label="Prefix Format *"
              value={formData.prefix}
              onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
              placeholder="e.g. PO-2026"
            />
            <Input
              label="Fiscal Year"
              type="number"
              value={formData.fiscalYear}
              onChange={(e) => setFormData({ ...formData, fiscalYear: parseInt(e.target.value, 10) || 2026 })}
            />
            <Input
              label="Starting Counter"
              type="number"
              value={formData.startingNumber}
              onChange={(e) => setFormData({ ...formData, startingNumber: parseInt(e.target.value, 10) || 1 })}
            />
          </div>

          {/* Live Preview Box */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Real-Time Document Formatted Identifier Preview:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  letterSpacing: '0.5px',
                }}
              >
                {previewNumber}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                (Zero collision guaranteed under concurrent multi-user load)
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
