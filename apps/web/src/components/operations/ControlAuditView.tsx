'use client';

/**
 * SHEHSWAR ONE360 - Enterprise Control & Audit View
 *
 * Dedicated Control & Audit Section (Requirements 11, 12, 13, 14, 40, 62):
 * - Order Control Dashboard (Total, Pending, Approved, Credit Hold, Converted)
 * - Sales Audit Trail (Order → Approval → Dispatch → Invoice → Stock → Ledger → Journal)
 * - Purchase Audit Trail (Procurement → PO → GRN → Invoice → Liability → Payment)
 * - Payment / Collection Audit
 * - "View Accounting Impact" Auditor Inspector Modal
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useAuth } from '../../context/auth-context';
import { useToast } from '../../context/toast-context';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  TableSkeleton,
  EmptyState,
  Modal,
} from '../ui';
import {
  IconRefresh,
  IconDownload,
  IconFileText,
} from '../icons';
import {
  exportOrderControlAuditReportPdf,
  exportOrderControlAuditReportCsv,
  exportSalesAuditReportPdf,
  exportSalesAuditReportCsv,
  exportPurchaseAuditReportPdf,
  exportPurchaseAuditReportCsv,
  exportPaymentAuditReportPdf,
  exportPaymentAuditReportCsv,
} from '../../lib/executive-reports-export';

export const ControlAuditView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'order-control' | 'sales-audit' | 'purchase-audit' | 'payment-audit'>('order-control');
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');
  const [companies, setCompanies] = useState<any[]>([]);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Data States
  const [orderControlData, setOrderControlData] = useState<any>(null);
  const [salesAuditData, setSalesAuditData] = useState<any[]>([]);
  const [purchaseAuditData, setPurchaseAuditData] = useState<any[]>([]);
  const [paymentAuditData, setPaymentAuditData] = useState<any[]>([]);

  // "View Accounting Impact" Modal State
  const [selectedImpact, setSelectedImpact] = useState<any>(null);
  const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);

  // Load Companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await ApiClient.get<any>('/api/v1/master-data/companies?all=true');
        const list = Array.isArray(res) ? res : (res as any)?.data || [];
        setCompanies(list);
        if (list.length > 0 && !companyId) {
          const userCompany = list.find((c: any) => c.id === user?.companyId);
          setCompanyId(userCompany ? userCompany.id : list[0].id);
        }
      } catch {
        if (user?.companyId) setCompanyId(user.companyId);
      }
    };
    fetchCompanies();
  }, [user]);

  // Fetch Tab Data
  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      if (activeTab === 'order-control') {
        let q = `/api/v1/audit-control/orders?companyId=${companyId}`;
        if (statusFilter) q += `&status=${statusFilter}`;
        const res: any = await ApiClient.get<any>(q);
        const payload = res?.data || res;
        setOrderControlData(payload);
      } else if (activeTab === 'sales-audit') {
        const res: any = await ApiClient.get<any>(`/api/v1/audit-control/sales?companyId=${companyId}`);
        const payload = res?.data?.invoices || res?.data?.data || res?.invoices || res?.data || res;
        setSalesAuditData(Array.isArray(payload) ? payload : []);
      } else if (activeTab === 'purchase-audit') {
        const res: any = await ApiClient.get<any>(`/api/v1/audit-control/purchases?companyId=${companyId}`);
        const payload = res?.data?.purchases || res?.data?.data || res?.purchases || res?.data || res;
        setPurchaseAuditData(Array.isArray(payload) ? payload : []);
      } else if (activeTab === 'payment-audit') {
        const res: any = await ApiClient.get<any>(`/api/v1/audit-control/payments?companyId=${companyId}`);
        const payload = res?.data?.payments || res?.data?.data || res?.payments || res?.data || res;
        setPaymentAuditData(Array.isArray(payload) ? payload : []);
      }
    } catch (err: any) {
      showToast({ type: 'error', title: err.message || 'Failed to load audit records' });
    } finally {
      setLoading(false);
    }
  }, [companyId, activeTab, statusFilter, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // View Accounting Impact Inspector (Requirement 62)
  const openAccountingImpact = async (sourceType: string, sourceId: string) => {
    setImpactLoading(true);
    setIsImpactModalOpen(true);
    try {
      const res = await ApiClient.get<any>(`/api/v1/audit-control/impact/${sourceType}/${sourceId}`);
      setSelectedImpact((res as any)?.data || res);
    } catch (err: any) {
      showToast({ type: 'error', title: err.message || 'Failed to inspect transaction impact' });
      setIsImpactModalOpen(false);
    } finally {
      setImpactLoading(false);
    }
  };

  const formatPKR = (val: number | string | undefined | null) => {
    const num = Number(val || 0);
    return `PKR ${num.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const handleDownloadPdf = () => {
    const compName = companies.find((c) => c.id === companyId)?.name || 'Shehswar Group';
    if (activeTab === 'order-control') {
      const orders = orderControlData?.orders || orderControlData?.data || [];
      exportOrderControlAuditReportPdf({
        companyName: compName,
        orders,
        summary: orderControlData?.kpis || {},
      });
    } else if (activeTab === 'sales-audit') {
      exportSalesAuditReportPdf({
        companyName: compName,
        invoices: salesAuditData,
      });
    } else if (activeTab === 'purchase-audit') {
      exportPurchaseAuditReportPdf({
        companyName: compName,
        purchases: purchaseAuditData,
      });
    } else if (activeTab === 'payment-audit') {
      exportPaymentAuditReportPdf({
        companyName: compName,
        payments: paymentAuditData,
      });
    }
  };

  const handleDownloadCsv = () => {
    if (activeTab === 'order-control') {
      const orders = orderControlData?.orders || orderControlData?.data || [];
      exportOrderControlAuditReportCsv(orders, 'Shehswar_Order_Control_and_Traceability_Report');
    } else if (activeTab === 'sales-audit') {
      exportSalesAuditReportCsv(salesAuditData, 'Shehswar_Sales_Audit_Trace_Report');
    } else if (activeTab === 'purchase-audit') {
      exportPurchaseAuditReportCsv(purchaseAuditData, 'Shehswar_Purchase_Procurement_Audit_Report');
    } else if (activeTab === 'payment-audit') {
      exportPaymentAuditReportCsv(paymentAuditData, 'Shehswar_Payment_Collection_Audit_Report');
    }
  };

  const kpis = orderControlData?.kpis || {};
  const totalOrdersCount = kpis.totalOrders ?? kpis.total ?? 0;
  const pendingOrdersCount = kpis.pendingOrders ?? kpis.pending ?? 0;
  const creditHoldOrdersCount = kpis.creditHoldOrders ?? kpis.creditHold ?? 0;
  const approvedOrdersCount = kpis.approvedOrders ?? kpis.approved ?? 0;
  const convertedOrdersCount = kpis.convertedOrders ?? kpis.converted ?? 0;
  const ordersList = orderControlData?.orders || orderControlData?.data || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Enterprise Control & Audit Center
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Complete transaction traceability, approval audits, and real-time accounting impact inspector
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {companies.length > 0 && (
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 'var(--font-size-xs)',
              }}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          )}

          <Button variant="secondary" size="sm" onClick={fetchData} disabled={loading}>
            <IconRefresh size={14} /> Refresh
          </Button>

          <Button variant="secondary" size="sm" onClick={handleDownloadPdf}>
            <IconDownload size={14} /> Download PDF
          </Button>

          <Button variant="secondary" size="sm" onClick={handleDownloadCsv}>
            <IconFileText size={14} /> Export CSV
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-default)', paddingBottom: '8px', overflowX: 'auto' }}>
        {[
          { id: 'order-control', label: 'Order Control' },
          { id: 'sales-audit', label: 'Sales Audit' },
          { id: 'purchase-audit', label: 'Purchase Audit' },
          { id: 'payment-audit', label: 'Payment / Collection Audit' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: activeTab === tab.id ? 'var(--color-primary)' : 'transparent',
              color: activeTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. ORDER CONTROL TAB */}
      {activeTab === 'order-control' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* KPI Count Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-md)' }}>
            <Card onClick={() => setStatusFilter('')} style={{ cursor: 'pointer' }}>
              <CardContent style={{ padding: '14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>TOTAL ORDERS</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, marginTop: '4px' }}>
                  {totalOrdersCount}
                </div>
              </CardContent>
            </Card>

            <Card onClick={() => setStatusFilter('PENDING')} style={{ cursor: 'pointer' }}>
              <CardContent style={{ padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#D97706', fontWeight: 700 }}>PENDING</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>
                  {pendingOrdersCount}
                </div>
              </CardContent>
            </Card>

            <Card onClick={() => setStatusFilter('CREDIT_HOLD')} style={{ cursor: 'pointer' }}>
              <CardContent style={{ padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#DC2626', fontWeight: 700 }}>CREDIT HOLD</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
                  {creditHoldOrdersCount}
                </div>
              </CardContent>
            </Card>

            <Card onClick={() => setStatusFilter('APPROVED')} style={{ cursor: 'pointer' }}>
              <CardContent style={{ padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#2563EB', fontWeight: 700 }}>APPROVED</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>
                  {approvedOrdersCount}
                </div>
              </CardContent>
            </Card>

            <Card onClick={() => setStatusFilter('CONVERTED_TO_SALE')} style={{ cursor: 'pointer' }}>
              <CardContent style={{ padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 700 }}>INVOICED / SALE</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#16A34A', marginTop: '4px' }}>
                  {convertedOrdersCount}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orders Table */}
          <Card>
            <CardHeader>
              <CardTitle>ORDER CONTROL REGISTER</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton columns={7} rows={6} />
              ) : ordersList.length === 0 ? (
                <EmptyState title="No Orders" description="No sales orders found matching current filter." />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left', borderBottom: '2px solid var(--border-default)' }}>
                        <th style={{ padding: '10px 12px' }}>Order #</th>
                        <th style={{ padding: '10px 12px' }}>Dealer & Territory</th>
                        <th style={{ padding: '10px 12px' }}>Sales Officer</th>
                        <th style={{ padding: '10px 12px' }}>Payment Term</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Accounting Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersList.map((ord: any) => {
                        const invoiceList = ord.salesInvoices || ord.invoices || [];
                        return (
                          <tr key={ord.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{ord.orderNumber}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {new Date(ord.orderDate).toLocaleDateString()}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600 }}>{ord.dealer?.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {ord.region?.name} • {ord.territory?.name}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {ord.salesOfficer ? `${ord.salesOfficer.firstName} ${ord.salesOfficer.lastName}` : 'Direct'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <Badge variant={ord.paymentTerm === 'CREDIT' ? 'warning' : 'secondary'}>
                                {ord.paymentTerm || 'CASH'}
                              </Badge>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                              {formatPKR(ord.totalAmount)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <Badge
                                variant={
                                  ord.status === 'CREDIT_HOLD'
                                    ? 'danger'
                                    : ord.status === 'CONVERTED_TO_SALE'
                                    ? 'success'
                                    : ord.status === 'APPROVED'
                                    ? 'primary'
                                    : 'warning'
                                }
                              >
                                {ord.status}
                              </Badge>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {invoiceList.length > 0 ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openAccountingImpact('SALES_INVOICE', invoiceList[0].id)}
                                >
                                  View Impact
                                </Button>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Pre-Invoice</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. SALES AUDIT TAB */}
      {activeTab === 'sales-audit' && (
        <Card>
          <CardHeader>
            <CardTitle>SALES AUDIT REGISTER (FULL LIFECYCLE TRACE)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton columns={7} rows={6} />
            ) : salesAuditData.length === 0 ? (
              <EmptyState title="No Sales Transactions" description="No posted sales invoices found." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left', borderBottom: '2px solid var(--border-default)' }}>
                      <th style={{ padding: '10px 12px' }}>Invoice #</th>
                      <th style={{ padding: '10px 12px' }}>Dealer & Territory</th>
                      <th style={{ padding: '10px 12px' }}>Sales Officer</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Net Amount</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Ledger Entries</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Journals</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesAuditData.map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{inv.invoiceNumber}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {new Date(inv.invoiceDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{inv.dealer?.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {inv.region?.name} • {inv.territory?.name}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {inv.salesOfficer ? `${inv.salesOfficer.firstName} ${inv.salesOfficer.lastName}` : 'Direct'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {formatPKR(inv.netAmount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <Badge variant="secondary">{inv.dealerLedgerEntries?.length || 0} Entries</Badge>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <Badge variant="success">{inv.journalEntries?.length || 0} JVs</Badge>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => openAccountingImpact('SALES_INVOICE', inv.id)}
                          >
                            View Accounting Impact
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. PURCHASE AUDIT TAB */}
      {activeTab === 'purchase-audit' && (
        <Card>
          <CardHeader>
            <CardTitle>PURCHASE AUDIT REGISTER (PROCUREMENT TRACE)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton columns={7} rows={6} />
            ) : purchaseAuditData.length === 0 ? (
              <EmptyState title="No Purchases" description="No posted purchase invoices found." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left', borderBottom: '2px solid var(--border-default)' }}>
                      <th style={{ padding: '10px 12px' }}>Voucher #</th>
                      <th style={{ padding: '10px 12px' }}>Vendor / Supplier</th>
                      <th style={{ padding: '10px 12px' }}>Items Count</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Net Amount</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Vendor Ledger</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseAuditData.map((po) => (
                      <tr key={po.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {po.voucherNumber}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{po.vendor?.name}</td>
                        <td style={{ padding: '10px 12px' }}>{po.items?.length || 0} items</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                          {formatPKR(po.netAmount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <Badge variant="secondary">{po.vendorLedgerEntries?.length || 0} Entries</Badge>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => openAccountingImpact('PURCHASE_INVOICE', po.id)}
                          >
                            View Accounting Impact
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. PAYMENT / COLLECTION AUDIT TAB */}
      {activeTab === 'payment-audit' && (
        <Card>
          <CardHeader>
            <CardTitle>PAYMENT & COLLECTION AUDIT</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton columns={6} rows={6} />
            ) : paymentAuditData.length === 0 ? (
              <EmptyState title="No Payments" description="No posted payment receipts found." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left', borderBottom: '2px solid var(--border-default)' }}>
                      <th style={{ padding: '10px 12px' }}>Date</th>
                      <th style={{ padding: '10px 12px' }}>Receipt #</th>
                      <th style={{ padding: '10px 12px' }}>Dealer</th>
                      <th style={{ padding: '10px 12px' }}>Payment Mode</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Accounting Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentAuditData.map((pay) => (
                      <tr key={pay.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px' }}>{new Date(pay.paymentDate).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {pay.receiptNumber}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{pay.dealer?.name}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge variant="secondary">{pay.paymentType} {pay.bankName ? `(${pay.bankName})` : ''}</Badge>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>
                          {formatPKR(pay.amount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => openAccountingImpact('DEALER_PAYMENT', pay.id)}
                          >
                            View Accounting Impact
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* "VIEW ACCOUNTING IMPACT" AUDITOR INSPECTOR MODAL (Requirement 62) */}
      <Modal
        isOpen={isImpactModalOpen}
        onClose={() => setIsImpactModalOpen(false)}
        title="Transaction Accounting & Operational Impact Inspector"
      >
        {impactLoading ? (
          <TableSkeleton columns={3} rows={5} />
        ) : !selectedImpact ? (
          <EmptyState title="No Records" description="No accounting consequence found for this transaction." />
        ) : (() => {
          const jvList = selectedImpact.journalEntries || (selectedImpact.journalEntry ? [selectedImpact.journalEntry] : []);
          const ledList = selectedImpact.ledgerEntries || selectedImpact.ledgerImpact || [];
          const stkList = selectedImpact.stockEntries || selectedImpact.stockMovement || [];
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header Summary */}
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SOURCE TRANSACTION:</span>
                <div style={{ fontWeight: 800, fontSize: 'var(--font-size-md)', color: 'var(--color-primary)' }}>
                  {selectedImpact.sourceType} • {selectedImpact.sourceRecord?.invoiceNumber || selectedImpact.sourceRecord?.voucherNumber || selectedImpact.sourceRecord?.receiptNumber}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>TRANSACTION AMOUNT:</span>
                <div style={{ fontWeight: 800, fontSize: 'var(--font-size-md)' }}>
                  {formatPKR(selectedImpact.sourceRecord?.netAmount || selectedImpact.sourceRecord?.amount)}
                </div>
              </div>
            </div>

            {/* 1. General Ledger Journals (Dr / Cr) */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: '8px', color: 'var(--text-primary)' }}>
                1. General Ledger Balanced Journal Impact
              </div>
              {jvList.length > 0 ? (
                <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>JV #</th>
                        <th style={{ padding: '8px 10px' }}>Account</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Debit</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jvList.map((jv: any) =>
                        (jv.lines || []).map((l: any) => (
                          <tr key={l.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '6px 10px', color: 'var(--color-primary)', fontWeight: 600 }}>{jv.entryNumber}</td>
                            <td style={{ padding: '6px 10px' }}>{l.account?.accountCode} - {l.account?.accountName}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                              {Number(l.debit) > 0 ? formatPKR(l.debit) : '-'}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                              {Number(l.credit) > 0 ? formatPKR(l.credit) : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>No GL journal entries recorded.</div>
              )}
            </div>

            {/* 2. Sub-Ledger Impact */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: '8px', color: 'var(--text-primary)' }}>
                2. Sub-Ledger Running Balance Impact
              </div>
              {ledList.length > 0 ? (
                <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Voucher</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Debit</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Credit</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledList.map((le: any) => (
                        <tr key={le.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '6px 10px' }}>{le.voucherNumber}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{Number(le.debit) > 0 ? formatPKR(le.debit) : '-'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{Number(le.credit) > 0 ? formatPKR(le.credit) : '-'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>{formatPKR(le.runningBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>No sub-ledger impact entries.</div>
              )}
            </div>

            {/* 3. Stock Movement Impact */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: '8px', color: 'var(--text-primary)' }}>
                3. Physical Stock Movement
              </div>
              {stkList.length > 0 ? (
                <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-subtle)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Item Type</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Quantity Delta</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Stock After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stkList.map((stk: any) => (
                        <tr key={stk.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '6px 10px' }}>{stk.itemType}</td>
                          <td
                            style={{
                              padding: '6px 10px',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: Number(stk.quantityChange) >= 0 ? '#16A34A' : '#DC2626',
                            }}
                          >
                            {Number(stk.quantityChange) > 0 ? `+${stk.quantityChange}` : stk.quantityChange}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{stk.quantityAfter}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>No physical inventory movements for this record.</div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setIsImpactModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        );
      })()}
      </Modal>
    </div>
  );
};
