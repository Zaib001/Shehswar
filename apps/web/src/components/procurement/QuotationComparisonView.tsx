'use client';

/**
 * SHEHSWAR ONE360 - Quotation Comparison & Supplier Selection Matrix
 *
 * Implements:
 * - Enterprise side-by-side multi-vendor bidding matrix
 * - Real-time lowest price badge detection across materials
 * - Delivery lead-time comparison and payment terms evaluation
 * - Selection workflow with mandatory audit justification modal
 * - Seamless handoff to Purchase Order creation
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  QuotationStatus,
} from '@shehswar/types';
import {
  ProcurementQuotation,
  ProcurementRFQ,
} from './mock-data';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Select,
  StatusBadge,
  Badge,
  Modal,
  Textarea,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '../ui';
import {
  IconCheck,
  IconClock,
  IconArrowRight,
  IconFileText,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

interface QuotationComparisonViewProps {
  initialRfqId?: string;
  onNavigateToPoCreate?: (vendorId: string, quoteId: string) => void;
}

export const QuotationComparisonView: React.FC<QuotationComparisonViewProps> = ({
  initialRfqId = '',
  onNavigateToPoCreate,
}) => {
  const { showToast } = useToast();
  const [selectedRfqId, setSelectedRfqId] = useState(initialRfqId);
  const [availableRfqs, setAvailableRfqs] = useState<ProcurementRFQ[]>([]);
  const [quotations, setQuotations] = useState<ProcurementQuotation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selection Modal State
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<ProcurementQuotation | null>(null);
  const [justification, setJustification] = useState('');
  const [isGeneratingPo, setIsGeneratingPo] = useState(false);
  const [existingPo, setExistingPo] = useState<any>(null);

  const fetchComparisonData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rfqRes, quotesRes, poRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/procurement/rfqs'),
        ApiClient.get<any>('/api/v1/procurement/quotations'),
        ApiClient.get<any>('/api/v1/procurement/purchase-orders'),
      ]);

      const rawRfqs = rfqRes.data?.items || (Array.isArray(rfqRes.data) ? rfqRes.data : []);
      const mappedRfqs: ProcurementRFQ[] = rawRfqs.map((r: any) => ({
        id: r.id,
        organizationId: r.organizationId,
        companyId: r.companyId,
        rfqNumber: r.rfqNumber,
        title: r.title,
        deadline: r.deadline,
        status: r.status,
        invitedVendors: [],
      }));
      setAvailableRfqs(mappedRfqs);

      const firstRfq = mappedRfqs[0];
      const activeRfqId = selectedRfqId || (firstRfq ? firstRfq.id : '');
      if (!selectedRfqId && activeRfqId) {
        setSelectedRfqId(activeRfqId);
      }

      const rawPos = poRes.data?.items || (Array.isArray(poRes.data) ? poRes.data : []);
      const matchedPo = rawPos.find((p: any) => p.rfqId === activeRfqId);
      setExistingPo(matchedPo || null);

      const rawQuotes = quotesRes.data?.items || (Array.isArray(quotesRes.data) ? quotesRes.data : []);
      const mappedQuotes: ProcurementQuotation[] = rawQuotes.map((q: any) => ({
        id: q.id,
        organizationId: q.organizationId,
        companyId: q.companyId,
        rfqId: q.rfqId,
        rfqNumber: q.rfq?.rfqNumber || (q.rfqId ? 'RFQ-' + q.rfqId.slice(0, 8) : 'RFQ'),
        vendorId: q.vendorId,
        vendorCode: q.vendor?.code || 'VND',
        vendorName: q.vendor?.name || 'Vendor Name',
        quotationNumber: q.quotationNumber,
        currency: q.currency || 'PKR',
        subtotal: Number(q.subtotal) || 0,
        taxAmount: Number(q.taxAmount) || 0,
        discountAmount: Number(q.discountAmount) || 0,
        netAmount: Number(q.netAmount) || 0,
        deliveryLeadDays: Number(q.deliveryLeadDays) || 7,
        paymentTerms: q.paymentTerms || '30_DAYS_CREDIT',
        validityDate: q.validityDate ? new Date(q.validityDate).toISOString().split('T')[0] : '2026-11-15',
        warranty: q.warranty || '',
        status: q.status || QuotationStatus.RECEIVED,
        isSelected: q.isSelected || false,
        selectionJustification: q.selectionJustification || undefined,
        items: q.items?.map((it: any) => ({
          itemName: it.itemName,
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'KG',
          unitPrice: Number(it.unitPrice) || 0,
          taxRate: Number(it.taxRate) || 18,
          discountRate: Number(it.discountRate) || 0,
          lineTotal: Number(it.lineTotal) || 0,
        })) || [],
      }));
      setQuotations(mappedQuotes);
    } catch (err: any) {
      console.error('Failed to load comparison data:', err);
      setError(err.message || 'Failed to connect to backend API');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRfqId]);

  useEffect(() => {
    fetchComparisonData();
  }, [fetchComparisonData]);

  const handleGeneratePo = async (targetWinner: ProcurementQuotation) => {
    if (!targetWinner) return;
    setIsGeneratingPo(true);
    try {
      const res = await ApiClient.post<any>('/api/v1/procurement/quotation-comparisons/generate-po', {
        rfqId: selectedRfqId,
        quotationId: targetWinner.id,
      });
      const poData = res.data;
      setExistingPo(poData);
      showToast({
        title: 'Purchase Order Generated!',
        message: `PO #${poData?.poNumber || 'Created'} generated for ${targetWinner.vendorName}`,
        type: 'success',
      });
      if (onNavigateToPoCreate) {
        onNavigateToPoCreate(targetWinner.vendorId, targetWinner.id);
      }
    } catch (err: any) {
      showToast({
        title: 'PO Generation Failed',
        message: err.message || 'Could not generate Purchase Order',
        type: 'error',
      });
    } finally {
      setIsGeneratingPo(false);
    }
  };

  const currentRfq = availableRfqs.find((r) => r.id === selectedRfqId) || availableRfqs[0];
  const rfqQuotations = quotations.filter((q) => q.rfqId === selectedRfqId);

  // Determine lowest prices for each item
  const allItemNames = Array.from(
    new Set(rfqQuotations.flatMap((q) => q.items.map((i) => i.itemName))),
  );

  const lowestPrices: Record<string, number> = {};
  allItemNames.forEach((name) => {
    let min = Infinity;
    rfqQuotations.forEach((q) => {
      const match = q.items.find((i) => i.itemName === name);
      if (match && match.unitPrice < min) {
        min = match.unitPrice;
      }
    });
    lowestPrices[name] = min === Infinity ? 0 : min;
  });

  // Determine lowest net total and fastest delivery
  let lowestTotal = Infinity;
  let fastestLeadDays = Infinity;
  rfqQuotations.forEach((q) => {
    if (q.netAmount < lowestTotal) lowestTotal = q.netAmount;
    if (q.deliveryLeadDays < fastestLeadDays) fastestLeadDays = q.deliveryLeadDays;
  });

  const handleOpenSelectModal = (quote: ProcurementQuotation) => {
    setSelectedWinner(quote);
    setJustification(
      `Vendor ${quote.vendorName} offers the lowest overall price (PKR ${quote.netAmount.toLocaleString()}) with ${quote.deliveryLeadDays} days delivery and ${quote.paymentTerms.replace(/_/g, ' ')}.`,
    );
    setIsSelectionModalOpen(true);
  };

  const handleConfirmAward = async () => {
    if (!selectedWinner) return;
    if (!justification || justification.trim().length < 5) {
      showToast({
        title: 'Justification Required',
        description: 'A detailed commercial selection justification (minimum 5 chars) is mandatory.',
        type: 'error',
      });
      return;
    }

    try {
      await ApiClient.post('/api/v1/procurement/quotation-comparisons/select-winner', {
        rfqId: selectedRfqId,
        quotationId: selectedWinner.id,
        selectionJustification: justification,
      });

      setIsSelectionModalOpen(false);
      showToast({
        title: 'Supplier Awarded Successfully',
        description: `${selectedWinner.vendorName} recorded as winning bidder in PostgreSQL database.`,
        type: 'success',
      });
      await fetchComparisonData();
    } catch (err: any) {
      showToast({
        title: 'Award Failed',
        description: err.message || 'Could not select winner',
        type: 'error',
      });
    }
  };

  const activeWinner = rfqQuotations.find((q) => q.isSelected);

  if (isLoading) {
    return (
      <div style={{ padding: '24px' }}>
        <TableSkeleton rows={5} columns={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <ErrorState title="Failed to Load Quotation Matrix" message={error} onRetry={fetchComparisonData} />
      </div>
    );
  }

  if (availableRfqs.length === 0) {
    return (
      <div style={{ padding: '24px' }}>
        <EmptyState title="No Active RFQs Found" description="Create an RFQ and invite suppliers to generate quotation matrices." />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '4px' }}>
      {/* Header & RFQ Switcher */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Procurement /</span>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Bidding Matrix /</span>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>{currentRfq?.rfqNumber}</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0 0', color: 'var(--color-text-primary)' }}>
            Quotation Comparison Matrix
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Side-by-side commercial evaluation of multi-vendor bids for {currentRfq?.title}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Select Active RFQ
            </label>
            <Select
              value={selectedRfqId}
              onChange={(e) => setSelectedRfqId(e.target.value)}
              options={availableRfqs.map((r) => ({
                value: r.id,
                label: `${r.rfqNumber} (${r.title})`,
              }))}
            />
          </div>

          {activeWinner && (
            <div style={{ alignSelf: 'flex-end', display: 'flex', gap: '8px', alignItems: 'center' }}>
              {existingPo ? (
                <>
                  <Badge variant="success" size="lg">
                    PO Issued: {existingPo.poNumber} ({existingPo.status})
                  </Badge>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (onNavigateToPoCreate) {
                        onNavigateToPoCreate(activeWinner.vendorId, activeWinner.id);
                      }
                    }}
                  >
                    <IconFileText size={16} /> View Purchase Order &rarr;
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  isLoading={isGeneratingPo}
                  onClick={() => handleGeneratePo(activeWinner)}
                >
                  <IconFileText size={16} /> Generate PO for Winner
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Award Banner if winner selected */}
      {activeWinner && (
        <Card style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b981' }}>
          <CardContent style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconCheck size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#065f46' }}>
                    Awarded Supplier: {activeWinner.vendorName} ({activeWinner.vendorCode})
                  </div>
                  <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                    {activeWinner.selectionJustification || 'Selected via competitive bidding comparison.'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {existingPo ? (
                  <Badge variant="success" size="lg">
                    PO Generated: {existingPo.poNumber}
                  </Badge>
                ) : (
                  <>
                    <Badge variant="warning" size="lg">
                      Ready for PO Issuance
                    </Badge>
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={isGeneratingPo}
                      onClick={() => handleGeneratePo(activeWinner)}
                    >
                      <IconFileText size={14} /> Generate PO Now
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Side-by-Side Comparison Matrix Table */}
      <Card>
        <CardHeader>
          <CardTitle>Commercial & Technical Comparison Sheet</CardTitle>
        </CardHeader>
        <CardContent style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-hover)', borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', minWidth: '220px' }}>
                  Evaluation Parameters
                </th>
                {rfqQuotations.map((q) => (
                  <th
                    key={q.id}
                    style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      minWidth: '260px',
                      borderLeft: '1px solid var(--color-border)',
                      backgroundColor: q.isSelected ? 'rgba(16, 185, 129, 0.04)' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{q.vendorName}</span>
                      <StatusBadge status={q.status.toLowerCase()} variant={q.isSelected ? 'success' : q.status === 'REJECTED' ? 'danger' : 'default'} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Quote: {q.quotationNumber} • {q.vendorCode}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* SECTION 1: LINE ITEM PRICING */}
              <tr style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                <td colSpan={rfqQuotations.length + 1} style={{ padding: '10px 16px', fontWeight: 700, fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  1. Line Item Unit Rates (PKR)
                </td>
              </tr>

              {allItemNames.map((itemName) => (
                <tr key={itemName} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{itemName}</td>
                  {rfqQuotations.map((q) => {
                    const item = q.items.find((i) => i.itemName === itemName);
                    const isLowest = item && item.unitPrice === lowestPrices[itemName];

                    return (
                      <td
                        key={q.id}
                        style={{
                          padding: '12px 16px',
                          borderLeft: '1px solid var(--color-border)',
                          backgroundColor: q.isSelected ? 'rgba(16, 185, 129, 0.04)' : undefined,
                        }}
                      >
                        {item ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                PKR {item.unitPrice.toLocaleString()} / {item.unit}
                              </span>
                              {isLowest && (
                                <Badge variant="success" size="sm">
                                  ★ Best Price
                                </Badge>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              Line Total: PKR {item.lineTotal.toLocaleString()} ({item.taxRate}% tax)
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>Not Quoted</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* SECTION 2: COMMERCIAL TOTALS */}
              <tr style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                <td colSpan={rfqQuotations.length + 1} style={{ padding: '10px 16px', fontWeight: 700, fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  2. Commercial Summary & Net Valuation
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>Subtotal (Excl. Tax)</td>
                {rfqQuotations.map((q) => (
                  <td key={q.id} style={{ padding: '12px 16px', borderLeft: '1px solid var(--color-border)', fontFamily: 'monospace' }}>
                    PKR {q.subtotal.toLocaleString()}
                  </td>
                ))}
              </tr>

              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>Sales Tax / VAT</td>
                {rfqQuotations.map((q) => (
                  <td key={q.id} style={{ padding: '12px 16px', borderLeft: '1px solid var(--color-border)', fontFamily: 'monospace' }}>
                    PKR {q.taxAmount.toLocaleString()}
                  </td>
                ))}
              </tr>

              <tr style={{ borderBottom: '2px solid var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
                <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '14px' }}>
                  Net Total Amount
                </td>
                {rfqQuotations.map((q) => {
                  const isLowestTotal = q.netAmount === lowestTotal;
                  return (
                    <td
                      key={q.id}
                      style={{
                        padding: '14px 16px',
                        borderLeft: '1px solid var(--color-border)',
                        fontWeight: 700,
                        fontSize: '14px',
                        color: isLowestTotal ? '#047857' : 'var(--color-text-primary)',
                        backgroundColor: q.isSelected ? 'rgba(16, 185, 129, 0.08)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'monospace' }}>PKR {q.netAmount.toLocaleString()}</span>
                        {isLowestTotal && <Badge variant="success" size="sm">Lowest Net</Badge>}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* SECTION 3: DELIVERY & PAYMENT TERMS */}
              <tr style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                <td colSpan={rfqQuotations.length + 1} style={{ padding: '10px 16px', fontWeight: 700, fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  3. Delivery & Commercial Terms
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>Delivery Lead Days</td>
                {rfqQuotations.map((q) => {
                  const isFastest = q.deliveryLeadDays === fastestLeadDays;
                  return (
                    <td key={q.id} style={{ padding: '12px 16px', borderLeft: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600 }}>{q.deliveryLeadDays} Calendar Days</span>
                        {isFastest && <Badge variant="info" size="sm">Fastest</Badge>}
                      </div>
                    </td>
                  );
                })}
              </tr>

              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>Payment Terms</td>
                {rfqQuotations.map((q) => (
                  <td key={q.id} style={{ padding: '12px 16px', borderLeft: '1px solid var(--color-border)', fontWeight: 600 }}>
                    {q.paymentTerms.replace(/_/g, ' ')}
                  </td>
                ))}
              </tr>

              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>Quote Validity</td>
                {rfqQuotations.map((q) => (
                  <td key={q.id} style={{ padding: '12px 16px', borderLeft: '1px solid var(--color-border)', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <IconClock size={12} color="var(--color-text-muted)" />
                      <span>{q.validityDate}</span>
                    </div>
                  </td>
                ))}
              </tr>

              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>Quality Warranty / Specs</td>
                {rfqQuotations.map((q) => (
                  <td key={q.id} style={{ padding: '12px 16px', borderLeft: '1px solid var(--color-border)', fontSize: '12px' }}>
                    {q.warranty || 'Standard commercial'}
                  </td>
                ))}
              </tr>

              {/* SECTION 4: SELECTION ACTION */}
              <tr style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                <td style={{ padding: '16px', fontWeight: 700 }}>
                  Supplier Award Selection
                </td>
                {rfqQuotations.map((q) => (
                  <td key={q.id} style={{ padding: '16px', borderLeft: '1px solid var(--color-border)' }}>
                    {q.isSelected ? (
                      <Badge variant="success" size="lg">
                        <IconCheck size={14} /> Selected Supplier
                      </Badge>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenSelectModal(q)}
                      >
                        Select Supplier <IconArrowRight size={14} />
                      </Button>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Award Justification Modal */}
      <Modal
        isOpen={isSelectionModalOpen}
        onClose={() => setIsSelectionModalOpen(false)}
        title="Confirm Supplier Selection & Award"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setIsSelectionModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmAward}>
              Confirm Supplier Award
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Awarding <strong>{selectedWinner?.vendorName}</strong> for{' '}
            <strong>{currentRfq?.rfqNumber}</strong> with a total value of{' '}
            <strong>PKR {selectedWinner?.netAmount.toLocaleString()}</strong>.
          </p>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Commercial Selection Justification (Mandatory for Audit Compliance) *
            </label>
            <Textarea
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Detail reasons: lowest price, delivery timeline advantage, payment terms, quality track record..."
              required
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
