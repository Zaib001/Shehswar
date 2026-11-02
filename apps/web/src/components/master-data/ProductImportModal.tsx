'use client';

/**
 * SHEHSWAR ONE360 - Dynamic Product Import Modal
 *
 * Full Enterprise UI matching Canonical Shehswar ERP Design System:
 * - Uses standard Modal component from '../ui'
 * - Flexible file parsing (CSV, TSV, JSON, structured text)
 * - Known field normalization & dynamic unknown field preservation in customFields
 * - Pre-import duplicate resolution (SKIP, UPDATE, CREATE_NEW)
 */
import React, { useState } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import { Modal, Button } from '../ui';
import { IconDownload, IconCheck } from '../icons';

interface ProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const ProductImportModal: React.FC<ProductImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const { showToast } = useToast();
  const [step, setStep] = useState<'upload' | 'preview' | 'completed'>('upload');
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [records, setRecords] = useState<any[]>([]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const lower = file.name.toLowerCase();
    const isBinary = lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.pdf');

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (isBinary) {
        const base64 = result.includes('base64,') ? result.split('base64,')[1] : result;
        setFileContent(base64 || '');
      } else {
        setFileContent(result || '');
      }
    };

    if (isBinary) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleParseAndPreview = async () => {
    if (!fileContent.trim()) {
      showToast({ title: 'Validation', message: 'Please select a file or paste content first', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await ApiClient.post<any>('/api/v1/master-data/products/import-preview', {
        content: fileContent,
        fileName: fileName || 'products-import.csv',
      });
      setPreviewData(res.data);
      setRecords(res.data?.records || []);
      setStep('preview');
    } catch (err: any) {
      showToast({
        title: 'Parsing Failed',
        message: err.response?.data?.message || err.message || 'Could not parse product records from file',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDuplicateAction = (index: number, action: 'SKIP' | 'UPDATE' | 'CREATE_NEW') => {
    setRecords((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], duplicateAction: action };
      }
      return updated;
    });
  };

  const handleConfirmImport = async () => {
    setIsLoading(true);
    try {
      const res = await ApiClient.post<any>('/api/v1/master-data/products/import-confirm', {
        records,
        categoryId: '',
      });
      showToast({
        title: 'Import Success',
        message: res.data?.message || 'Products imported successfully',
        type: 'success',
      });
      setStep('completed');
      onImportComplete();
    } catch (err: any) {
      showToast({
        title: 'Import Error',
        message: err.response?.data?.message || err.message || 'Failed to complete import',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dynamic Product Import / Upload"
      description="Flexible document parser: maps standard fields and stores unknown supplier columns dynamically"
      size="xl"
      footer={
        step === 'upload' ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleParseAndPreview}
              isLoading={isLoading}
              style={{ backgroundColor: '#2563EB', borderColor: '#2563EB', color: '#fff' }}
            >
              Parse & Preview Records →
            </Button>
          </div>
        ) : step === 'preview' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Button variant="secondary" size="sm" onClick={() => setStep('upload')} disabled={isLoading}>
              ← Back to File
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmImport}
              isLoading={isLoading}
              style={{ backgroundColor: '#10B981', borderColor: '#10B981', color: '#fff' }}
            >
              Confirm Import ({records.filter((r) => r.duplicateAction !== 'SKIP').length} Records)
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              variant="primary"
              size="sm"
              onClick={onClose}
              style={{ backgroundColor: '#10B981', borderColor: '#10B981', color: '#fff' }}
            >
              Finish & Refresh
            </Button>
          </div>
        )
      }
    >
      {step === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '28px',
              border: '2px dashed #CBD5E1',
              borderRadius: '12px',
              background: '#F8FAFC',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <input
              type="file"
              id="product-file-input"
              accept=".csv,.txt,.json,.tsv,.xlsx,.xls,.pdf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <label htmlFor="product-file-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: '#EEF2FF',
                  color: '#4F46E5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconDownload size={22} />
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0F172A' }}>
                {fileName ? fileName : 'Click to select Excel (.xlsx, .xls), PDF, or CSV'}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                Auto-detects categories, embedded pack sizes, carton PPC, and seasonal rates. Unknown columns preserved.
              </span>
            </label>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Or paste tabular text directly:
            </label>
            <textarea
              rows={5}
              placeholder="Sr#, Product, Composition, Pack In Carton, Seasonal Rate..."
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.78rem',
                color: '#0F172A',
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Total Detected</span>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: '4px 0 0 0' }}>
                {previewData?.totalDetected || records.length || 0} Products
              </p>
            </div>
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Duplicates Checked</span>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: (previewData?.duplicateCount || 0) > 0 ? '#D97706' : '#059669', margin: '4px 0 0 0' }}>
                {previewData?.duplicateCount || 0}
              </p>
            </div>
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Preserved Extra Headers</span>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4F46E5', margin: '4px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {previewData?.detectedHeaders?.join(', ') || 'None'}
              </p>
            </div>
          </div>

          <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', maxHeight: '340px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
              <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600, position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '8px 10px' }}>#</th>
                  <th style={{ padding: '8px 10px' }}>Product & Formulation</th>
                  <th style={{ padding: '8px 10px' }}>Classification</th>
                  <th style={{ padding: '8px 10px' }}>Pack Size</th>
                  <th style={{ padding: '8px 10px' }}>PPC</th>
                  <th style={{ padding: '8px 10px' }}>Seasonal Rate</th>
                  <th style={{ padding: '8px 10px' }}>Status & Action</th>
                </tr>
              </thead>
              <tbody style={{ color: '#0F172A' }}>
                {records.map((r, idx) => {
                  const qty = r.packSizeQuantity !== undefined ? r.packSizeQuantity : r.packingQuantity;
                  const unit = r.packSizeUnit || r.packingUnit || 'Liter';
                  const price = r.baseSellingPrice !== undefined ? r.baseSellingPrice : r.defaultSellingPrice;
                  const mType = r.mType || r.category || 'Insecticides';
                  const composition = r.unknownFields?.Composition || r.composition;

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 10px', color: '#64748B', fontFamily: 'var(--font-mono, monospace)' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{r.productName}</div>
                        {composition && (
                          <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '2px' }}>
                            {composition}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: '#EFF6FF',
                            color: '#1D4ED8',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                          }}
                        >
                          {mType}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                        {qty ? `${qty} ${unit}` : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono, monospace)' }}>
                        {r.ppc || 1}
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: '#059669' }}>
                        {price ? `PKR ${Number(price).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {r.isDuplicate ? (
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span style={{ color: '#D97706', fontSize: '0.72rem', fontWeight: 600 }}>Duplicate:</span>
                            <button
                              type="button"
                              onClick={() => toggleDuplicateAction(idx, 'SKIP')}
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                                background: r.duplicateAction === 'SKIP' ? '#0F172A' : '#FFFFFF',
                                color: r.duplicateAction === 'SKIP' ? '#FFFFFF' : '#334155',
                                cursor: 'pointer',
                              }}
                            >
                              Skip
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleDuplicateAction(idx, 'UPDATE')}
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                                background: r.duplicateAction === 'UPDATE' ? '#2563EB' : '#FFFFFF',
                                color: r.duplicateAction === 'UPDATE' ? '#FFFFFF' : '#334155',
                                cursor: 'pointer',
                              }}
                            >
                              Update
                            </button>
                          </div>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: '#ECFDF5',
                              color: '#059669',
                              fontWeight: 600,
                              fontSize: '0.72rem',
                            }}
                          >
                            New Product
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 'completed' && (
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#ECFDF5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
            }}
          >
            <IconCheck size={28} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
            Products Imported Successfully
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#64748B' }}>
            All valid records have been saved into the Finished Products master catalog.
          </p>
        </div>
      )}
    </Modal>
  );
};
