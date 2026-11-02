'use client';

/**
 * SHEHSWAR ONE360 - Dynamic Product Import Modal
 *
 * Supports flexible document/file import without requiring a rigid single template.
 * - Parses CSV, TSV, JSON, or tabular text
 * - Normalizes known fields
 * - Preserves unknown fields in `customFields`
 * - Pre-import duplicate review with options: SKIP, UPDATE, CREATE_NEW
 */
import React, { useState } from 'react';
import { ApiClient } from '../../lib/api-client';
import { useToast } from '../../context/toast-context';
import { IconClose, IconDownload, IconCheck, IconSparkles } from '../icons';

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
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text || '');
    };
    reader.readAsText(file);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-base">
            <IconSparkles size={20} />
            <span>Dynamic Product Import (CSV / Excel / Structured Text)</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="p-8 border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-2xl text-center bg-slate-800/20 transition-all flex flex-col items-center justify-center">
                <input
                  type="file"
                  id="product-file-input"
                  accept=".csv,.txt,.json,.tsv,.xlsx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="product-file-input"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <IconDownload size={24} />
                  </div>
                  <span className="text-white font-medium text-sm">
                    {fileName ? fileName : 'Click to select CSV or tabular document'}
                  </span>
                  <span className="text-slate-400 text-xs">
                    Any tabular structure accepted. Known fields are mapped, and custom fields are preserved in JSON.
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Or paste text / CSV data directly:
                </label>
                <textarea
                  rows={6}
                  placeholder="Product Name, Pack Size, Unit, Selling Price, PPC, Grade, Custom Field..."
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                  <span className="text-slate-400 text-xs">Detected Records</span>
                  <p className="text-xl font-bold text-white mt-0.5">{previewData?.totalDetected || 0}</p>
                </div>
                <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                  <span className="text-slate-400 text-xs">Duplicates Found</span>
                  <p className={`text-xl font-bold mt-0.5 ${(previewData?.duplicateCount || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {previewData?.duplicateCount || 0}
                  </p>
                </div>
                <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                  <span className="text-slate-400 text-xs">Detected Headers</span>
                  <p className="text-xs text-indigo-300 font-mono mt-1 truncate">
                    {previewData?.detectedHeaders?.join(', ')}
                  </p>
                </div>
              </div>

              {/* Records Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/90 text-slate-300 sticky top-0 border-b border-slate-700">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Product Name</th>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Pack Size</th>
                      <th className="p-2.5">Price (PKR)</th>
                      <th className="p-2.5">Extra Fields (customFields)</th>
                      <th className="p-2.5 text-right">Duplicate Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {records.map((r, idx) => (
                      <tr key={r.tempId || idx} className={r.isDuplicate ? 'bg-amber-500/5' : ''}>
                        <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-medium text-white">
                          {r.productName}
                          {r.urduName && <span className="block text-slate-400 text-[10px]">{r.urduName}</span>}
                        </td>
                        <td className="p-2.5 font-mono text-indigo-300">{r.productCode || '(Auto-gen)'}</td>
                        <td className="p-2.5">{r.packSizeQuantity ? `${r.packSizeQuantity} ${r.packSizeUnit || 'L'}` : '-'}</td>
                        <td className="p-2.5 font-medium text-emerald-400">{r.baseSellingPrice ? `PKR ${r.baseSellingPrice}` : '-'}</td>
                        <td className="p-2.5">
                          {r.unknownFields && Object.keys(r.unknownFields).length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(r.unknownFields).slice(0, 3).map(([k, v]: any) => (
                                <span key={k} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300">
                                  {k}: {String(v)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[10px]">None</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          {r.isDuplicate ? (
                            <div className="inline-flex rounded-lg border border-slate-700 p-0.5 bg-slate-800">
                              <button
                                type="button"
                                onClick={() => toggleDuplicateAction(idx, 'SKIP')}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                  r.duplicateAction === 'SKIP' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                Skip
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleDuplicateAction(idx, 'UPDATE')}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                  r.duplicateAction === 'UPDATE' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                Update
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleDuplicateAction(idx, 'CREATE_NEW')}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                  r.duplicateAction === 'CREATE_NEW' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                New
                              </button>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                              Ready (New)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'completed' && (
            <div className="p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <IconCheck size={28} />
              </div>
              <h3 className="text-lg font-bold text-white">Import Successfully Processed</h3>
              <p className="text-sm text-slate-400">
                All reviewed products and dynamic custom fields have been stored into the master database.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-between items-center bg-slate-900/50">
          {step === 'upload' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParseAndPreview}
                disabled={isLoading}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 flex items-center gap-2"
              >
                {isLoading ? 'Detecting Structure...' : 'Preview Import Records →'}
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium"
              >
                ← Back to Upload
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isLoading}
                className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                {isLoading ? 'Importing...' : `Confirm & Import ${records.filter((r) => r.duplicateAction !== 'SKIP').length} Products`}
              </button>
            </>
          )}

          {step === 'completed' && (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold"
            >
              Close & View Catalog
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
