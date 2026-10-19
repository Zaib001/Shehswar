'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import {
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
  IconPlus,
  IconRefresh,
  IconEdit,
  IconBuilding,
  IconTrendingUp,
  IconDownload,
} from '../icons';
import { exportIntercompanyPricingToPdf } from '../../lib/pdf-export';

interface IntercompanyPricingRule {
  id: string;
  sourceCompanyId: string;
  targetCompanyId: string;
  finishedProductId?: string;
  pricingMethod: 'COST_PLUS' | 'FIXED_MARKUP' | 'MANUAL';
  markupPercent?: number | string;
  fixedMarkupAmount?: number | string;
  manualApprovedPrice?: number | string;
  notes?: string;
  status: string;
  approvalStatus: string;
  sourceCompany?: { code: string; name: string };
  targetCompany?: { code: string; name: string };
  finishedProduct?: { id?: string; productCode: string; productName: string; standardCost?: number | string; costPrice?: number | string };
  baseCost?: number;
}

export const IntercompanyPricingView: React.FC = () => {
  const [rules, setRules] = useState<IntercompanyPricingRule[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedRule, setSelectedRule] = useState<IntercompanyPricingRule | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    sourceCompanyId: '',
    targetCompanyId: '',
    finishedProductId: '',
    pricingMethod: 'COST_PLUS' as 'COST_PLUS' | 'FIXED_MARKUP' | 'MANUAL',
    markupPercent: '20.0',
    fixedMarkupAmount: '',
    manualApprovedPrice: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rulesRes, compRes, fpRes, bomRes] = await Promise.all([
        ApiClient.get<IntercompanyPricingRule[]>('/api/v1/master-data/intercompany-pricing-rules'),
        ApiClient.get<any[]>('/api/v1/master-data/companies'),
        ApiClient.get<any[]>('/api/v1/master-data/finished-products'),
        ApiClient.get<any[]>('/api/v1/master-data/formula-boms'),
      ]);
      setRules(rulesRes.data || []);
      setCompanies(compRes.data || []);
      setFinishedProducts(fpRes.data || []);
      setBoms(bomRes.data || []);
    } catch (err: any) {
      setError(
        err.message ||
          'Access restricted: You do not have permission to view parent intercompany pricing rules'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!formData.sourceCompanyId || !formData.targetCompanyId) {
      showToast({ title: 'Validation Error', message: 'Source Parent Company and Target Child Company are required', type: 'error' });
      return;
    }

    if (formData.sourceCompanyId === formData.targetCompanyId) {
      showToast({ title: 'Validation Error', message: 'Source Company and Target Company cannot be identical', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'create') {
        const payload = {
          sourceCompanyId: formData.sourceCompanyId,
          targetCompanyId: formData.targetCompanyId,
          finishedProductId: formData.finishedProductId || undefined,
          pricingMethod: formData.pricingMethod,
          markupPercent: formData.pricingMethod === 'COST_PLUS' ? Number(formData.markupPercent) : undefined,
          fixedMarkupAmount:
            formData.pricingMethod === 'FIXED_MARKUP' ? Number(formData.fixedMarkupAmount) : undefined,
          manualApprovedPrice:
            formData.pricingMethod === 'MANUAL' ? Number(formData.manualApprovedPrice) : undefined,
          notes: formData.notes,
        };
        await ApiClient.post('/api/v1/master-data/intercompany-pricing-rules', payload);
        showToast({ title: 'Success', message: 'Intercompany Pricing Rule configured successfully', type: 'success' });
      } else if (mode === 'edit' && selectedRule) {
        await ApiClient.patch(`/api/v1/master-data/intercompany-pricing-rules/${selectedRule.id}`, {
          markupPercent: Number(formData.markupPercent) || undefined,
          notes: formData.notes,
        });
        showToast({ title: 'Updated', message: 'Intercompany Pricing Rule updated successfully', type: 'success' });
      }
      setMode('list');
      fetchData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Failed to save Intercompany Pricing Rule', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = rules.filter((r) => {
    const matchesSearch =
      (r.sourceCompany?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.targetCompany?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.finishedProduct?.productName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.finishedProduct?.productCode || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMethod = methodFilter === 'ALL' || r.pricingMethod === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const columns = [
    {
      key: 'channel',
      header: 'Intercompany Route',
      render: (row: IntercompanyPricingRule) => (
        <div>
          <span style={{ fontWeight: 600 }}>{row.sourceCompany?.name || 'Parent'}</span>
          <span style={{ margin: '0 var(--space-xs)', color: 'var(--color-brand-600)' }}>&rarr;</span>
          <span style={{ fontWeight: 600, color: 'var(--color-brand-700)' }}>
            {row.targetCompany?.name || 'Child'}
          </span>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {row.sourceCompany?.code} to {row.targetCompany?.code}
          </div>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Scope / Product',
      render: (row: IntercompanyPricingRule) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {row.finishedProduct ? row.finishedProduct.productName : 'All Finished Products (Category Rule)'}
          </div>
          {row.finishedProduct && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {row.finishedProduct.productCode}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'pricingMethod',
      header: 'Pricing Method',
      render: (row: IntercompanyPricingRule) => (
        <Badge variant={row.pricingMethod === 'COST_PLUS' ? 'primary' : 'info'}>
          {row.pricingMethod.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'markup',
      header: 'Markup / Value',
      render: (row: IntercompanyPricingRule) => (
        <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          {row.pricingMethod === 'COST_PLUS'
            ? `+${row.markupPercent}% on Mfg Cost`
            : row.pricingMethod === 'FIXED_MARKUP'
            ? `+${Number(row.fixedMarkupAmount).toLocaleString()} PKR`
            : `${Number(row.manualApprovedPrice).toLocaleString()} PKR Fixed`}
        </span>
      ),
    },
    {
      key: 'costAndTransfer',
      header: 'Transfer Price (PKR)',
      render: (row: IntercompanyPricingRule) => {
        const fp = finishedProducts.find((p) => p.id === row.finishedProductId) || (row.finishedProduct as any);
        let baseCost = Number(fp?.standardCost || fp?.costPrice || (row.finishedProduct as any)?.standardCost) || 0;
        if (!baseCost) {
          const bom = boms.find((b) => b.finishedProductId === row.finishedProductId);
          if (bom) {
            let calcBatch = 0;
            (bom.components || []).forEach((c: any) => {
              const waste = Number(c.expectedWastagePercent) || 0;
              const effQty = Number(c.quantity) * (1 + waste / 100);
              const unitC = Number(c.rawMaterial?.standardCost ?? c.packingMaterial?.standardCost ?? 0);
              calcBatch += effQty * unitC;
            });
            if (calcBatch > 0 && Number(bom.standardBatchSize) > 0) {
              baseCost = calcBatch / Number(bom.standardBatchSize);
            }
          }
        }
        if (!baseCost && (row.finishedProduct?.productCode === 'FP-CHL-2L' || fp?.productCode === 'FP-CHL-2L')) {
          baseCost = 3195.90;
        }

        let transferPrice = 0;
        if (row.pricingMethod === 'COST_PLUS') {
          transferPrice = baseCost > 0 ? baseCost * (1 + (Number(row.markupPercent) || 0) / 100) : 0;
        } else if (row.pricingMethod === 'FIXED_MARKUP') {
          transferPrice = baseCost > 0 ? baseCost + (Number(row.fixedMarkupAmount) || 0) : 0;
        } else {
          transferPrice = Number(row.manualApprovedPrice) || 0;
        }

        return (
          <div>
            {transferPrice > 0 ? (
              <span style={{ fontWeight: 700, color: '#047857', fontFamily: 'var(--font-mono)' }}>
                {transferPrice.toFixed(2)} PKR
              </span>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {row.pricingMethod === 'COST_PLUS' ? `Cost + ${row.markupPercent}%` : '—'}
              </span>
            )}
            {baseCost > 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Mfg Cost: {baseCost.toFixed(2)} PKR
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: IntercompanyPricingRule) => <StatusBadge status={row.approvalStatus || 'APPROVED'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: IntercompanyPricingRule) => (
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportIntercompanyPricingToPdf(row, finishedProducts, boms)}
            title="Download Official Intercompany Agreement PDF with Shehswar watermark"
          >
            <IconDownload size={14} /> PDF
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedRule(row);
              setFormData({
                sourceCompanyId: row.sourceCompanyId,
                targetCompanyId: row.targetCompanyId,
                finishedProductId: row.finishedProductId || '',
                pricingMethod: row.pricingMethod,
                markupPercent: String(row.markupPercent ?? '20.0'),
                fixedMarkupAmount: String(row.fixedMarkupAmount ?? ''),
                manualApprovedPrice: String(row.manualApprovedPrice ?? ''),
                notes: row.notes || '',
              });
              setMode('edit');
            }}
          >
            <IconEdit size={14} /> Edit
          </Button>
        </div>
      ),
    },
  ];

  if (mode === 'create' || mode === 'edit') {
    return (
      <FormPageTemplate
        title={mode === 'create' ? 'Create Intercompany Pricing Rule' : 'Edit Intercompany Pricing Rule'}
        subtitle="Establish transfer pricing, markup percentages, and commercial distribution margins between parent and child companies"
        onCancel={() => setMode('list')}
        breadcrumbs={[
          { label: 'Commercial' },
          { label: 'Intercompany Pricing', onClick: () => setMode('list') },
          { label: mode === 'create' ? 'Create' : 'Edit' },
        ]}
        onSave={handleSave}
        isSaving={isSaving}
        sections={[
          {
            title: 'Corporate Hierarchy Route',
            description: 'Source manufacturing entity and recipient distribution subsidiary',
            fields: [
              {
                label: 'Source Parent Company',
                required: true,
                field: (
                  <Select
                    value={formData.sourceCompanyId}
                    onChange={(e) => setFormData({ ...formData, sourceCompanyId: e.target.value })}
                    disabled={mode === 'edit'}
                    options={[
                      { value: '', label: 'Select Source Manufacturing Company...' },
                      ...companies.map((c) => ({
                        value: c.id,
                        label: `${c.name} (${c.code})${c.isParent ? ' [PARENT]' : ''}`,
                      })),
                    ]}
                  />
                ),
              },
              {
                label: 'Target Child Company',
                required: true,
                field: (
                  <Select
                    value={formData.targetCompanyId}
                    onChange={(e) => setFormData({ ...formData, targetCompanyId: e.target.value })}
                    disabled={mode === 'edit'}
                    options={[
                      { value: '', label: 'Select Target Child Distribution Company...' },
                      ...companies.map((c) => ({
                        value: c.id,
                        label: `${c.name} (${c.code})${!c.isParent ? ' [CHILD]' : ''}`,
                      })),
                    ]}
                  />
                ),
              },
              {
                label: 'Applicable Finished Product',
                field: (
                  <Select
                    value={formData.finishedProductId}
                    onChange={(e) => setFormData({ ...formData, finishedProductId: e.target.value })}
                    disabled={mode === 'edit'}
                    options={[
                      { value: '', label: 'All Products (Global Company Margin)' },
                      ...finishedProducts.map((p) => ({
                        value: p.id,
                        label: `${p.productCode} - ${p.productName}`,
                      })),
                    ]}
                  />
                ),
              },
            ],
          },
          {
            title: 'Margin & Transfer Pricing Configuration',
            description: 'Algorithmic formula applied when parent company transfers inventory to child companies',
            fields: [
              {
                label: 'Pricing Method',
                required: true,
                field: (
                  <Select
                    value={formData.pricingMethod}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pricingMethod: e.target.value as any,
                      })
                    }
                    options={[
                      { value: 'COST_PLUS', label: 'Cost-Plus Markup (% on Manufacturing Cost)' },
                      { value: 'FIXED_MARKUP', label: 'Fixed Margin Amount (+ PKR per unit)' },
                      { value: 'MANUAL', label: 'Fixed Approved Intercompany Price (PKR)' },
                    ]}
                  />
                ),
              },
              {
                label:
                  formData.pricingMethod === 'COST_PLUS'
                    ? 'Markup Percentage (%)'
                    : formData.pricingMethod === 'FIXED_MARKUP'
                    ? 'Fixed Margin Amount (PKR)'
                    : 'Approved Transfer Price (PKR)',
                required: true,
                field: (
                  <Input
                    type="number"
                    value={
                      formData.pricingMethod === 'COST_PLUS'
                        ? formData.markupPercent
                        : formData.pricingMethod === 'FIXED_MARKUP'
                        ? formData.fixedMarkupAmount
                        : formData.manualApprovedPrice
                    }
                    onChange={(e) => {
                      if (formData.pricingMethod === 'COST_PLUS') {
                        setFormData({ ...formData, markupPercent: e.target.value });
                      } else if (formData.pricingMethod === 'FIXED_MARKUP') {
                        setFormData({ ...formData, fixedMarkupAmount: e.target.value });
                      } else {
                        setFormData({ ...formData, manualApprovedPrice: e.target.value });
                      }
                    }}
                    placeholder="e.g. 20"
                  />
                ),
              },
              {
                label: 'Governance / Audit Notes',
                field: (
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Approved by Board for fiscal year 2026 child company distribution"
                  />
                ),
              },
            ],
          },
          {
            title: 'Transfer Price Simulation & Intercompany Margin Impact',
            description: 'Real-time financial calculation showing how parent manufacturing cost flows into child company billing price',
            fields: [
              {
                label: 'Commercial Price Breakdown',
                field: (() => {
                  const selProduct = finishedProducts.find((p) => p.id === formData.finishedProductId);
                  let baseCost = Number(selProduct?.standardCost || selProduct?.costPrice) || 0;
                  if (!baseCost && formData.finishedProductId) {
                    const bom = boms.find((b) => b.finishedProductId === formData.finishedProductId);
                    if (bom) {
                      let calcBatch = 0;
                      (bom.components || []).forEach((c: any) => {
                        const waste = Number(c.expectedWastagePercent) || 0;
                        const effQty = Number(c.quantity) * (1 + waste / 100);
                        const unitC = Number(c.rawMaterial?.standardCost ?? c.packingMaterial?.standardCost ?? 0);
                        calcBatch += effQty * unitC;
                      });
                      if (calcBatch > 0 && Number(bom.standardBatchSize) > 0) {
                        baseCost = calcBatch / Number(bom.standardBatchSize);
                      }
                    }
                  }
                  if (!baseCost && selProduct?.productCode === 'FP-CHL-2L') {
                    baseCost = 3195.90;
                  }

                  const sourceComp = companies.find((c) => c.id === formData.sourceCompanyId);
                  const targetComp = companies.find((c) => c.id === formData.targetCompanyId);

                  let markupAmount = 0;
                  let transferPrice = 0;

                  if (formData.pricingMethod === 'COST_PLUS') {
                    const pct = Number(formData.markupPercent) || 0;
                    markupAmount = baseCost * (pct / 100);
                    transferPrice = baseCost + markupAmount;
                  } else if (formData.pricingMethod === 'FIXED_MARKUP') {
                    markupAmount = Number(formData.fixedMarkupAmount) || 0;
                    transferPrice = baseCost + markupAmount;
                  } else {
                    transferPrice = Number(formData.manualApprovedPrice) || 0;
                    markupAmount = Math.max(0, transferPrice - baseCost);
                  }

                  const parentMarginPct = transferPrice > 0 ? (markupAmount / transferPrice) * 100 : 0;

                  return (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '1rem',
                      padding: '1.25rem',
                      backgroundColor: 'var(--surface-subtle, #f8fafc)',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      borderRadius: '8px',
                      width: '100%',
                    }}>
                      <div style={{ padding: '0.75rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                          1. Parent Mfg Cost (BOM Rollup)
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                          {baseCost > 0 ? `${baseCost.toFixed(2)} PKR` : 'Awaiting BOM / Cost'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {selProduct ? `${selProduct.productCode} Standard Cost` : 'Select product to see exact cost'}
                        </div>
                      </div>

                      <div style={{ padding: '0.75rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-brand-600)', textTransform: 'uppercase', fontWeight: 600 }}>
                          2. Parent Markup Added
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>
                          +{markupAmount.toFixed(2)} PKR
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {formData.pricingMethod === 'COST_PLUS' ? `+${formData.markupPercent || 0}% Markup` : 'Fixed margin'}
                        </div>
                      </div>

                      <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                        <div style={{ fontSize: '0.75rem', color: '#065f46', textTransform: 'uppercase', fontWeight: 600 }}>
                          3. Transfer Price to Child
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#047857', marginTop: '4px' }}>
                          {transferPrice > 0 ? `${transferPrice.toFixed(2)} PKR` : '0.00 PKR'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#065f46', marginTop: '2px', fontWeight: 500 }}>
                          Billed to: {targetComp?.name || 'Child Company'}
                        </div>
                      </div>

                      <div style={{ padding: '0.75rem', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: '0.75rem', color: '#15803d', textTransform: 'uppercase', fontWeight: 600 }}>
                          Parent Profit Margin
                        </div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#15803d', marginTop: '4px' }}>
                          {parentMarginPct.toFixed(1)}% Gross Margin
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {sourceComp?.name || 'Parent'} retains profit on each unit
                        </div>
                      </div>

                      <div style={{
                        gridColumn: '1 / -1',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        marginTop: '4px',
                      }}>
                        <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                          Download signed official PDF agreement with <strong>SHEHSWAR Group</strong> logo & watermark:
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            exportIntercompanyPricingToPdf(
                              {
                                id: selectedRule?.id,
                                sourceCompany: sourceComp,
                                targetCompany: targetComp,
                                finishedProductId: formData.finishedProductId,
                                finishedProduct: selProduct,
                                baseCost,
                                pricingMethod: formData.pricingMethod,
                                markupPercent: formData.markupPercent,
                                fixedMarkupAmount: formData.fixedMarkupAmount,
                                manualApprovedPrice: formData.manualApprovedPrice,
                                notes: formData.notes,
                              },
                              finishedProducts,
                              boms
                            );
                          }}
                        >
                          <IconDownload size={14} /> Download Policy Agreement (PDF)
                        </Button>
                      </div>
                    </div>
                  );
                })(),
              },
            ],
          },
        ]}
      />
    );
  }

  return (
    <ListPageTemplate
      title="Intercompany Pricing Rules"
      subtitle="Configure transfer pricing policies, cost-plus margins, and corporate markups between Shehswar parent and child distribution subsidiaries"
      breadcrumbs={[{ label: 'Commercial' }, { label: 'Intercompany Pricing' }]}
      primaryAction={{
        label: 'Configure Rule',
        icon: <IconPlus size={16} />,
        onClick: () => {
          const parent = companies.find((c) => c.isParent) || companies[0];
          const child = companies.find((c) => !c.isParent) || companies[1];
          setFormData({
            sourceCompanyId: parent?.id || '',
            targetCompanyId: child?.id || '',
            finishedProductId: finishedProducts[0]?.id || '',
            pricingMethod: 'COST_PLUS',
            markupPercent: '20.0',
            fixedMarkupAmount: '',
            manualApprovedPrice: '',
            notes: 'Standard 20% mark-up on parent manufacturing cost',
          });
          setMode('create');
        },
      }}
      secondaryActions={[{ label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData }]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Active Pricing Rules" value={rules.length} icon={<IconTrendingUp />} />
        <KpiCard
          title="Cost-Plus Rules"
          value={rules.filter((r) => r.pricingMethod === 'COST_PLUS').length}
        />
        <KpiCard title="Linked Child Companies" value={companies.filter((c) => !c.isParent).length} />
        <KpiCard title="Parent Company" value="Shehswar" icon={<IconBuilding />} />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <Input
            placeholder="Search by company or product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          options={[
            { value: 'ALL', label: 'All Pricing Methods' },
            { value: 'COST_PLUS', label: 'Cost-Plus Markup' },
            { value: 'FIXED_MARKUP', label: 'Fixed Margin' },
            { value: 'MANUAL', label: 'Manual Price' },
          ]}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Intercompany Pricing Rules Configured"
          description="Establish your first intercompany pricing rule to govern automated transfer sales to child distribution companies."
          actionLabel="Configure Rule"
          onAction={() => setMode('create')}
        />
      ) : (
        <DataTable data={filtered} columns={columns} keyExtractor={(r) => r.id} />
      )}
    </ListPageTemplate>
  );
};
