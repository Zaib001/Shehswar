'use client';

/**
 * SHEHSWAR ONE360 - Dealer Payment Receipts UI
 *
 * Follows Canonical Flow:
 * - Field or Office Payment Collection (Bank Deposit, Online Transfer, Cash)
 * - Atomic Execution: Creates DealerPaymentReceipt and credits Dealer Ledger.
 * - Dealer running balance decreases immediately across Web & Mobile.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ListPageTemplate } from '../templates';
import {
  DataTable,
  ColumnDef,
  Button,
  Input,
  Select,
  Textarea,
  StatusBadge,
  KpiCard,
  Modal,
  TableSkeleton,
  EmptyState,
} from '../ui';
import {
  IconPlus,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';

export interface DealerPaymentRecord {
  id: string;
  receiptNumber: string;
  paymentDate: string;
  dealerId: string;
  dealer?: { id: string; name: string; code: string };
  salesOfficer?: { id: string; firstName: string; lastName: string };
  paymentType: string;
  amount: number;
  bankName?: string;
  referenceNumber?: string;
  status: string;
  notes?: string;
}

export const DealerPaymentsView: React.FC = () => {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<DealerPaymentRecord[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Record Payment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const slipInputRef = React.useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    dealerId: '',
    paymentType: 'BANK_TRANSFER',
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    bankName: '',
    referenceNumber: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [payRes, dealerRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/dealer-payments').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/dealers').catch(() => ({ data: [] })),
      ]);

      setPayments(Array.isArray(payRes.data) ? payRes.data : payRes.data?.data || []);
      setDealers(Array.isArray(dealerRes.data) ? dealerRes.data : dealerRes.data?.data || []);
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load dealer payments', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUploadSlip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOcrLoading(true);
    showToast({ title: 'Processing Slip', message: `Reading and extracting ${file.name}...`, type: 'info' });
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('documentType', 'BANK_RECEIPT');

      const res = await ApiClient.uploadFile<any>('/api/v1/operations/ocr/upload', formDataUpload);
      const ext = res.data?.extractedFields || {};

      setFormData((prev) => ({
        ...prev,
        paymentType: 'BANK_TRANSFER',
        amount: Number(ext.amount) || prev.amount,
        bankName: ext.bankName || prev.bankName,
        referenceNumber: ext.referenceNumber || prev.referenceNumber,
        paymentDate: ext.paymentDate || prev.paymentDate,
        notes: ext.notes || `Extracted from ${file.name}`,
      }));
      setIsModalOpen(true);
      showToast({ title: 'Slip Extracted', message: 'Bank details auto-filled. Select dealer and confirm.', type: 'success' });
    } catch (err: any) {
      showToast({ title: 'Extraction Error', message: err.message || 'Failed to extract slip', type: 'error' });
    } finally {
      setIsOcrLoading(false);
      if (slipInputRef.current) slipInputRef.current.value = '';
    }
  };

  const handleRecordPayment = async () => {
    if (!formData.dealerId || formData.amount <= 0) {
      showToast({ title: 'Validation Error', message: 'Please select a Dealer and enter a valid Amount', type: 'error' });
      return;
    }

    try {
      await ApiClient.post('/api/v1/dealer-payments', formData);
      showToast({
        title: 'Payment Recorded!',
        message: 'Dealer balance credited and ledger statement updated atomically.',
        type: 'success',
      });
      setIsModalOpen(false);
      setFormData({
        dealerId: '',
        paymentType: 'BANK_TRANSFER',
        amount: 0,
        paymentDate: new Date().toISOString().split('T')[0],
        bankName: '',
        referenceNumber: '',
        notes: '',
      });
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Failed to record payment', type: 'error' });
    }
  };

  const selectedDealerObj = dealers.find((d) => d.id === formData.dealerId);

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.receiptNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.dealer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.referenceNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || p.paymentType === typeFilter;
    return matchesSearch && matchesType;
  });

  // KPIs
  const totalCollections = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const bankCollections = payments
    .filter((p) => p.paymentType === 'BANK_TRANSFER' || p.paymentType === 'CHEQUE')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const cashCollections = payments
    .filter((p) => p.paymentType === 'CASH')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const columns: ColumnDef<DealerPaymentRecord>[] = [
    {
      key: 'receiptNumber',
      header: 'Receipt #',
      render: (p) => <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{p.receiptNumber}</span>,
    },
    {
      key: 'paymentDate',
      header: 'Date',
      render: (p) => new Date(p.paymentDate).toLocaleDateString(),
    },
    {
      key: 'dealer',
      header: 'Dealer',
      render: (p) => (
        <div>
          <div style={{ fontWeight: 600 }}>{p.dealer?.name || 'Dealer'}</div>
          {p.dealer?.code && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.dealer.code}</div>}
        </div>
      ),
    },
    {
      key: 'paymentType',
      header: 'Mode',
      render: (p) => <StatusBadge status={p.paymentType} variant="neutral" />,
    },
    {
      key: 'bankName',
      header: 'Bank / Ref',
      render: (p) => (
        <div>
          <div>{p.bankName || 'Cash Desk'}</div>
          {p.referenceNumber && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ref: {p.referenceNumber}</div>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount Collected',
      render: (p) => (
        <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>
          PKR {Number(p.amount).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Ledger Effect',
      render: () => <StatusBadge status="CREDITED" variant="success" />,
    },
  ];

  return (
    <ListPageTemplate
      title="Dealer Payments & Collections"
      subtitle="Record and verify dealer payment receipts. Directly credits dealer ledger running balance."
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="file"
            ref={slipInputRef}
            onChange={handleUploadSlip}
            accept=".pdf,.png,.jpg,.jpeg,.txt"
            style={{ display: 'none' }}
          />
          <Button
            variant="secondary"
            onClick={() => slipInputRef.current?.click()}
            disabled={isOcrLoading}
          >
            {isOcrLoading ? 'Extracting Slip...' : 'Upload Bank Slip'}
          </Button>
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <IconPlus size={16} /> Record Payment Receipt
          </Button>
        </div>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <KpiCard
          title="Total Collections"
          value={`PKR ${(totalCollections / 1000000).toFixed(2)}M`}
          subtitle="All confirmed payment receipts"
        />
        <KpiCard
          title="Bank Transfers"
          value={`PKR ${(bankCollections / 1000000).toFixed(2)}M`}
          subtitle="Online & Cheque deposits"
        />
        <KpiCard
          title="Cash Collections"
          value={`PKR ${(cashCollections / 1000000).toFixed(2)}M`}
          subtitle="Field and counter receipts"
        />
        <KpiCard
          title="Total Receipts"
          value={payments.length}
          subtitle="Transaction count"
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <Input
            placeholder="Search by receipt #, dealer, or transaction ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={[
            { label: 'All Modes', value: 'ALL' },
            { label: 'BANK_TRANSFER', value: 'BANK_TRANSFER' },
            { label: 'CASH', value: 'CASH' },
            { label: 'CHEQUE', value: 'CHEQUE' },
          ]}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : filteredPayments.length === 0 ? (
        <EmptyState
          title="No Payment Receipts Found"
          description="Record incoming dealer cash collections or bank transfers to reduce their running ledger balance."
          actionLabel="Record Payment"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <DataTable columns={columns} data={filteredPayments} />
      )}

      {/* Record Payment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Dealer Payment Receipt"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRecordPayment}>
              Post Payment to Ledger
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <Select
              label="Dealer *"
              value={formData.dealerId}
              onChange={(e) => setFormData({ ...formData, dealerId: e.target.value })}
              options={[
                { label: 'Select Dealer...', value: '' },
                ...dealers.map((d) => ({
                  label: `${d.code} - ${d.name} (Balance: PKR ${Number(d.currentBalance || 0).toLocaleString()})`,
                  value: d.id,
                })),
              ]}
            />
          </div>

          {selectedDealerObj && (
            <div
              style={{
                gridColumn: 'span 2',
                padding: '12px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
              }}
            >
              Current Outstanding Balance: <strong>PKR {Number(selectedDealerObj.currentBalance || 0).toLocaleString()}</strong>
            </div>
          )}

          <Select
            label="Payment Mode *"
            value={formData.paymentType}
            onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
            options={[
              { label: 'Bank Transfer / Online', value: 'BANK_TRANSFER' },
              { label: 'Cash Receipt', value: 'CASH' },
              { label: 'Bank Cheque', value: 'CHEQUE' },
            ]}
          />

          <Input
            label="Amount (PKR) *"
            type="number"
            min="1"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
          />

          <Input
            label="Bank Name"
            placeholder="e.g. Meezan Bank, HBL"
            value={formData.bankName}
            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
          />

          <Input
            label="Reference / Transaction ID"
            placeholder="e.g. TR-2026-9938"
            value={formData.referenceNumber}
            onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
          />

          <Input
            label="Payment Date"
            type="date"
            value={formData.paymentDate}
            onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
          />

          <div style={{ gridColumn: 'span 2' }}>
            <Textarea
              label="Notes"
              placeholder="Deposit slip details or remarks"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </ListPageTemplate>
  );
};
