'use client';

/**
 * SHEHSWAR ONE360 - Dealers Management, 4-Tier Market Binding & Running Ledger UI
 *
 * Canonical Market Architecture:
 * - Dealer belongs to: Company -> Region -> Zone -> Territory
 * - Responsible Sales Officer / FO assignment
 * - Safe Delete / Deactivation with audit protection
 * - Automatic Dealer Code generation (DLR-XXXXXX)
 * - Fixed-width, responsive Searchable Territory Combobox with tooltip
 * - Keyboard-first navigation (Enter moves to next field)
 * - Real-time running ledger statements
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  IconFileText,
  IconRefresh,
  IconEdit,
  IconClock,
  IconDownload,
  IconTrash,
  IconSearch,
  IconChevronDown,
  IconCheck,
  IconAlertTriangle,
  IconLock,
  IconMoreVertical,
} from '../icons';
import { DealerLedgerModal } from './DealerLedgerModal';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';
import { exportDealerLedgerToPdf, exportDealersListPdf } from '../../lib/pdf-export';

export interface DealerRecord {
  id: string;
  code: string;
  name: string;
  businessName?: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  creditLimit: number;
  currentBalance: number;
  status: string;
  territoryId?: string;
  territory?: any;
  assignedFieldOfficerId?: string;
  assignedOfficer?: any;
  officerAssignments?: any[];
  notes?: string;
}

// -------------------------------------------------------------
// RESPONSIVE SEARCHABLE COMBOBOX WITH ELLIPSIS & TOOLTIP
// -------------------------------------------------------------
interface SearchableComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  code?: string;
}

interface SearchableComboboxProps {
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  value: string;
  onChange: (val: string) => void;
  options: SearchableComboboxOption[];
  required?: boolean;
  onEnterPressNext?: () => void;
  inputRef?: React.RefObject<HTMLButtonElement | null>;
}

const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  label,
  placeholder = 'Select option...',
  searchPlaceholder = 'Type to filter...',
  value,
  onChange,
  options,
  required = false,
  onEnterPressNext,
  inputRef,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      opt.label.toLowerCase().includes(q) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
      (opt.code && opt.code.toLowerCase().includes(q))
    );
  });

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    if (onEnterPressNext) {
      setTimeout(() => {
        onEnterPressNext();
      }, 50);
    }
  };

  const fullDisplayTitle = selectedOption
    ? `${selectedOption.code ? `[${selectedOption.code}] ` : ''}${selectedOption.label}${selectedOption.sublabel ? ` (${selectedOption.sublabel})` : ''}`
    : '';

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        position: 'relative',
      }}
    >
      <label
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-secondary, #475569)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>

      {/* Trigger Button with Fixed Ellipsis & Native Tooltip */}
      <button
        ref={inputRef as any}
        type="button"
        title={fullDisplayTitle || placeholder}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            setIsOpen(true);
          } else if (e.key === 'Tab') {
            setIsOpen(false);
          }
        }}
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          height: '38px',
          padding: '0 12px',
          borderRadius: '6px',
          border: '1px solid var(--border-default, #cbd5e1)',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          outline: 'none',
          textAlign: 'left',
          fontSize: '13px',
          transition: 'border-color 0.15s ease',
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: selectedOption ? '#1e293b' : '#94a3b8',
            fontWeight: selectedOption ? 500 : 400,
          }}
        >
          {selectedOption ? (
            <>
              {selectedOption.code && (
                <span style={{ fontWeight: 600, color: 'var(--color-primary, #1e40af)', marginRight: '6px' }}>
                  {selectedOption.code}
                </span>
              )}
              {selectedOption.label}
              {selectedOption.sublabel && (
                <span style={{ color: '#64748b', fontSize: '11px', marginLeft: '6px' }}>
                  ({selectedOption.sublabel})
                </span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <IconChevronDown size={14} style={{ color: '#64748b', flexShrink: 0, marginLeft: '8px' }} />
      </button>

      {/* Searchable Dropdown Popup */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            maxHeight: '260px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search Box Header */}
          <div
            style={{
              padding: '8px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <IconSearch size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedIndex((prev) => (prev + 1 < filteredOptions.length ? prev + 1 : 0));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredOptions.length - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredOptions[highlightedIndex]) {
                    handleSelect(filteredOptions[highlightedIndex].value);
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsOpen(false);
                }
              }}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: '12px',
                color: '#1e293b',
              }}
            />
          </div>

          {/* Options List */}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: '200px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                No matching territories found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={opt.value}
                    title={`${opt.label} ${opt.sublabel ? `(${opt.sublabel})` : ''}`}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      backgroundColor: isHighlighted ? '#f1f5f9' : isSelected ? '#eff6ff' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? '#1d4ed8' : '#1e293b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {opt.code && (
                          <span style={{ fontWeight: 700, color: '#2563eb', marginRight: '6px' }}>
                            {opt.code}
                          </span>
                        )}
                        {opt.label}
                      </div>
                      {opt.sublabel && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: '2px',
                          }}
                        >
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                    {isSelected && <IconCheck size={14} style={{ color: '#2563eb', flexShrink: 0 }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// SLEEK ACTION MENU ITEM
// -------------------------------------------------------------
interface ActionMenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}

const ActionMenuItem: React.FC<ActionMenuItemProps> = ({ icon, label, onClick, danger }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        width: '100%',
        padding: '7px 10px',
        fontSize: '12px',
        fontWeight: danger ? 600 : 500,
        color: danger ? '#dc2626' : '#1e293b',
        backgroundColor: hovered ? (danger ? '#fef2f2' : '#f1f5f9') : 'transparent',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.12s ease',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
};

export const DealersView: React.FC = () => {
  const { showToast } = useToast();
  const [dealers, setDealers] = useState<DealerRecord[]>([]);
  const [salesOfficers, setSalesOfficers] = useState<any[]>([]);
  const [territories, setTerritories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);

  // Action Menu Portal Anchor State
  const [menuAnchor, setMenuAnchor] = useState<{
    id: string;
    dealer: DealerRecord;
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close menu on click outside, scroll, resize
  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-dealer-actions-portal]')) return;
      setMenuAnchor(null);
    };
    const handleScrollOrResize = () => {
      setMenuAnchor(null);
    };
    document.addEventListener('mousedown', handleClose);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, []);

  // Ledger Modal State
  const [selectedDealerForLedger, setSelectedDealerForLedger] = useState<DealerRecord | null>(null);

  // Assignment History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedDealerForHistory, setSelectedDealerForHistory] = useState<DealerRecord | null>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Reassign Modal State
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [dealerToReassign, setDealerToReassign] = useState<DealerRecord | null>(null);
  const [reassignForm, setReassignForm] = useState({
    territoryId: '',
    salesOfficerId: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
  });

  // Safe Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [dealerToDelete, setDealerToDelete] = useState<DealerRecord | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Dealer Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [dealerToEdit, setDealerToEdit] = useState<DealerRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    businessName: '',
    contactPerson: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    creditLimit: 0,
    territoryId: '',
    salesOfficerId: '',
    status: 'ACTIVE',
    notes: '',
  });

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    contactPerson: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    creditLimit: 0,
    territoryId: '',
    salesOfficerId: '',
    notes: '',
  });

  // Form field refs for keyboard-first navigation (Enter jumps to next input)
  const inputRefs = {
    name: useRef<HTMLInputElement>(null),
    businessName: useRef<HTMLInputElement>(null),
    contactPerson: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    city: useRef<HTMLInputElement>(null),
    territoryCombobox: useRef<HTMLButtonElement>(null),
    salesOfficer: useRef<HTMLButtonElement>(null),
    creditLimit: useRef<HTMLInputElement>(null),
    address: useRef<HTMLTextAreaElement>(null),
    submitBtn: useRef<HTMLButtonElement>(null),
  };

  const handleFieldEnter = (nextFieldRef: React.RefObject<any>) => {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nextFieldRef.current?.focus();
      }
    };
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dealerRes, userRes, terrRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/dealers').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/users').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/territories').catch(() => ({ data: [] })),
      ]);

      setDealers(Array.isArray(dealerRes.data) ? dealerRes.data : dealerRes.data?.data || []);
      setSalesOfficers(Array.isArray(userRes.data) ? userRes.data : userRes.data?.data || []);
      setTerritories(Array.isArray(terrRes.data) ? terrRes.data : terrRes.data?.data || []);
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load dealers', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Create Dealer (Automatic Sequential Dealer Code)
  const handleCreateDealer = async () => {
    if (!formData.name.trim()) {
      showToast({ title: 'Validation Error', message: 'Dealer / Owner Name is required', type: 'error' });
      inputRefs.name.current?.focus();
      return;
    }
    if (!formData.phone.trim()) {
      showToast({ title: 'Validation Error', message: 'Phone Number is required', type: 'error' });
      inputRefs.phone.current?.focus();
      return;
    }

    setIsSubmittingCreate(true);
    try {
      // Backend automatically generates sequential code DLR-XXXXXX when code is 'AUTO' or omitted
      const res = await ApiClient.post<any>('/api/v1/dealers', {
        code: 'AUTO',
        name: formData.name.trim(),
        businessName: formData.businessName.trim() || undefined,
        contactPerson: formData.contactPerson.trim() || undefined,
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        city: formData.city.trim() || undefined,
        address: formData.address.trim() || undefined,
        creditLimit: Number(formData.creditLimit) || 0,
        territoryId: formData.territoryId || undefined,
        salesOfficerId: formData.salesOfficerId || undefined,
        notes: formData.notes.trim() || undefined,
      });

      const createdDealer = res.data?.data || res.data;

      // Assign responsible sales officer if chosen
      if (formData.salesOfficerId && createdDealer?.id) {
        await ApiClient.post(`/api/v1/dealers/${createdDealer.id}/assign-officers`, {
          userIds: [formData.salesOfficerId],
          territoryId: formData.territoryId || undefined,
        }).catch(() => null);
      }

      showToast({
        title: 'Dealer Registered Successfully',
        message: `Assigned Code: ${createdDealer?.code || 'Generated'} for ${createdDealer?.name || formData.name}`,
        type: 'success',
      });

      setIsCreateModalOpen(false);
      setFormData({
        name: '',
        businessName: '',
        contactPerson: '',
        phone: '',
        email: '',
        city: '',
        address: '',
        creditLimit: 0,
        territoryId: '',
        salesOfficerId: '',
        notes: '',
      });
      loadData();
    } catch (err: any) {
      showToast({ title: 'Registration Failed', message: err.message || 'Failed to create dealer', type: 'error' });
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Handle Edit Dealer Open
  const handleOpenEdit = (dealer: DealerRecord) => {
    setDealerToEdit(dealer);
    setEditFormData({
      name: dealer.name,
      businessName: dealer.businessName || '',
      contactPerson: dealer.contactPerson || '',
      phone: dealer.phone || '',
      email: dealer.email || '',
      city: dealer.city || '',
      address: dealer.address || '',
      creditLimit: Number(dealer.creditLimit || 0),
      territoryId: dealer.territoryId || '',
      salesOfficerId: dealer.assignedFieldOfficerId || '',
      status: dealer.status || 'ACTIVE',
      notes: dealer.notes || '',
    });
    setIsEditModalOpen(true);
  };

  // Handle Save Edit Dealer
  const handleSaveEdit = async () => {
    if (!dealerToEdit) return;
    try {
      await ApiClient.patch(`/api/v1/dealers/${dealerToEdit.id}`, {
        name: editFormData.name.trim(),
        businessName: editFormData.businessName.trim() || null,
        contactPerson: editFormData.contactPerson.trim() || null,
        phone: editFormData.phone.trim(),
        email: editFormData.email.trim() || null,
        city: editFormData.city.trim() || null,
        address: editFormData.address.trim() || null,
        creditLimit: Number(editFormData.creditLimit) || 0,
        territoryId: editFormData.territoryId || null,
        salesOfficerId: editFormData.salesOfficerId || null,
        status: editFormData.status,
        notes: editFormData.notes.trim() || null,
      });

      showToast({
        title: 'Dealer Updated',
        message: `Changes saved for ${dealerToEdit.name} (${dealerToEdit.code})`,
        type: 'success',
      });
      setIsEditModalOpen(false);
      setDealerToEdit(null);
      loadData();
    } catch (err: any) {
      showToast({ title: 'Update Failed', message: err.message || 'Failed to update dealer', type: 'error' });
    }
  };

  // Handle Status Toggle (Quick Deactivate / Activate)
  const handleToggleStatus = async (dealer: DealerRecord) => {
    const nextStatus = dealer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await ApiClient.patch(`/api/v1/dealers/${dealer.id}`, { status: nextStatus });
      showToast({
        title: 'Status Updated',
        message: `Dealer marked as ${nextStatus}`,
        type: 'success',
      });
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Failed to update status', type: 'error' });
    }
  };

  // Safe Delete: Open Modal
  const handleOpenDelete = (dealer: DealerRecord) => {
    setDealerToDelete(dealer);
    setDeleteErrorMessage(null);
    setIsDeleteModalOpen(true);
  };

  // Safe Delete: Perform Delete
  const handleConfirmDelete = async () => {
    if (!dealerToDelete) return;
    setIsDeleting(true);
    setDeleteErrorMessage(null);
    try {
      await ApiClient.delete(`/api/v1/dealers/${dealerToDelete.id}?force=true`);
      showToast({
        title: 'Dealer Deleted',
        message: `Dealer ${dealerToDelete.name} (${dealerToDelete.code}) and all related records were permanently deleted`,
        type: 'success',
      });
      setIsDeleteModalOpen(false);
      setDealerToDelete(null);
      loadData();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Cannot delete dealer with historical transactions';
      setDeleteErrorMessage(errMsg);
      showToast({
        title: 'Deletion Failed',
        message: errMsg,
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePurgeAllDealers = async () => {
    if (!window.confirm('CRITICAL ACTION: Are you sure you want to permanently delete ALL dealers and ALL their related records (orders, invoices, returns, payments, ledgers)? This cannot be undone!')) {
      return;
    }
    try {
      const res: any = await ApiClient.delete('/api/v1/dealers/purge/all');
      showToast({
        title: 'All Dealers Purged',
        message: res?.message || 'All dealers and related operational records have been permanently cleared.',
        type: 'success',
      });
      loadData();
    } catch (err: any) {
      showToast({
        title: 'Purge Failed',
        message: err?.response?.data?.message || err?.message || 'Failed to purge dealers',
        type: 'error',
      });
    }
  };

  // Ledger Statement Modal
  const handleOpenLedger = (dealer: DealerRecord) => {
    setSelectedDealerForLedger(dealer);
  };

  // Direct Ledger PDF Download
  const handleDirectPdf = async (e: React.MouseEvent, dealer: DealerRecord) => {
    e.stopPropagation();
    try {
      const res = await ApiClient.get<any>(`/api/v1/dealers/${dealer.id}/ledger?limit=200`);
      const data = res.data?.data || res.data || {};
      const entries = Array.isArray(data.entries) ? data.entries : [];
      exportDealerLedgerToPdf({
        dealer: {
          name: dealer.name,
          code: dealer.code,
          phone: dealer.phone,
          city: dealer.city,
          address: dealer.address,
          creditLimit: dealer.creditLimit,
          currentBalance: Number(data.currentBalance ?? dealer.currentBalance ?? 0),
        },
        entries,
      });
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to generate PDF statement', type: 'error' });
    }
  };

  // Assignment History Modal
  const handleOpenHistory = async (dealer: DealerRecord) => {
    setSelectedDealerForHistory(dealer);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await ApiClient.get<any>(`/api/v1/dealers/${dealer.id}/history`);
      setHistoryRecords(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load assignment history', type: 'error' });
      setHistoryRecords([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Reassignment Modal
  const handleOpenReassign = (dealer: DealerRecord) => {
    setDealerToReassign(dealer);
    setReassignForm({
      territoryId: dealer.territoryId || '',
      salesOfficerId: dealer.assignedFieldOfficerId || '',
      effectiveFrom: new Date().toISOString().split('T')[0],
    });
    setIsReassignModalOpen(true);
  };

  const handleSaveReassignment = async () => {
    if (!dealerToReassign) return;
    try {
      if (reassignForm.salesOfficerId) {
        await ApiClient.post(`/api/v1/dealers/${dealerToReassign.id}/assign-officers`, {
          userIds: [reassignForm.salesOfficerId],
          territoryId: reassignForm.territoryId || undefined,
        });
      }
      showToast({ title: 'Reassigned', message: 'Dealer market assignment updated successfully', type: 'success' });
      setIsReassignModalOpen(false);
      setDealerToReassign(null);
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to reassign dealer', type: 'error' });
    }
  };

  // Filter Dealers
  const filteredDealers = dealers.filter((d) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q) ||
      (d.businessName && d.businessName.toLowerCase().includes(q)) ||
      (d.phone && d.phone.includes(searchQuery)) ||
      (d.city && d.city.toLowerCase().includes(q)) ||
      (d.territory?.name && d.territory.name.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPIs
  const totalDealers = dealers.length;
  const activeDealers = dealers.filter((d) => d.status === 'ACTIVE').length;
  const totalReceivables = dealers.reduce((sum, d) => sum + Number(d.currentBalance || 0), 0);
  const totalCreditLimit = dealers.reduce((sum, d) => sum + Number(d.creditLimit || 0), 0);

  // Territory combobox options
  const territoryOptions: SearchableComboboxOption[] = territories.map((t) => ({
    value: t.id,
    code: t.code,
    label: t.name,
    sublabel: t.zone?.name ? `${t.zone.name} → ${t.zone.region?.name || ''}` : undefined,
  }));

  // Sales Officer combobox options
  const salesOfficerOptions: SearchableComboboxOption[] = [
    { value: '', label: 'Unassigned / Direct Scope' },
    ...salesOfficers.map((u) => ({
      value: u.id,
      label: `${u.firstName} ${u.lastName}`,
      sublabel: u.email || u.phone || 'Field Officer',
    })),
  ];

  // Data Table Columns
  const columns: ColumnDef<DealerRecord>[] = [
    {
      key: 'code',
      header: 'Dealer Code',
      width: '110px',
      align: 'left',
      render: (d) => (
        <span
          style={{
            fontWeight: 700,
            color: 'var(--color-primary, #1e40af)',
            fontFamily: 'monospace',
            fontSize: '13px',
          }}
        >
          {d.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Dealer & Business Name',
      align: 'left',
      render: (d) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>{d.name}</div>
          {d.businessName && (
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginTop: '1px' }}>
              {d.businessName}
            </div>
          )}
          {d.city && (
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
              📍 {d.city}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'market',
      header: 'Market Hierarchy',
      width: '190px',
      align: 'left',
      render: (d) => {
        const terr = d.territory;
        return (
          <div style={{ fontSize: '12px', maxWidth: '190px' }}>
            <div style={{ fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {terr?.name || 'Unassigned Territory'}
            </div>
            <div style={{ color: '#64748b', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
              {terr?.zone?.name ? `${terr.zone.name} → ${terr.zone.region?.name || ''}` : 'Direct ERP Scope'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'officer',
      header: 'Sales Officer',
      width: '160px',
      align: 'left',
      render: (d) => {
        const officer = d.assignedOfficer;
        return (
          <div style={{ fontSize: '12px' }}>
            <strong style={{ color: '#2563eb' }}>
              {officer ? `${officer.firstName} ${officer.lastName}` : 'Unassigned'}
            </strong>
            {officer?.phone && (
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>{officer.phone}</div>
            )}
          </div>
        );
      },
    },
    {
      key: 'creditLimit',
      header: 'Credit Limit',
      width: '125px',
      align: 'right',
      render: (d) => (
        <span style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
          PKR {Number(d.creditLimit || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'currentBalance',
      header: 'Used Credit',
      width: '135px',
      align: 'right',
      render: (d) => {
        const bal = Number(d.currentBalance || 0);
        const limit = Number(d.creditLimit || 0);
        const isOverLimit = limit > 0 && bal > limit;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: '13px',
                color: isOverLimit ? '#dc2626' : bal > 0 ? '#ea580c' : '#16a34a',
              }}
            >
              PKR {bal.toLocaleString()}
            </span>
            {isOverLimit && (
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#dc2626',
                  backgroundColor: '#fee2e2',
                  padding: '1px 5px',
                  borderRadius: '4px',
                }}
              >
                LOCKED
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'availableCredit',
      header: 'Available',
      width: '120px',
      align: 'right',
      render: (d) => {
        const limit = Number(d.creditLimit || 0);
        const bal = Number(d.currentBalance || 0);
        const available = Math.max(0, limit - bal);
        return (
          <span style={{ fontWeight: 600, fontSize: '13px', color: available > 0 ? '#16a34a' : '#94a3b8' }}>
            PKR {available.toLocaleString()}
          </span>
        );
      },
    },
    {
      key: 'creditUtilization',
      header: 'Utilization',
      width: '120px',
      align: 'center',
      render: (d) => {
        const limit = Number(d.creditLimit || 0);
        const bal = Number(d.currentBalance || 0);
        const pct = limit > 0 ? Math.min(200, Math.round((bal / limit) * 100)) : 0;
        const color = pct >= 100 ? '#dc2626' : pct >= 85 ? '#ea580c' : '#16a34a';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}>
            <div
              style={{
                width: '55px',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: '#e2e8f0',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, pct)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color, width: '32px', textAlign: 'right' }}>
              {pct}%
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '90px',
      align: 'center',
      render: (d) => (
        <StatusBadge
          status={d.status}
          variant={d.status === 'ACTIVE' ? 'success' : d.status === 'SUSPENDED' ? 'warning' : 'neutral'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '135px',
      align: 'right',
      render: (d) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenLedger(d);
            }}
            title="View Real-Time Running Financial Ledger"
            style={{
              height: '30px',
              padding: '0 10px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <IconFileText size={13} /> Ledger
          </Button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (menuAnchor?.id === d.id) {
                setMenuAnchor(null);
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const showAbove = spaceBelow < 260;
              setMenuAnchor({
                id: d.id,
                dealer: d,
                ...(showAbove
                  ? { bottom: window.innerHeight - rect.top + 6 }
                  : { top: rect.bottom + 6 }),
                right: Math.max(16, window.innerWidth - rect.right),
              });
            }}
            title="More Actions"
            aria-label="More Actions"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              border: '1px solid var(--border-default, #cbd5e1)',
              backgroundColor: menuAnchor?.id === d.id ? '#f1f5f9' : '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            <IconMoreVertical size={16} />
          </button>
        </div>
      ),
    },
  ];

  const renderActionPortal = () => {
    if (!isMounted || !menuAnchor) return null;
    const d = menuAnchor.dealer;

    return createPortal(
      <div
        data-dealer-actions-portal
        style={{
          position: 'fixed',
          right: `${menuAnchor.right}px`,
          ...(menuAnchor.top !== undefined ? { top: `${menuAnchor.top}px` } : {}),
          ...(menuAnchor.bottom !== undefined ? { bottom: `${menuAnchor.bottom}px` } : {}),
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          padding: '6px',
          minWidth: '220px',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        <div style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', marginBottom: '2px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Actions: {d.code}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.name}
          </div>
        </div>

        <ActionMenuItem
          icon={<IconDownload size={14} style={{ color: '#2563eb' }} />}
          label="Download Statement PDF"
          onClick={(e) => {
            handleDirectPdf(e, d);
            setMenuAnchor(null);
          }}
        />

        <ActionMenuItem
          icon={<IconEdit size={14} style={{ color: '#475569' }} />}
          label="Edit Dealer Profile"
          onClick={() => {
            handleOpenEdit(d);
            setMenuAnchor(null);
          }}
        />

        <ActionMenuItem
          icon={<IconRefresh size={14} style={{ color: '#059669' }} />}
          label="Reassign Officer / Territory"
          onClick={() => {
            handleOpenReassign(d);
            setMenuAnchor(null);
          }}
        />

        <ActionMenuItem
          icon={<IconClock size={14} style={{ color: '#6366f1' }} />}
          label="Assignment History"
          onClick={() => {
            handleOpenHistory(d);
            setMenuAnchor(null);
          }}
        />

        <ActionMenuItem
          icon={<IconCheck size={14} style={{ color: d.status === 'ACTIVE' ? '#ea580c' : '#16a34a' }} />}
          label={d.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
          onClick={() => {
            handleToggleStatus(d);
            setMenuAnchor(null);
          }}
        />

        <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />

        <ActionMenuItem
          danger
          icon={<IconTrash size={14} style={{ color: '#dc2626' }} />}
          label="Delete Dealer"
          onClick={() => {
            handleOpenDelete(d);
            setMenuAnchor(null);
          }}
        />
      </div>,
      document.body
    );
  };

  return (
    <ListPageTemplate
      title="Dealers, Market Hierarchy & Running Ledger"
      subtitle="Authoritative dealer customer database, 4-tier market binding, ownership history, and financial statements."
      actions={
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            onClick={() => exportDealersListPdf({ dealers: filteredDealers })}
          >
            <IconDownload size={14} /> Export Directory PDF
          </Button>
          <Button variant="outline" icon={<IconRefresh size={16} />} onClick={loadData}>
            Refresh
          </Button>
          <Button
            variant="outline"
            style={{ color: '#ef4444', borderColor: '#fca5a5' }}
            icon={<IconTrash size={15} />}
            onClick={handlePurgeAllDealers}
          >
            Purge All Dealers
          </Button>
          <Button
            variant="primary"
            icon={<IconPlus size={16} />}
            onClick={() => {
              setIsCreateModalOpen(true);
              setTimeout(() => {
                inputRefs.name.current?.focus();
              }, 100);
            }}
          >
            Register New Dealer
          </Button>
        </div>
      }
    >
      {/* Dealer KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <KpiCard
          title="Total Registered Dealers"
          value={totalDealers}
          subtitle={`${activeDealers} active trading dealers`}
          badge="Network"
          accentColor="#3b82f6"
        />
        <KpiCard
          title="Total Receivables (Running Balances)"
          value={`PKR ${Math.round(totalReceivables / 1000).toLocaleString()}k`}
          subtitle="Real-time debit from Sales Invoices"
          badge="Live Ledger"
          accentColor="#059669"
        />
        <KpiCard
          title="Allocated Credit Limits"
          value={`PKR ${Math.round(totalCreditLimit / 1000).toLocaleString()}k`}
          subtitle="Max exposure threshold"
          badge="Credit Risk"
          accentColor="#d97706"
        />
        <KpiCard
          title="Active Field Officers"
          value={salesOfficers.length}
          subtitle="Managing market coverage"
          badge="Coverage"
          accentColor="#8b5cf6"
        />
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <Input
          placeholder="Search by code, dealer name, phone, city, territory..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '340px' }}
          startIcon={<IconSearch size={16} />}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { label: 'All Statuses', value: 'ALL' },
            { label: 'Active Only', value: 'ACTIVE' },
            { label: 'Inactive Only', value: 'INACTIVE' },
            { label: 'Suspended Only', value: 'SUSPENDED' },
          ]}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={9} />
      ) : (
        <>
          <DataTable data={filteredDealers} columns={columns} />
          {renderActionPortal()}
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* REGISTER NEW DEALER MODAL (KEYBOARD-FIRST & RESPONSIVE) */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New Enterprise Dealer"
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              💡 Press <strong>Enter</strong> to move between fields, or click Register Dealer.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                ref={inputRefs.submitBtn as any}
                variant="primary"
                onClick={handleCreateDealer}
                isLoading={isSubmittingCreate}
              >
                Register Dealer
              </Button>
            </div>
          </div>
        }
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* Automatic Dealer Code Banner */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#eff6ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <IconLock size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
            <div style={{ fontSize: '12px', color: '#1e40af' }}>
              <strong>Dealer Code is Automatic:</strong> The system will assign the next sequential code{' '}
              <code style={{ backgroundColor: '#dbeafe', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                DLR-XXXXXX
              </code>{' '}
              atomically upon registration.
            </div>
          </div>

          {/* Form Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '16px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Input
                ref={inputRefs.name}
                label="Dealer / Owner Name *"
                placeholder="e.g. Haji Muhammad Aslam"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onKeyDown={handleFieldEnter(inputRefs.businessName)}
                required
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Input
                ref={inputRefs.businessName}
                label="Business / Shop Name"
                placeholder="e.g. Aslam Traders & Agri Services"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                onKeyDown={handleFieldEnter(inputRefs.phone)}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Input
                ref={inputRefs.phone}
                label="Phone Number *"
                placeholder="e.g. 0300-1234567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                onKeyDown={handleFieldEnter(inputRefs.email)}
                required
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Input
                ref={inputRefs.email}
                label="Email Address"
                type="email"
                placeholder="dealer@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                onKeyDown={handleFieldEnter(inputRefs.city)}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Input
                ref={inputRefs.city}
                label="City / District"
                placeholder="e.g. Faisalabad"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                onKeyDown={handleFieldEnter(inputRefs.territoryCombobox)}
              />
            </div>

            {/* FIXED-WIDTH SEARCHABLE TERRITORY SELECTOR (ELLIPSIS + TOOLTIP) */}
            <div style={{ minWidth: 0 }}>
              <SearchableCombobox
                inputRef={inputRefs.territoryCombobox}
                label="Sales Territory (4-Tier Market)"
                placeholder="Select or search territory..."
                searchPlaceholder="Search territory name or code..."
                value={formData.territoryId}
                onChange={(val) => setFormData({ ...formData, territoryId: val })}
                options={territoryOptions}
                onEnterPressNext={() => inputRefs.salesOfficer.current?.focus()}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <SearchableCombobox
                inputRef={inputRefs.salesOfficer}
                label="Responsible Sales Officer / FO"
                placeholder="Select or search sales officer..."
                searchPlaceholder="Search officer name or email..."
                value={formData.salesOfficerId}
                onChange={(val) => setFormData({ ...formData, salesOfficerId: val })}
                options={salesOfficerOptions}
                onEnterPressNext={() => inputRefs.creditLimit.current?.focus()}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Input
                ref={inputRefs.creditLimit}
                label="Initial Credit Limit (PKR)"
                type="number"
                min="0"
                placeholder="e.g. 500000"
                value={formData.creditLimit}
                onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                onKeyDown={handleFieldEnter(inputRefs.address)}
              />
            </div>

            <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
              <Textarea
                ref={inputRefs.address}
                label="Shop / Warehouse Physical Address"
                placeholder="Physical street address, market shop number, tehsil..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </div>

            <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
              <Input
                label="Registration Notes"
                placeholder="Agreement terms, guarantee details, or credit remarks"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                onKeyDown={handleFieldEnter(inputRefs.submitBtn)}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* EDIT DEALER MODAL */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Dealer Profile — ${dealerToEdit?.code}`}
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '16px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Input
                label="Dealer / Owner Name *"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Input
                label="Business / Shop Name"
                value={editFormData.businessName}
                onChange={(e) => setEditFormData({ ...editFormData, businessName: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Input
                label="Phone Number *"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                required
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Input
                label="Email Address"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Input
                label="City / District"
                value={editFormData.city}
                onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <SearchableCombobox
                label="Sales Territory (4-Tier Market)"
                placeholder="Select territory..."
                value={editFormData.territoryId}
                onChange={(val) => setEditFormData({ ...editFormData, territoryId: val })}
                options={territoryOptions}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Select
                label="Responsible Sales Officer"
                value={editFormData.salesOfficerId}
                onChange={(e) => setEditFormData({ ...editFormData, salesOfficerId: e.target.value })}
                options={[
                  { label: 'Unassigned / Direct Scope', value: '' },
                  ...salesOfficers.map((u) => ({
                    label: `${u.firstName} ${u.lastName} (${u.email || u.phone})`,
                    value: u.id,
                  })),
                ]}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Input
                label="Authoritative Credit Limit (PKR)"
                type="number"
                min="0"
                value={editFormData.creditLimit}
                onChange={(e) => setEditFormData({ ...editFormData, creditLimit: Number(e.target.value) })}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Select
                label="Account Status"
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                options={[
                  { label: 'ACTIVE (Normal Trading)', value: 'ACTIVE' },
                  { label: 'INACTIVE (Trading Blocked)', value: 'INACTIVE' },
                  { label: 'SUSPENDED (Under Audit / Hold)', value: 'SUSPENDED' },
                ]}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <Input
                label="Contact Person Name"
                placeholder="Alternate contact / manager"
                value={editFormData.contactPerson}
                onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
              <Textarea
                label="Shop / Warehouse Physical Address"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* SAFE DELETE CONFIRMATION MODAL */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteErrorMessage(null);
        }}
        title="Safe Delete Dealer Check"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button
              variant="ghost"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteErrorMessage(null);
              }}
            >
              Cancel
            </Button>
            {deleteErrorMessage ? (
              <Button
                variant="primary"
                onClick={() => {
                  if (dealerToDelete) {
                    handleToggleStatus(dealerToDelete);
                    setIsDeleteModalOpen(false);
                    setDeleteErrorMessage(null);
                  }
                }}
              >
                Deactivate Dealer Instead
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                isLoading={isDeleting}
              >
                Permanently Delete Dealer
              </Button>
            )}
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: deleteErrorMessage ? '#fef2f2' : '#fff7ed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconAlertTriangle size={22} style={{ color: deleteErrorMessage ? '#dc2626' : '#ea580c' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                {dealerToDelete?.name} ({dealerToDelete?.code})
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                City: {dealerToDelete?.city || 'N/A'} • Territory: {dealerToDelete?.territory?.name || 'Unassigned'}
              </div>
            </div>
          </div>

          {deleteErrorMessage ? (
            <div
              style={{
                padding: '14px',
                backgroundColor: '#fef2f2',
                borderRadius: '8px',
                border: '1px solid #fecaca',
                fontSize: '13px',
                color: '#991b1b',
                lineHeight: 1.5,
              }}
            >
              <strong>Cannot Delete Dealer (Audit Protected):</strong>
              <p style={{ margin: '6px 0 0 0' }}>{deleteErrorMessage}</p>
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#7f1d1d' }}>
                Deactivating the dealer preserves all past sales orders, tax invoices, and accounting ledger lines for financial compliance.
              </p>
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>
                Are you sure you want to delete this dealer? The system will verify if any past sales orders, invoices, payments, or ledger transactions exist.
              </p>
              <div
                style={{
                  marginTop: '10px',
                  padding: '10px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                }}
              >
                🛡️ <strong>Integrity Rule:</strong> If the dealer has any active financial records, deletion will be blocked and you will be prompted to deactivate the account instead.
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* ASSIGNMENT HISTORY MODAL */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Assignment History — ${selectedDealerForHistory?.name} (${selectedDealerForHistory?.code})`}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <IconDownload size={14} /> Print History
            </Button>
            <Button variant="ghost" onClick={() => setIsHistoryModalOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Authoritative historical record of territory and sales officer assignments for sales attribution traceability.
          </p>

          {loadingHistory ? (
            <TableSkeleton rows={4} columns={4} />
          ) : historyRecords.length === 0 ? (
            <EmptyState title="No Past Reassignments" description="This dealer retains its initial original market assignment." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {historyRecords.map((h, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#1e40af' }}>
                      {h.salesOfficer ? `${h.salesOfficer.firstName} ${h.salesOfficer.lastName}` : 'Unassigned Officer'}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {new Date(h.effectiveFrom).toLocaleDateString()} {h.effectiveTo ? `→ ${new Date(h.effectiveTo).toLocaleDateString()}` : '→ Present'}
                    </span>
                  </div>
                  <div style={{ color: '#475569', marginTop: '4px', fontSize: '12px' }}>
                    Territory: <strong>{h.territory?.name || 'Unassigned'}</strong>
                    {h.territory?.zone?.name && <span> ({h.territory.zone.name} → {h.territory.zone.region?.name})</span>}
                  </div>
                  {h.assignedBy && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      Assigned by: {h.assignedBy.firstName} {h.assignedBy.lastName}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* REASSIGN MODAL */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isReassignModalOpen}
        onClose={() => setIsReassignModalOpen(false)}
        title={`Reassign Dealer — ${dealerToReassign?.name}`}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setIsReassignModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveReassignment}>Confirm Reassignment</Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Reassigning this dealer will update active ownership from the effective date forward.
            Historical posted invoices will remain permanently attributed to past officers.
          </p>

          <SearchableCombobox
            label="New Territory (Optional)"
            placeholder="Select new territory..."
            value={reassignForm.territoryId}
            onChange={(val) => setReassignForm({ ...reassignForm, territoryId: val })}
            options={territoryOptions}
          />

          <Select
            label="New Responsible Sales Officer *"
            value={reassignForm.salesOfficerId}
            onChange={(e) => setReassignForm({ ...reassignForm, salesOfficerId: e.target.value })}
            options={[
              { label: 'Select Officer...', value: '' },
              ...salesOfficers.map((u) => ({ label: `${u.firstName} ${u.lastName} (${u.email})`, value: u.id })),
            ]}
          />

          <Input
            label="Effective From Date *"
            type="date"
            value={reassignForm.effectiveFrom}
            onChange={(e) => setReassignForm({ ...reassignForm, effectiveFrom: e.target.value })}
          />
        </div>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* PROFESSIONAL DEALER LEDGER MODAL */}
      {/* ------------------------------------------------------------- */}
      <DealerLedgerModal
        isOpen={!!selectedDealerForLedger}
        onClose={() => {
          setSelectedDealerForLedger(null);
          loadData();
        }}
        dealer={selectedDealerForLedger}
      />
    </ListPageTemplate>
  );
};
