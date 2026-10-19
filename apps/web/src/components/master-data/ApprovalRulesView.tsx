'use client';

import React, { useState } from 'react';
import { INITIAL_APPROVAL_RULES } from './mock-data';
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
  StatusBadge,
  Badge,
} from '../ui';
import { IconPlus, IconCheck } from '../icons';
import { useToast } from '../../context/toast-context';

export interface ApprovalRuleItem {
  id: string;
  name: string;
  module: string;
  documentType: string;
  condition: string;
  approverRole: string;
  level: number;
  status: string;
}

export const ApprovalRulesView: React.FC = () => {
  const { showToast } = useToast();
  const [rules, setRules] = useState<ApprovalRuleItem[]>(INITIAL_APPROVAL_RULES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalRuleItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    module: 'Procurement',
    documentType: 'PO',
    condition: 'Amount > 1,000,000 PKR',
    approverRole: 'Finance Director',
    level: 1,
    status: 'ACTIVE',
  });

  const columns: ColumnDef<ApprovalRuleItem>[] = [
    {
      id: 'name',
      header: 'Workflow Rule Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.original.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Module: {row.original.module} ({row.original.documentType})
          </div>
        </div>
      ),
    },
    {
      id: 'condition',
      header: 'Evaluation Trigger Condition',
      accessorKey: 'condition',
      cell: ({ row }) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, background: 'var(--bg-card-subtle)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
          {row.original.condition}
        </span>
      ),
    },
    {
      id: 'level',
      header: 'Hierarchy Level',
      accessorKey: 'level',
      cell: ({ row }) => (
        <Badge variant={row.original.level === 1 ? 'info' : 'primary'}>
          Tier {row.original.level} Approval
        </Badge>
      ),
    },
    {
      id: 'approver',
      header: 'Authorizing Role',
      accessorKey: 'approverRole',
      cell: ({ row }) => <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{row.original.approverRole}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingRule(row.original);
              setFormData({ ...row.original });
              setIsModalOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            style={{ color: 'var(--color-danger)' }}
            onClick={() => {
              setRules(rules.filter((r) => r.id !== row.original.id));
              showToast({ title: 'Rule Deactivated', message: `Approval rule removed`, type: 'info' });
            }}
          >
            Remove
          </Button>
        </div>
      ),
    },
  ];

  const handleSave = () => {
    if (!formData.name || !formData.condition) {
      showToast({ title: 'Validation Error', message: 'Name and trigger condition are required', type: 'error' });
      return;
    }

    if (editingRule) {
      const updated = rules.map((r) => (r.id === editingRule.id ? { ...formData, id: r.id } : r));
      setRules(updated);
      showToast({ title: 'Rule Updated', message: `Approval rule ${formData.name} updated`, type: 'success' });
    } else {
      const newRule: ApprovalRuleItem = {
        id: `rule-${Date.now()}`,
        ...formData,
      };
      setRules([newRule, ...rules]);
      showToast({ title: 'Rule Created', message: `Approval rule ${newRule.name} activated`, type: 'success' });
    }
    setIsModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <CardTitle>Reusable Approval Workflow Foundation</CardTitle>
              <CardDescription>
                Define multi-level document approval rules based on amount thresholds, company context, and authorizing roles.
              </CardDescription>
            </div>
            <Button
              variant="primary"
              icon={<IconPlus size={16} />}
              onClick={() => {
                setEditingRule(null);
                setFormData({
                  name: '',
                  module: 'Procurement',
                  documentType: 'PO',
                  condition: 'Amount > 1,000,000 PKR',
                  approverRole: 'Finance Director',
                  level: 1,
                  status: 'ACTIVE',
                });
                setIsModalOpen(true);
              }}
            >
              Add Approval Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={rules} />
        </CardContent>
      </Card>

      {/* Rule Configuration Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRule ? 'Edit Approval Rule' : 'Create New Approval Rule'}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon={<IconCheck size={16} />} onClick={handleSave}>
              Save Rule
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Rule Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Executive Purchase Order Tier 2"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Select
              label="ERP Business Module"
              value={formData.module}
              onChange={(e) => setFormData({ ...formData, module: e.target.value })}
              options={[
                { value: 'Procurement', label: 'Procurement' },
                { value: 'Sales', label: 'Commercial Sales' },
                { value: 'Production', label: 'Chemical Production' },
                { value: 'Finance', label: 'Corporate Finance' },
              ]}
            />
            <Select
              label="Document Type"
              value={formData.documentType}
              onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
              options={[
                { value: 'PO', label: 'Purchase Order (PO)' },
                { value: 'SO', label: 'Sales Order (SO)' },
                { value: 'BATCH', label: 'Production Batch' },
                { value: 'INV', label: 'Tax Invoice' },
              ]}
            />
          </div>
          <Input
            label="Trigger Condition Expression *"
            value={formData.condition}
            onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
            placeholder="e.g. Amount > 1,000,000 PKR"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Select
              label="Authorizing Role *"
              value={formData.approverRole}
              onChange={(e) => setFormData({ ...formData, approverRole: e.target.value })}
              options={[
                { value: 'Finance Director', label: 'Finance Director' },
                { value: 'Plant Manager', label: 'Plant Manager' },
                { value: 'Commercial Sales Director', label: 'Commercial Sales Director' },
                { value: 'Chief Quality Chemist', label: 'Chief Quality Chemist' },
                { value: 'Managing Director', label: 'Managing Director' },
              ]}
            />
            <Select
              label="Approval Step Tier"
              value={formData.level.toString()}
              onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value, 10) || 1 })}
              options={[
                { value: '1', label: 'Level 1 (Direct Supervisor)' },
                { value: '2', label: 'Level 2 (Executive Escalation)' },
              ]}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
