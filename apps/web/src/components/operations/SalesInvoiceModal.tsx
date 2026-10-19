'use client';

/**
 * SHEHSWAR ONE360 - Clean, Simple & Professional Sales Invoice Modal
 *
 * Implements the 3 Document Presentation Formats:
 * 1. Option 1: Basic Delivery Format (Delivery Challan / Gate Pass - Zero Financials)
 * 2. Option 2: Standard Sales Format (Product, Qty, Rate, Net Total)
 * 3. Option 3: Full Commercial Invoice (Schemes, Cash Discount %, Sales Tax STRN, Net Amount, Words)
 */
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { IconFileText } from '../icons';
import { SHEHSWAR_LOGO_BASE64 } from '../../lib/shehswar-logo-base64';
import { exportSalesInvoiceToPdf, SalesInvoiceExportData, convertNumberToWordsPKR } from '../../lib/pdf-export';

interface SalesInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: SalesInvoiceExportData | null;
}

export const SalesInvoiceModal: React.FC<SalesInvoiceModalProps> = ({
  isOpen,
  onClose,
  invoice,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'BASIC_DELIVERY' | 'STANDARD_SALES' | 'COMMERCIAL_FULL'>('COMMERCIAL_FULL');

  useEffect(() => {
    if (invoice) {
      const initial = (invoice.documentFormat as any) || (invoice.isDeliveryChallan ? 'BASIC_DELIVERY' : 'COMMERCIAL_FULL');
      setSelectedFormat(initial);
    }
  }, [invoice]);

  if (!invoice) return null;

  const isBasicDelivery = selectedFormat === 'BASIC_DELIVERY';
  const isStandardSales = selectedFormat === 'STANDARD_SALES';
  const isCommercialFull = selectedFormat === 'COMMERCIAL_FULL';

  const gross = Number(invoice.grossAmount || invoice.netAmount || 0);
  const discount = Number(invoice.discountAmount || 0);
  const tax = Number(invoice.taxAmount || 0);
  const net = Number(invoice.netAmount || (gross - discount + tax));
  const amountInWords = convertNumberToWordsPKR(net);
  const totalUnits = invoice.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const formattedDate = new Date(invoice.invoiceDate || new Date()).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const orderRef = invoice.salesOrder?.orderNumber || 'DIRECT-SALE';
  const salesOfficerName = invoice.salesOrder?.salesOfficer
    ? `${invoice.salesOrder.salesOfficer.firstName || ''} ${invoice.salesOrder.salesOfficer.lastName || ''}`.trim()
    : 'Direct Commercial Booking';

  const titleBadge = isBasicDelivery
    ? 'DELIVERY CHALLAN & GATE PASS'
    : isStandardSales
    ? 'SALES RECEIPT / SLIP'
    : 'SALES TAX COMMERCIAL INVOICE';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${titleBadge} — ${invoice.invoiceNumber}`}
      size="xl"
    >
      {/* Top Toolbar: 3 Document Formats Segmented Switcher & Print Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        {/* Document Format Switcher */}
        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => setSelectedFormat('BASIC_DELIVERY')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: selectedFormat === 'BASIC_DELIVERY' ? 700 : 500,
              background: selectedFormat === 'BASIC_DELIVERY' ? '#0f172a' : 'transparent',
              color: selectedFormat === 'BASIC_DELIVERY' ? '#ffffff' : '#475569',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Option 1: Delivery Challan
          </button>
          <button
            type="button"
            onClick={() => setSelectedFormat('STANDARD_SALES')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: selectedFormat === 'STANDARD_SALES' ? 700 : 500,
              background: selectedFormat === 'STANDARD_SALES' ? '#0f172a' : 'transparent',
              color: selectedFormat === 'STANDARD_SALES' ? '#ffffff' : '#475569',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Option 2: Standard Sales Format
          </button>
          <button
            type="button"
            onClick={() => setSelectedFormat('COMMERCIAL_FULL')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: selectedFormat === 'COMMERCIAL_FULL' ? 700 : 500,
              background: selectedFormat === 'COMMERCIAL_FULL' ? '#0f172a' : 'transparent',
              color: selectedFormat === 'COMMERCIAL_FULL' ? '#ffffff' : '#475569',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Option 3: Full Commercial Invoice
          </button>
        </div>

        {/* Print / Close Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="primary"
            onClick={() => exportSalesInvoiceToPdf(invoice, selectedFormat)}
            style={{
              background: '#0f172a',
              borderColor: '#334155',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <IconFileText size={15} /> Print / Download PDF
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Invoice Sheet Container with Watermark */}
      <div
        style={{
          position: 'relative',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          padding: '24px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          color: '#0f172a',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Watermark of SHEHSWAR Logo in Background */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-10deg)',
            opacity: 0.035,
            zIndex: 0,
            pointerEvents: 'none',
            width: '420px',
            textAlign: 'center',
          }}
        >
          <img
            src={SHEHSWAR_LOGO_BASE64}
            alt="SHEHSWAR WATERMARK"
            style={{ width: '100%', height: 'auto', filter: 'grayscale(100%)' }}
          />
        </div>

        {/* Content with Z-Index over Watermark */}
        <div style={{ position: 'relative', zIndex: 1 }}>

          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #0f172a',
              paddingBottom: '14px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img
                src={SHEHSWAR_LOGO_BASE64}
                alt="Shehswar Logo"
                style={{ height: '52px', width: 'auto', objectFit: 'contain' }}
              />
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '17px',
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  SHEHSWAR CHEMICALS & AGRO-FERTILIZERS (PVT) LTD
                </h2>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px', lineHeight: 1.35 }}>
                  Manufacturing & Pesticide Formulations • Commercial Distribution Division<br />
                  Head Office & Plant: Multan Road / Faisalabad • NTN: 4128934-7 • STRN: 3277876123456
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 12px',
                  background: isBasicDelivery ? '#1e293b' : '#0f172a',
                  color: '#ffffff',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {titleBadge}
              </span>
              <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 800, marginTop: '4px', fontFamily: 'monospace' }}>
                {isBasicDelivery ? 'CHALLAN' : 'INV'}: {invoice.invoiceNumber}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Date: {formattedDate} • Status: <strong style={{ color: '#0f172a' }}>{invoice.postingStatus}</strong>
              </div>
            </div>
          </div>

          {/* 2-Column Meta Section */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px',
              marginBottom: '16px',
            }}
          >
            {/* Dealer Card */}
            <div
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                padding: '10px 14px',
                background: '#ffffff',
                fontSize: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                  paddingBottom: '4px',
                  borderBottom: '1px solid #f1f5f9',
                  letterSpacing: '0.05em',
                }}
              >
                {isBasicDelivery ? 'CONSIGNEE / DISPATCHED TO' : 'CUSTOMER / BILLED TO'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: '#64748b' }}>Dealer Name:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{invoice.dealer?.name || 'Authorized Dealer'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: '#64748b' }}>Account Code:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{invoice.dealer?.code || 'DLR-GEN'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: '#64748b' }}>Phone:</span>
                <span>{invoice.dealer?.phone || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>City / Destination:</span>
                <span>{invoice.dealer?.city || invoice.dealer?.address || 'Pakistan'}</span>
              </div>
            </div>

            {/* Dispatch / Order Details Card */}
            <div
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                padding: '10px 14px',
                background: '#ffffff',
                fontSize: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                  paddingBottom: '4px',
                  borderBottom: '1px solid #f1f5f9',
                  letterSpacing: '0.05em',
                }}
              >
                DISPATCH & ORDER DETAILS
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: '#64748b' }}>Sales Order Ref:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{orderRef}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: '#64748b' }}>Booked By:</span>
                <span style={{ fontWeight: 600 }}>{salesOfficerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: '#64748b' }}>Warehouse:</span>
                <span>{invoice.warehouse?.name || 'Main Factory Warehouse'}</span>
              </div>
              {!isBasicDelivery ? (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Commercial Condition:</span>
                  <span style={{ fontWeight: 600, color: '#166534' }}>
                    {invoice.commercialCondition || invoice.pricingPhase || 'Standard Cash'}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Gate Pass Mode:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>Outward Delivery Note</span>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '16px',
              fontSize: '12.5px',
              border: '1px solid #cbd5e1',
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  textAlign: 'left',
                }}
              >
                <th style={{ padding: '8px 10px', width: '4%', textAlign: 'center' }}>#</th>
                <th style={{ padding: '8px 10px', width: isBasicDelivery ? '44%' : isCommercialFull ? '36%' : '44%' }}>
                  Product Description
                </th>
                {isBasicDelivery && (
                  <th style={{ padding: '8px 10px', width: '20%', textAlign: 'center' }}>Batch / Lot #</th>
                )}
                {isCommercialFull && (
                  <th style={{ padding: '8px 10px', width: '15%', textAlign: 'center' }}>Scheme / Condition</th>
                )}
                <th style={{ padding: '8px 10px', width: '14%', textAlign: 'center' }}>Packaging</th>
                <th style={{ padding: '8px 10px', width: '10%', textAlign: 'right' }}>Qty</th>
                {!isBasicDelivery && (
                  <th style={{ padding: '8px 10px', width: '14%', textAlign: 'right' }}>Unit Rate (PKR)</th>
                )}
                {!isBasicDelivery && (
                  <th style={{ padding: '8px 10px', width: '14%', textAlign: 'right' }}>Net Total (PKR)</th>
                )}
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid #e2e8f0',
                    background: idx % 2 === 1 ? '#f8fafc' : '#ffffff',
                  }}
                >
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>{item.productName}</td>
                  {isBasicDelivery && (
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: '#475569', fontFamily: 'monospace' }}>
                      {item.batchNumber || invoice.batchNumber || 'BT-2026-X'}
                    </td>
                  )}
                  {isCommercialFull && (
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: '#166534', fontWeight: 600 }}>
                      {item.scheme || invoice.schemeDescription || 'Standard'}
                    </td>
                  )}
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: '#475569' }}>
                    {item.packing || 'Standard Pack'}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                    {Number(item.quantity).toLocaleString()}
                  </td>
                  {!isBasicDelivery && (
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                      PKR {Number(item.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  )}
                  {!isBasicDelivery && (
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                      PKR {Number(item.netAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Delivery Challan Non-Financial Summary vs Financial Summary */}
          {isBasicDelivery ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '12px 14px',
                  fontSize: '12px',
                  background: '#ffffff',
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  DISPATCH & RECEIPT VERIFICATION:
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '12px', lineHeight: 1.4 }}>
                  All goods described above are dispatched in good condition with factory seals intact. Dispatched without commercial valuation or price consideration on this delivery slip.
                </div>
                {invoice.notes && (
                  <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1', color: '#475569', fontSize: '11px' }}>
                    <strong>Notes:</strong> {invoice.notes}
                  </div>
                )}
              </div>

              <div
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  fontSize: '12px',
                  background: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b' }}>Total Distinct Line Items:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{invoice.items.length} Products</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: 800,
                  }}
                >
                  <span>TOTAL DISPATCHED UNITS:</span>
                  <span style={{ fontFamily: 'monospace' }}>{totalUnits.toLocaleString()} Units</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '12px 14px',
                  fontSize: '12px',
                  background: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                    AMOUNT IN WORDS:
                  </div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px', lineHeight: 1.4 }}>
                    {amountInWords}
                  </div>
                </div>
                {invoice.notes && (
                  <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1', color: '#475569', fontSize: '11px' }}>
                    <strong>Notes:</strong> {invoice.notes}
                  </div>
                )}
              </div>

              <div
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  fontSize: '12px',
                  background: '#ffffff',
                }}
              >
                {isCommercialFull && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>Gross Subtotal:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        PKR {gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>Discount / Rebate:</span>
                      <span style={{ fontFamily: 'monospace', color: '#dc2626' }}>
                        - PKR {discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>Sales Tax:</span>
                      <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>
                        + PKR {tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: 800,
                  }}
                >
                  <span>NET AMOUNT PAYABLE:</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    PKR {net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Governance Notes */}
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '11px',
              color: '#475569',
              lineHeight: 1.4,
              marginBottom: '16px',
              background: '#f8fafc',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', color: '#0f172a', marginBottom: '3px' }}>
              Document Governance & Legal Terms:
            </div>
            {isBasicDelivery ? (
              <div>
                1. <strong>Stock Transfer Receipt:</strong> This delivery challan serves solely as a movement record from plant storage to destination. Physical counts must be tallied at vehicle un-boarding.<br />
                2. <strong>Shortages / Leakage:</strong> Any transit breakage or seal tampering must be recorded on the driver gate pass slip before signing receipt.
              </div>
            ) : (
              <div>
                1. <strong>Payment Terms:</strong> Remittance strictly via Crossed Cheque or Direct Bank Transfer in favor of <strong>SHEHSWAR CHEMICALS & AGRO-FERTILIZERS (PVT) LTD</strong>. Cash payment to field reps without official computerized receipt is strictly unacknowledged.<br />
                2. <strong>Warranty:</strong> Agrochemical formulations strictly conform to registered chemical assay standards. Claims for transit breakage or leakage must be notified within 48 hours of dispatch.
              </div>
            )}
          </div>

          {/* Signatures */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '14px',
              paddingTop: '12px',
              borderTop: '1.5px solid #cbd5e1',
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ height: '24px', borderBottom: '1px dashed #94a3b8', marginBottom: '4px' }} />
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>{isBasicDelivery ? 'STORE INCHARGE' : 'PREPARED BY'}</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>{isBasicDelivery ? 'Warehouse Dispatch' : 'Commercial Billing'}</div>
            </div>
            <div>
              <div style={{ height: '24px', borderBottom: '1px dashed #94a3b8', marginBottom: '4px' }} />
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>{isBasicDelivery ? 'GATE SECURITY' : 'DISPATCH OFFICER'}</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>{isBasicDelivery ? 'Gate Pass Inspection' : 'Warehouse & Logistics'}</div>
            </div>
            <div>
              <div style={{ height: '24px', borderBottom: '1px dashed #94a3b8', marginBottom: '4px' }} />
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>{isBasicDelivery ? 'CARRIER / DRIVER' : 'SALES MANAGER'}</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>{isBasicDelivery ? 'Vehicle / Transport' : 'Territory Head'}</div>
            </div>
            <div>
              <div style={{ height: '24px', borderBottom: '1px dashed #94a3b8', marginBottom: '4px' }} />
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>{isBasicDelivery ? 'RECEIVER ACKNOWLEDGMENT' : 'CUSTOMER ACKNOWLEDGMENT'}</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>Dealer Stamp & Sign</div>
            </div>
          </div>

        </div>
      </div>
    </Modal>
  );
};
