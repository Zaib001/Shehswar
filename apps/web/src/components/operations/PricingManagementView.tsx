'use client';

/**
 * SHEHSWAR ONE360 - Dynamic Scheme Master & Scheme-Based Rate Lists Management UI
 *
 * Implements:
 * 1. Scheme Master: Predefined types (CA, ABC, SR, NNR) + Dynamic Scheme Types without code changes
 * 2. Scheme Name & Short Code (e.g. MCCM - Mega Carnival Open Mela, SR - Season 2026, ABC - Jan Booking)
 * 3. Select Scheme -> Automatically Load sellable Finished Products (No Raw/Packing materials)
 * 4. Scheme-Wise Rates: Supports Discount-based pricing, Direct Rate, and Net Net direct rate (NNR)
 * 5. Scheme-Specific Commercial Logic: CA (Cash Discount), ABC (Cash + Booking Benefit), SR (Seasonal), NNR (Direct Net)
 * 6. Historical Rate List Versioning & Duplicate Active Rate Protection
 * 7. Requirement 21: Auto-generate / Add Newly Created Finished Products to Existing Rate List
 * 8. Authoritative Rate List PDF Generation (Company Header, Scheme Code, Validity, Finished Goods Table)
 * 9. Pricing Authority Limits & Governance Configuration
 * 10. Live Price Resolution Simulator connected to Backend Database
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Button,
  Input,
  Select,
  Textarea,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatusBadge,
  KpiCard,
  Modal,
  TableSkeleton,
  EmptyState,
} from '../ui';
import {
  IconPlus,
  IconCheck,
  IconEye,
  IconEdit,
  IconRefresh,
  IconShield,
  IconLayers,
  IconTag,
  IconPercent,
  IconClock,
  IconPrinter,
  IconTrash,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';
import { exportRateListToPdf } from '../../lib/pdf-export';
import { AddFinishedProductModal } from '../master-data/AddFinishedProductModal';
import { AddBatchModal } from './AddBatchModal';

export type PricingTab =
  | 'rate-lists'
  | 'schemes'
  | 'active-matrix'
  | 'authority'
  | 'simulator';

/**
 * Helper: dynamically resolve product formulation category/type from real DB attributes
 */
export const resolveProductCategory = (p: any): string => {
  if (!p) return 'General Formulation';
  // 1. Direct formulation classification mType string if present
  if (typeof p.mType === 'string' && p.mType.trim()) return p.mType.trim();
  // 2. Direct category string if present and not generic 'Finished Goods'
  if (typeof p.category === 'string' && p.category.trim() && p.category.trim().toLowerCase() !== 'finished goods') {
    return p.category.trim();
  }
  // 3. Category object with name
  if (p.category && typeof p.category === 'object' && p.category.name && p.category.name.trim().toLowerCase() !== 'finished goods') {
    return p.category.name.trim();
  }
  // 4. Product type / fertilizer type / formulation
  if (typeof p.productType === 'string' && p.productType.trim()) return p.productType.trim();
  if (typeof p.fertilizerType === 'string' && p.fertilizerType.trim()) return p.fertilizerType.trim();
  if (typeof p.productForm === 'string' && p.productForm.trim()) return p.productForm.trim();
  // 5. Fallback string if category was 'Finished Goods' or empty
  if (typeof p.category === 'string' && p.category.trim()) return p.category.trim();
  return 'General Formulation';
};

/**
 * Safely format Pack Size and Packaging Material preventing [object Object] rendering
 */
export const resolvePackSizeDisplay = (product: any, item?: any): string => {
  const p = product || {};
  const it = item || {};

  const packSizeStr =
    p.packSize?.name
      ? p.packSize.name
      : typeof p.packSize === 'string' && p.packSize.trim() && p.packSize !== '[object Object]'
      ? p.packSize.trim()
      : it.packSize?.name
      ? it.packSize.name
      : typeof it.packSize === 'string' && it.packSize.trim() && it.packSize !== '[object Object]'
      ? it.packSize.trim()
      : p.packingQuantity
      ? `${p.packingQuantity} ${p.packingUnit || ''}`.trim()
      : it.packingQuantity
      ? `${it.packingQuantity} ${it.packingUnit || ''}`.trim()
      : '';

  const packagingStr =
    p.packagingMaterial?.materialName
      ? p.packagingMaterial.materialName
      : typeof p.packagingMaterial === 'string' && p.packagingMaterial.trim() && p.packagingMaterial !== '[object Object]'
      ? p.packagingMaterial.trim()
      : it.packagingMaterial?.materialName
      ? it.packagingMaterial.materialName
      : typeof it.packagingMaterial === 'string' && it.packagingMaterial.trim() && it.packagingMaterial !== '[object Object]'
      ? it.packagingMaterial.trim()
      : '';

  if (packSizeStr && packagingStr && !packSizeStr.toLowerCase().includes(packagingStr.toLowerCase())) {
    return `${packSizeStr} (${packagingStr})`;
  }
  if (packSizeStr) return packSizeStr;
  if (packagingStr) return packagingStr;

  const fallbackUnit = it.unit || p.unit || p.packingUnit || p.salesUom?.code || '';
  if (typeof fallbackUnit === 'string' && fallbackUnit.trim() && fallbackUnit !== '[object Object]') {
    return fallbackUnit.trim();
  }

  return '-';
};

/**
 * Helper: formulation-specific dynamic badge styling
 */
export const getCategoryBadgeStyle = (category: string): React.CSSProperties => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('insect')) {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      backgroundColor: '#ecfdf5',
      color: '#065f46',
      border: '1px solid #a7f3d0',
      lineHeight: '1.2',
    };
  }
  if (cat.includes('herb')) {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      backgroundColor: '#fffbeb',
      color: '#92400e',
      border: '1px solid #fde68a',
      lineHeight: '1.2',
    };
  }
  if (cat.includes('fung')) {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      backgroundColor: '#eff6ff',
      color: '#1e40af',
      border: '1px solid #bfdbfe',
      lineHeight: '1.2',
    };
  }
  if (cat.includes('weed')) {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      backgroundColor: '#fff7ed',
      color: '#c2410c',
      border: '1px solid #ffedd5',
      lineHeight: '1.2',
    };
  }
  if (cat.includes('fertil')) {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      backgroundColor: '#f5f3ff',
      color: '#5b21b6',
      border: '1px solid #ddd6fe',
      lineHeight: '1.2',
    };
  }
  if (cat.includes('seed')) {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      backgroundColor: '#f0fdf4',
      color: '#15803d',
      border: '1px solid #bbf7d0',
      lineHeight: '1.2',
    };
  }
  if (cat.includes('growth') || cat.includes('pgr') || cat.includes('nutri') || cat.includes('bio')) {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      backgroundColor: '#ecfeff',
      color: '#155e75',
      border: '1px solid #a5f3fc',
      lineHeight: '1.2',
    };
  }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    lineHeight: '1.2',
  };
};

export const PricingManagementView: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<PricingTab>('rate-lists');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Data states
  const [rateLists, setRateLists] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [schemeTypes, setSchemeTypes] = useState<any[]>([]);
  const [authorityLimits, setAuthorityLimits] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<any[]>([]);

  // Filter & Search states
  const [rateListSearch, setRateListSearch] = useState('');
  const [rateListSchemeFilter, setRateListSchemeFilter] = useState('ALL');
  const [schemeSearch, setSchemeSearch] = useState('');
  const [schemeTypeFilter, setSchemeTypeFilter] = useState('ALL');

  // ==========================================================
  // SCHEME MASTER STATE (Requirements 1 - 5, 12, 14)
  // ==========================================================
  const [isSchemeModalOpen, setIsSchemeModalOpen] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<any | null>(null);
  const [schemeForm, setSchemeForm] = useState({
    schemeTypeId: '',
    schemeTypeCode: 'SR',
    name: '',
    shortCode: '',
    code: '',
    description: '',
    collectionStartDate: new Date().toISOString().split('T')[0],
    collectionEndDate: '',
    invoiceStartDate: new Date().toISOString().split('T')[0],
    invoiceEndDate: '',
    status: 'ACTIVE',
    discountPct: '' as number | '',
    paymentType: 'CASH',
  });

  // Scheme Type Searchable Combobox State
  const [schemeTypeComboQuery, setSchemeTypeComboQuery] = useState('');
  const [schemeTypeComboOpen, setSchemeTypeComboOpen] = useState(false);
  const [schemeTypeComboHighlight, setSchemeTypeComboHighlight] = useState(0);
  const schemeTypeComboInputRef = useRef<HTMLInputElement>(null);
  const schemeTypeListRef = useRef<HTMLUListElement>(null);

  // Scheme Form field refs for keyboard-first navigation (Requirement 22)
  const schemeNameInputRef = useRef<HTMLInputElement>(null);
  const schemeShortCodeInputRef = useRef<HTMLInputElement>(null);
  const colStartInputRef = useRef<HTMLInputElement>(null);
  const colEndInputRef = useRef<HTMLInputElement>(null);
  const invStartInputRef = useRef<HTMLInputElement>(null);
  const invEndInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const saveSchemeBtnRef = useRef<HTMLButtonElement>(null);

  // Dynamic Scheme Type Modal State (Requirements 2, 3)
  const [isSchemeTypeModalOpen, setIsSchemeTypeModalOpen] = useState(false);
  const [schemeTypeForm, setSchemeTypeForm] = useState({
    code: '',
    name: '',
    defaultShortCode: '',
    description: '',
    status: 'ACTIVE',
  });

  // Dynamic Payment Type Modal State (Requirements 15, 16, 17)
  const [isPaymentTypeModalOpen, setIsPaymentTypeModalOpen] = useState(false);
  const [paymentTypeForm, setPaymentTypeForm] = useState({
    name: '',
    code: '',
    description: '',
    status: 'ACTIVE',
  });

  // ==========================================================
  // RATE LIST CREATION & EDIT STATE (Requirements 6 - 11, 13, 21)
  // ==========================================================
  const [isRateListModalOpen, setIsRateListModalOpen] = useState(false);
  const [selectedRateList, setSelectedRateList] = useState<any | null>(null);
  const [editingRateList, setEditingRateList] = useState<any | null>(null);
  const [isRateListDetailModalOpen, setIsRateListDetailModalOpen] = useState(false);
  const [isLoadingSchemeProducts, setIsLoadingSchemeProducts] = useState(false);
  const [rateListForm, setRateListForm] = useState({
    schemeId: '',
    schemeShortCode: '',
    schemeName: '',
    schemeTypeCode: '',
    code: '',
    name: '',
    description: '',
    category: 'SEASONAL',
    currency: 'PKR',
    isMobileVisible: true,
    isMobileSelectable: true,
    isInternalOnly: false,
    priority: 10,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
    notes: 'Initial Published Version',
  });
  const [rateListItems, setRateListItems] = useState<any[]>([]);
  const [rateListItemSearch, setRateListItemSearch] = useState('');
  const [bulkAdjustmentPct, setBulkAdjustmentPct] = useState<number | ''>('');
  const [productMatrixSearch, setProductMatrixSearch] = useState('');
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [editingProductInPricing, setEditingProductInPricing] = useState<any | null>(null);
  const [batchModalProduct, setBatchModalProduct] = useState<any | null>(null);

  // Searchable Scheme Combobox state
  const [schemeComboQuery, setSchemeComboQuery] = useState('');
  const [schemeComboOpen, setSchemeComboOpen] = useState(false);
  const [schemeComboHighlight, setSchemeComboHighlight] = useState(0);
  const schemeComboInputRef = useRef<HTMLInputElement>(null);
  const schemeComboListRef = useRef<HTMLUListElement>(null);

  // Scheme discount info for header card
  const [selectedSchemeInfo, setSelectedSchemeInfo] = useState<any>(null);

  // Form field refs for keyboard-first navigation
  const codeInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const effectiveFromInputRef = useRef<HTMLInputElement>(null);
  const effectiveToInputRef = useRef<HTMLInputElement>(null);
  const rateInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Rate List Version Modal State
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [versionTargetRateList, setVersionTargetRateList] = useState<any | null>(null);
  const [newVersionForm, setNewVersionForm] = useState({
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
    notes: '',
  });

  // Deletion Modals State
  const [rateListToDelete, setRateListToDelete] = useState<any | null>(null);
  const [isDeletingRateList, setIsDeletingRateList] = useState(false);
  const [schemeToDelete, setSchemeToDelete] = useState<any | null>(null);
  const [isDeletingScheme, setIsDeletingScheme] = useState(false);

  // Authority Limit Edit Modal State
  const [isAuthorityModalOpen, setIsAuthorityModalOpen] = useState(false);
  const [selectedAuthority, setSelectedAuthority] = useState<any | null>(null);
  const [authorityForm, setAuthorityForm] = useState({
    roleCode: '',
    maxDiscountPct: 5.0,
    canSetNetRate: false,
    canApplySpecialRate: false,
    canApproveOwnOverride: false,
    requiresApproval: true,
  });

  // Simulator State
  const [simDealerId, setSimDealerId] = useState('');
  const [simProductId, setSimProductId] = useState('');
  const [simQuantity, setSimQuantity] = useState<number>(10);
  const [simPaymentTerm, setSimPaymentTerm] = useState('CASH');
  const [simSchemeId, setSimSchemeId] = useState('');
  const [simRequestedRate, setSimRequestedRate] = useState<number | ''>('');
  const [simResult, setSimResult] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rateListsRes, schemesRes, schemeTypesRes, limitsRes, productsRes, dealersRes, paymentTypesRes] =
        await Promise.all([
          ApiClient.get<any>('/api/v1/pricing/rate-lists'),
          ApiClient.get<any>('/api/v1/pricing/schemes'),
          ApiClient.get<any>('/api/v1/pricing/scheme-types'),
          ApiClient.get<any>('/api/v1/pricing/authority-limits'),
          ApiClient.get<any>('/api/v1/pricing/active-products'),
          ApiClient.get<any>('/api/v1/dealers'),
          ApiClient.get<any>('/api/v1/pricing/payment-types'),
        ]);

      const rateListsData = rateListsRes.data?.data || rateListsRes.data || [];
      const schemesData = schemesRes.data?.data || schemesRes.data || [];
      const schemeTypesData = schemeTypesRes.data?.data || schemeTypesRes.data || [];
      const limitsData = limitsRes.data?.data || limitsRes.data || [];
      const productsData = productsRes.data?.data || productsRes.data || [];
      const dealersData = dealersRes.data?.data || dealersRes.data || [];
      const paymentTypesData = paymentTypesRes.data?.data || paymentTypesRes.data || [];

      setRateLists(Array.isArray(rateListsData) ? rateListsData : []);
      setSchemes(Array.isArray(schemesData) ? schemesData : []);
      setSchemeTypes(Array.isArray(schemeTypesData) ? schemeTypesData : []);
      setAuthorityLimits(Array.isArray(limitsData) ? limitsData : []);
      setAllProducts(Array.isArray(productsData) ? productsData : []);
      setDealers(Array.isArray(dealersData) ? dealersData : []);
      setPaymentTypes(Array.isArray(paymentTypesData) ? paymentTypesData : []);

      // Pre-select simulator defaults
      if (productsData.length > 0 && !simProductId) {
        setSimProductId(productsData[0].finishedProductId || productsData[0].id);
      }
      if (dealersData.length > 0 && !simDealerId) {
        setSimDealerId(dealersData[0].id);
      }
      if (schemesData.length > 0 && !simSchemeId) {
        setSimSchemeId(schemesData[0].id);
      }
    } catch (err: any) {
      showToast({
        title: 'Failed to load pricing data',
        message: err.message || 'Please check backend connectivity',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast, simProductId, simDealerId, simSchemeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==========================================
  // SCHEME MASTER ACTIONS (Requirements 1 - 5)
  // ==========================================

  const handleOpenCreateScheme = () => {
    setSelectedScheme(null);
    const defaultType = schemeTypes.find((t) => t.code === 'SR') || schemeTypes[0] || {
      id: '',
      code: 'SR',
      name: 'Seasonal Scheme',
      defaultShortCode: 'SR',
    };

    setSchemeForm({
      schemeTypeId: defaultType.id || '',
      schemeTypeCode: defaultType.code,
      name: defaultType.name || 'Seasonal Scheme',
      shortCode: defaultType.defaultShortCode || defaultType.code || '',
      code: '',
      description: '',
      collectionStartDate: new Date().toISOString().split('T')[0],
      collectionEndDate: '',
      invoiceStartDate: new Date().toISOString().split('T')[0],
      invoiceEndDate: '',
      status: 'ACTIVE',
      discountPct: '',
      paymentType: paymentTypes[0]?.code || 'CASH',
    });
    setSchemeTypeComboQuery(defaultType.id ? `${defaultType.name} (${defaultType.code})` : '');
    setSchemeTypeComboOpen(false);
    setIsSchemeModalOpen(true);
    setTimeout(() => schemeTypeComboInputRef.current?.focus(), 80);
  };

  const handleOpenEditScheme = (scheme: any) => {
    setSelectedScheme(scheme);
    const colStartStr = (scheme.collectionStartDate
      ? new Date(scheme.collectionStartDate).toISOString().split('T')[0]
      : scheme.startDate
      ? new Date(scheme.startDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]) || '';
    const colEndStr = (scheme.collectionEndDate
      ? new Date(scheme.collectionEndDate).toISOString().split('T')[0]
      : scheme.endDate
      ? new Date(scheme.endDate).toISOString().split('T')[0]
      : '') || '';
    const invStartStr = (scheme.invoiceStartDate
      ? new Date(scheme.invoiceStartDate).toISOString().split('T')[0]
      : scheme.effectiveFrom
      ? new Date(scheme.effectiveFrom).toISOString().split('T')[0]
      : colStartStr) || '';
    const invEndStr = (scheme.invoiceEndDate
      ? new Date(scheme.invoiceEndDate).toISOString().split('T')[0]
      : scheme.effectiveTo
      ? new Date(scheme.effectiveTo).toISOString().split('T')[0]
      : colEndStr) || '';

    const disc = scheme.discountPct !== null && scheme.discountPct !== undefined
      ? Number(scheme.discountPct)
      : scheme.defaultDiscountPct !== null && scheme.defaultDiscountPct !== undefined
      ? Number(scheme.defaultDiscountPct)
      : '';

    const stCode = scheme.schemeTypeCode || scheme.schemeTypeRef?.code || 'SR';
    const stName = scheme.schemeTypeRef?.name || scheme.schemeType || stCode;

    setSchemeForm({
      schemeTypeId: scheme.schemeTypeId || '',
      schemeTypeCode: stCode,
      name: scheme.name || '',
      shortCode: scheme.shortCode || '',
      code: scheme.code || '',
      description: scheme.description || '',
      collectionStartDate: colStartStr,
      collectionEndDate: colEndStr,
      invoiceStartDate: invStartStr,
      invoiceEndDate: invEndStr,
      status: scheme.status || 'ACTIVE',
      discountPct: disc,
      paymentType: scheme.paymentType || 'CASH',
    });
    setSchemeTypeComboQuery(`${stName} (${stCode})`);
    setSchemeTypeComboOpen(false);
    setIsSchemeModalOpen(true);
  };

  /**
   * Requirements 4, 5, 6: Selecting Scheme Type auto-populates Type Code, Scheme Name, and Default Short Code
   */
  const handleSelectSchemeType = (typeId: string) => {
    const st = schemeTypes.find((t) => t.id === typeId);
    if (st) {
      setSchemeTypeComboQuery(`${st.name} (${st.code})`);
      setSchemeForm((prev) => ({
        ...prev,
        schemeTypeId: st.id,
        schemeTypeCode: st.code,
        name: st.name,
        shortCode: st.defaultShortCode || st.code || '',
      }));
      setSchemeTypeComboOpen(false);
      setTimeout(() => schemeNameInputRef.current?.focus(), 60);
    }
  };

  const schemeTypeComboResults = useMemo(() => {
    const q = schemeTypeComboQuery.toLowerCase().trim();
    if (!q) return schemeTypes;
    return schemeTypes.filter(
      (t) =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.code || '').toLowerCase().includes(q) ||
        (t.defaultShortCode || '').toLowerCase().includes(q)
    );
  }, [schemeTypes, schemeTypeComboQuery]);

  const handleSchemeTypeComboKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!schemeTypeComboOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setSchemeTypeComboOpen(true);
      setSchemeTypeComboHighlight(0);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSchemeTypeComboHighlight((h) => Math.min(h + 1, schemeTypeComboResults.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSchemeTypeComboHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (schemeTypeComboOpen && schemeTypeComboResults[schemeTypeComboHighlight]) {
        handleSelectSchemeType(schemeTypeComboResults[schemeTypeComboHighlight].id);
      } else {
        schemeNameInputRef.current?.focus();
      }
      return;
    }
    if (e.key === 'Escape') {
      setSchemeTypeComboOpen(false);
      return;
    }
  };

  /**
   * Save Scheme (Requirements 1, 6, 8, 9, 10, 11, 13, 14, 15)
   */
  const handleSaveScheme = async () => {
    if (!schemeForm.name.trim()) {
      showToast({ title: 'Validation Error', message: 'Scheme Name is required.', type: 'error' });
      schemeNameInputRef.current?.focus();
      return;
    }
    if (!schemeForm.collectionStartDate) {
      showToast({ title: 'Validation Error', message: 'Collection Start Date is required.', type: 'error' });
      colStartInputRef.current?.focus();
      return;
    }
    if (!schemeForm.invoiceStartDate) {
      showToast({ title: 'Validation Error', message: 'Invoice Start Date is required.', type: 'error' });
      invStartInputRef.current?.focus();
      return;
    }

    if (schemeForm.collectionEndDate && new Date(schemeForm.collectionStartDate) > new Date(schemeForm.collectionEndDate)) {
      showToast({
        title: 'Validation Error',
        message: 'Collection Start Date must be earlier than or equal to Collection End Date.',
        type: 'error',
      });
      return;
    }

    if (schemeForm.invoiceEndDate && new Date(schemeForm.invoiceStartDate) > new Date(schemeForm.invoiceEndDate)) {
      showToast({
        title: 'Validation Error',
        message: 'Invoice Start Date must be earlier than or equal to Invoice End Date.',
        type: 'error',
      });
      return;
    }

    const discountNum = schemeForm.discountPct !== '' && !isNaN(Number(schemeForm.discountPct))
      ? Number(schemeForm.discountPct)
      : 0;

    const shortCodeVal = schemeForm.shortCode.trim() ? schemeForm.shortCode.trim().toUpperCase() : undefined;
    const generatedCode = shortCodeVal
      ? `${schemeForm.schemeTypeCode || 'SCH'}-${shortCodeVal}`
      : `SCH-${schemeForm.schemeTypeCode || 'SR'}-${Date.now().toString().slice(-6)}`;

    const payload = {
      name: schemeForm.name.trim(),
      code: schemeForm.code || generatedCode,
      shortCode: shortCodeVal,
      schemeTypeId: schemeForm.schemeTypeId || undefined,
      schemeTypeCode: schemeForm.schemeTypeCode || 'SR',
      description: schemeForm.description,
      collectionStartDate: schemeForm.collectionStartDate,
      collectionEndDate: schemeForm.collectionEndDate || undefined,
      invoiceStartDate: schemeForm.invoiceStartDate,
      invoiceEndDate: schemeForm.invoiceEndDate || undefined,
      startDate: schemeForm.collectionStartDate,
      endDate: schemeForm.collectionEndDate || schemeForm.invoiceEndDate || undefined,
      effectiveFrom: schemeForm.invoiceStartDate,
      effectiveTo: schemeForm.invoiceEndDate || undefined,
      discountPct: discountNum,
      defaultDiscountPct: discountNum,
      cashDiscountPct: discountNum,
      paymentType: schemeForm.paymentType || 'CASH',
      paymentTypes: [schemeForm.paymentType || 'CASH'],
      status: schemeForm.status || 'ACTIVE',
      isMobileVisible: true,
      isMobileSelectable: true,
    };

    try {
      if (selectedScheme?.id) {
        await ApiClient.put(`/api/v1/pricing/schemes/${selectedScheme.id}`, payload);
        showToast({
          title: 'Scheme Updated',
          message: `Scheme '${schemeForm.name}' updated successfully.`,
          type: 'success',
        });
      } else {
        await ApiClient.post('/api/v1/pricing/schemes', payload);
        showToast({
          title: 'Scheme Created',
          message: `Scheme '${schemeForm.name}' created successfully in database.`,
          type: 'success',
        });
      }

      setIsSchemeModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error Saving Scheme', message: err.message, type: 'error' });
    }
  };

  /**
   * Requirement 3: Add Scheme Type with immediate availability without page refresh
   */
  const handleSaveSchemeType = async () => {
    if (!schemeTypeForm.code.trim() || !schemeTypeForm.name.trim()) {
      showToast({ title: 'Validation Error', message: 'Type Code and Name are required.', type: 'error' });
      return;
    }

    try {
      const res = await ApiClient.post<any>('/api/v1/pricing/scheme-types', {
        code: schemeTypeForm.code.trim().toUpperCase(),
        name: schemeTypeForm.name.trim(),
        defaultShortCode: schemeTypeForm.defaultShortCode.trim().toUpperCase() || schemeTypeForm.code.trim().toUpperCase(),
        description: schemeTypeForm.description.trim(),
        status: schemeTypeForm.status || 'ACTIVE',
      });
      const created = res.data?.data || res.data;
      showToast({
        title: 'Scheme Type Added',
        message: `Scheme Type '${created.name}' (${created.code}) created successfully.`,
        type: 'success',
      });
      setIsSchemeTypeModalOpen(false);
      setSchemeTypeForm({ code: '', name: '', defaultShortCode: '', description: '', status: 'ACTIVE' });

      // Refresh scheme types immediately without page refresh
      const typesRes = await ApiClient.get<any>('/api/v1/pricing/scheme-types');
      const types = typesRes.data?.data || typesRes.data || [];
      setSchemeTypes(types);

      // Auto-select in scheme form and populate defaults
      handleSelectSchemeType(created.id);
    } catch (err: any) {
      showToast({ title: 'Error Creating Scheme Type', message: err.message, type: 'error' });
    }
  };

  /**
   * Requirement 16, 17: Add Payment Type dynamically
   */
  const handleSavePaymentType = async () => {
    if (!paymentTypeForm.name.trim()) {
      showToast({ title: 'Validation Error', message: 'Payment Type Name is required.', type: 'error' });
      return;
    }
    const code = (paymentTypeForm.code || paymentTypeForm.name).trim().toUpperCase().replace(/\s+/g, '_');

    try {
      const res = await ApiClient.post<any>('/api/v1/pricing/payment-types', {
        name: paymentTypeForm.name.trim(),
        code,
        description: paymentTypeForm.description.trim(),
        status: paymentTypeForm.status || 'ACTIVE',
      });
      const created = res.data?.data || res.data;
      showToast({
        title: 'Payment Type Added',
        message: `Payment Type '${created.name}' (${created.code}) created successfully.`,
        type: 'success',
      });
      setIsPaymentTypeModalOpen(false);
      setPaymentTypeForm({ name: '', code: '', description: '', status: 'ACTIVE' });

      // Refresh payment types immediately without page refresh
      const ptRes = await ApiClient.get<any>('/api/v1/pricing/payment-types');
      const pts = ptRes.data?.data || ptRes.data || [];
      setPaymentTypes(pts);

      // Auto-select in scheme form
      setSchemeForm((prev) => ({
        ...prev,
        paymentType: created.code,
      }));
    } catch (err: any) {
      showToast({ title: 'Error Creating Payment Type', message: err.message, type: 'error' });
    }
  };
  // ==========================================================
  // RATE LIST ACTIONS (Select Scheme -> Auto Load Products)
  // Requirements 6 - 11, 13, 21
  // ==========================================================

  /**
   * Primary User Flow:
   * Click "+ Create Rate List" -> Select Scheme First -> Auto Load Finished Products
   */
  const handleOpenCreateRateList = (preselectedSchemeId?: string) => {
    setEditingRateList(null);
    setRateListForm({
      schemeId: '',
      schemeShortCode: '',
      schemeName: '',
      schemeTypeCode: '',
      code: '',
      name: '',
      description: '',
      category: 'SEASONAL',
      currency: 'PKR',
      isMobileVisible: true,
      isMobileSelectable: true,
      isInternalOnly: false,
      priority: 10,
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
      notes: 'Initial Published Version',
    });
    setRateListItems([]);
    setRateListItemSearch('');
    setBulkAdjustmentPct('');
    setSchemeComboQuery('');
    setSchemeComboOpen(false);
    setSchemeComboHighlight(0);
    setSelectedSchemeInfo(null);
    setIsRateListModalOpen(true);

    if (preselectedSchemeId) {
      handleSchemeSelectForRateList(preselectedSchemeId);
    }
  };

  /**
   * Edit Rate List: Load full rate list configuration, active version validity dates,
   * scheme connection, and product pricing matrix for editing.
   */
  const handleOpenEditRateList = async (rateListOrId: any) => {
    const rateListId = typeof rateListOrId === 'string' ? rateListOrId : rateListOrId?.id;
    if (!rateListId) return;

    try {
      const res = await ApiClient.get<any>(`/api/v1/pricing/rate-lists/${rateListId}`);
      const rl = res.data?.data || res.data;
      if (!rl) return;

      setEditingRateList(rl);

      const activeVersion = rl.versions?.find((v: any) => v.status === 'ACTIVE') || rl.versions?.[0] || {};
      const effFrom = activeVersion.effectiveFrom
        ? new Date(activeVersion.effectiveFrom).toISOString().split('T')[0]
        : rl.effectiveFrom
        ? new Date(rl.effectiveFrom).toISOString().split('T')[0]
        : '';
      const effTo = activeVersion.effectiveTo
        ? new Date(activeVersion.effectiveTo).toISOString().split('T')[0]
        : rl.effectiveTo
        ? new Date(rl.effectiveTo).toISOString().split('T')[0]
        : '';

      const schemeInfo = rl.scheme || schemes.find((s) => s.id === rl.schemeId) || null;
      setSelectedSchemeInfo(schemeInfo);

      const schemeDiscount = Number(
        schemeInfo?.discountPct ||
        schemeInfo?.defaultDiscountPct ||
        schemeInfo?.cashDiscountPct ||
        0
      );
      setBulkAdjustmentPct(schemeDiscount > 0 ? schemeDiscount : '');

      setRateListForm({
        schemeId: rl.schemeId || rl.scheme?.id || '',
        schemeShortCode: rl.schemeShortCode || rl.scheme?.shortCode || '',
        schemeName: rl.schemeName || rl.scheme?.name || '',
        schemeTypeCode: rl.scheme?.schemeTypeCode || rl.schemeTypeCode || '',
        code: rl.code || '',
        name: rl.name || '',
        description: rl.description || '',
        category: rl.category || 'SEASONAL',
        currency: rl.currency || 'PKR',
        isMobileVisible: rl.isMobileVisible ?? true,
        isMobileSelectable: rl.isMobileSelectable ?? true,
        isInternalOnly: rl.isInternalOnly ?? false,
        priority: rl.priority ?? 10,
        effectiveFrom: effFrom || '',
        effectiveTo: effTo || '',
        notes: activeVersion.notes || '',
      });

      setSchemeComboQuery(rl.schemeName || rl.scheme?.name || '');
      setSchemeComboOpen(false);

      const itemsSource = activeVersion.items || rl.items || [];
      const mappedItems = itemsSource.map((it: any) => {
        const fp = it.finishedProduct || {};
        const baseRate = Number(it.baseRate ?? fp.defaultSellingPrice ?? 0);
        const schemeRate = Number(it.schemeRate ?? it.fixedNetRate ?? baseRate);
        const discountPercent = Number(
          it.discountPercent ??
          it.discountValue ??
          (baseRate > 0 && schemeRate < baseRate ? (((baseRate - schemeRate) / baseRate) * 100).toFixed(1) : 0)
        );
        const dynamicCat = resolveProductCategory(fp);

        const activeBatch = fp.batches?.find((b: any) => b.isActive) || fp.batches?.[0];
        const batchNumber = it.batchNumber || activeBatch?.batchNumber || null;

        return {
          finishedProductId: it.finishedProductId || fp.id,
          productCode: fp.productCode || it.productCode || '',
          productName: fp.productName || it.productName || '',
          category: dynamicCat,
          mType: fp.mType || dynamicCat,
          packagingMaterial: fp.packagingMaterial?.materialName || (typeof it.packagingMaterial === 'string' ? it.packagingMaterial : '') || '',
          packSize: it.packSize?.name || fp.packSize?.name || (typeof it.packSize === 'string' ? it.packSize : '') || (fp.packingQuantity ? `${fp.packingQuantity} ${fp.packingUnit || ''}`.trim() : ''),
          packSizeId: it.packSizeId || fp.packSizeId || null,
          unit: it.unit || fp.salesUom?.code || fp.packingUnit || 'Unit',
          batchId: it.batchId || activeBatch?.id || null,
          batchNumber,
          batchManufacturingDate: activeBatch?.manufacturingDate || null,
          batchExpiryDate: activeBatch?.expiryDate || null,
          batchAvailableQuantity: activeBatch?.availableQuantity || 0,
          isBatchExpired: activeBatch?.expiryDate ? new Date(activeBatch.expiryDate) < new Date() : false,
          batchesCount: fp.batches?.length || 0,
          batches: fp.batches || [],
          baseRate,
          schemeRate,
          discountPercent,
          rateType: it.rateType || (discountPercent > 0 ? 'DISCOUNT' : 'DIRECT'),
          minAllowedRate: Number(it.minAllowedRate || Math.round(schemeRate * 0.8)),
        };
      });

      setRateListItems(mappedItems);
      setRateListItemSearch('');
      setIsRateListModalOpen(true);
    } catch (err: any) {
      showToast({
        title: 'Error Opening Rate List',
        message: err.message || 'Failed to load rate list details for editing',
        type: 'error',
      });
    }
  };

  /**
   * Auto-loader: When Scheme is selected, retrieve ONLY Sellable Finished Products
   * and auto-calculate scheme rates based on commercial rules (Requirements 7, 8, 9, 10, 11)
   */
  const handleSchemeSelectForRateList = async (schemeId: string) => {
    if (!schemeId) {
      setRateListForm((prev) => ({
        ...prev,
        schemeId: '',
        schemeShortCode: '',
        schemeName: '',
        schemeTypeCode: '',
      }));
      setRateListItems([]);
      return;
    }

    setIsLoadingSchemeProducts(true);
    try {
      const res = await ApiClient.get<any>(`/api/v1/pricing/schemes/${schemeId}/products`);
      const { scheme, products } = res.data?.data || res.data;

      const shortCode = scheme.shortCode || scheme.code;
      const typeCode = scheme.schemeTypeCode || scheme.schemeTypeRef?.code || 'SR';
      const year = new Date().getFullYear();

      // Store scheme info for summary card
      setSelectedSchemeInfo(scheme);
      setSchemeComboQuery(`${shortCode} - ${scheme.name}`);

      setRateListForm((prev) => ({
        ...prev,
        schemeId: scheme.id,
        schemeShortCode: shortCode,
        schemeName: scheme.name,
        schemeTypeCode: typeCode,
        code: `RL-${shortCode}-${year}`,
        name: `${scheme.name} Rate List`,
        description: `Official Rate List for ${scheme.name} (${typeCode})`,
        category:
          typeCode === 'CA'
            ? 'CASH'
            : typeCode === 'ABC'
            ? 'ADVANCE_BOOKING'
            : 'SEASONAL',
        effectiveFrom: (scheme.startDate
          ? new Date(scheme.startDate).toISOString().split('T')[0]
          : prev.effectiveFrom) || '',
        effectiveTo: (scheme.endDate
          ? new Date(scheme.endDate).toISOString().split('T')[0]
          : prev.effectiveTo) || '',
      }));

      const schemeDiscount = Number(
        scheme.discountPct ||
        scheme.defaultDiscountPct ||
        scheme.cashDiscountPct ||
        scheme.additionalBookingPct ||
        0
      );

      setBulkAdjustmentPct(schemeDiscount > 0 ? schemeDiscount : '');

      // Map loaded products to editable rate list items with automatic discount application!
      const mappedItems = (products || []).map((p: any) => {
        const baseRate = Number(p.baseSellingPrice || p.baseRate || 0);
        const itemDisc = Number(p.discountPercent || p.discountValue || 0);
        const effectiveDisc = itemDisc > 0 ? itemDisc : schemeDiscount;
        const schemeRate = effectiveDisc > 0
          ? Math.round(baseRate * (1 - effectiveDisc / 100))
          : Number(p.schemeRate || baseRate);
        const dynamicCat = resolveProductCategory(p);

        return {
          finishedProductId: p.finishedProductId || p.id,
          productCode: p.productCode,
          productName: p.productName,
          category: dynamicCat,
          mType: p.mType || dynamicCat,
          packagingMaterial: p.packagingMaterial?.materialName || (typeof p.packagingMaterial === 'string' ? p.packagingMaterial : '') || (typeof p.packaging === 'string' ? p.packaging : ''),
          packSize: p.packSize?.name || (typeof p.packSize === 'string' ? p.packSize : '') || (p.packingQuantity ? `${p.packingQuantity} ${p.packingUnit || ''}`.trim() : ''),
          packSizeId: p.packSizeId || null,
          unit: p.unit || 'Unit',
          batchId: p.batchId || null,
          batchNumber: p.batchNumber || null,
          batchManufacturingDate: p.batchManufacturingDate || null,
          batchExpiryDate: p.batchExpiryDate || null,
          batchAvailableQuantity: p.batchAvailableQuantity || 0,
          isBatchExpired: p.isBatchExpired || false,
          batchesCount: p.batchesCount || 0,
          batches: p.batches || [],
          baseRate,
          schemeRate,
          discountPercent: effectiveDisc,
          rateType: effectiveDisc > 0 ? 'DISCOUNT' : (p.rateType || 'DIRECT'),
          minAllowedRate: Math.round(schemeRate * 0.8),
        };
      });

      setRateListItems(mappedItems);

      showToast({
        title: 'Finished Products Auto-Loaded',
        message: schemeDiscount > 0
          ? `Loaded ${mappedItems.length} products with ${schemeDiscount}% scheme discount applied.`
          : `Loaded ${mappedItems.length} sellable finished products for '${scheme.name}'.`,
        type: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Error Loading Scheme Products',
        message: err.message,
        type: 'error',
      });
    } finally {
      setIsLoadingSchemeProducts(false);
    }
  };

  /**
   * Delete Handlers
   */
  const handleConfirmDeleteRateList = async () => {
    if (!rateListToDelete) return;
    setIsDeletingRateList(true);
    try {
      await ApiClient.delete(`/api/v1/pricing/rate-lists/${rateListToDelete.id}`);
      showToast({
        title: 'Rate List Deleted',
        message: `Rate list '${rateListToDelete.name || rateListToDelete.code}' was removed successfully.`,
        type: 'success',
      });
      setRateListToDelete(null);
      loadData();
    } catch (err: any) {
      showToast({
        title: 'Error Deleting Rate List',
        message: err.message || 'Failed to delete rate list',
        type: 'error',
      });
    } finally {
      setIsDeletingRateList(false);
    }
  };

  const handleConfirmDeleteScheme = async () => {
    if (!schemeToDelete) return;
    setIsDeletingScheme(true);
    try {
      await ApiClient.delete(`/api/v1/pricing/schemes/${schemeToDelete.id}`);
      showToast({
        title: 'Scheme Deleted',
        message: `Commercial scheme '${schemeToDelete.name}' was removed successfully.`,
        type: 'success',
      });
      setSchemeToDelete(null);
      loadData();
    } catch (err: any) {
      showToast({
        title: 'Error Deleting Scheme',
        message: err.message || 'Failed to delete commercial scheme',
        type: 'error',
      });
    } finally {
      setIsDeletingScheme(false);
    }
  };

  /**
   * Update individual product rate in grid: supports both Direct Rate and Discount %
   */
  const handleItemRateChange = (index: number, newSchemeRate: number) => {
    setRateListItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const base = Number(it.baseRate) || 0;
        let discountPct = 0;
        if (base > 0 && newSchemeRate < base) {
          discountPct = Math.round(((base - newSchemeRate) / base) * 1000) / 10;
        }
        return {
          ...it,
          schemeRate: newSchemeRate,
          discountPercent: discountPct,
          minAllowedRate: Math.round(newSchemeRate * 0.8),
        };
      })
    );
  };

  /**
   * Remove a single product from the rate list (does NOT delete product master)
   */
  const handleRemoveRateListItem = (finishedProductId: string) => {
    setRateListItems((prev) => prev.filter((it) => it.finishedProductId !== finishedProductId));
  };

  /**
   * Update active batch data across product matrix and active rate list items
   */
  const handleBatchSaved = (savedBatch: any) => {
    // 1. Update in allProducts matrix
    setAllProducts((prev) =>
      prev.map((p) => {
        if ((p.finishedProductId || p.id) === savedBatch.finishedProductId) {
          const updatedBatches = p.batches
            ? p.batches.map((b: any) =>
                b.id === savedBatch.id
                  ? savedBatch
                  : savedBatch.isActive
                  ? { ...b, isActive: false }
                  : b
              )
            : [savedBatch];
          if (!p.batches?.some((b: any) => b.id === savedBatch.id)) {
            updatedBatches.push(savedBatch);
          }
          const activeBatch = updatedBatches.find((b: any) => b.isActive) || updatedBatches[0];
          return {
            ...p,
            batchId: activeBatch?.id,
            batchNumber: activeBatch?.batchNumber,
            batchManufacturingDate: activeBatch?.manufacturingDate,
            batchExpiryDate: activeBatch?.expiryDate,
            batchAvailableQuantity: activeBatch?.availableQuantity,
            isBatchExpired: activeBatch?.expiryDate ? new Date(activeBatch.expiryDate) < new Date() : false,
            batches: updatedBatches,
            batchesCount: updatedBatches.length,
          };
        }
        return p;
      })
    );

    // 2. Update in rateListItems if currently open in rate list modal
    setRateListItems((prev) =>
      prev.map((item) => {
        if (item.finishedProductId === savedBatch.finishedProductId) {
          return {
            ...item,
            batchId: savedBatch.isActive ? savedBatch.id : item.batchId,
            batchNumber: savedBatch.isActive ? savedBatch.batchNumber : item.batchNumber,
            batchExpiryDate: savedBatch.isActive ? savedBatch.expiryDate : item.batchExpiryDate,
            isBatchExpired:
              savedBatch.isActive && savedBatch.expiryDate
                ? new Date(savedBatch.expiryDate) < new Date()
                : item.isBatchExpired,
          };
        }
        return item;
      })
    );

    // Auto-close batch modal on save
    setBatchModalProduct(null);
  };

  /**
   * Scheme combobox filtered results
   */
  const schemeComboResults = useMemo(() => {
    const q = schemeComboQuery.toLowerCase().trim();
    if (!q) return schemes.slice(0, 50);
    return schemes.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.code || '').toLowerCase().includes(q) ||
        (s.shortCode || '').toLowerCase().includes(q)
    );
  }, [schemes, schemeComboQuery]);

  /**
   * Handle scheme combobox keyboard events (Arrow Up/Down, Enter, Escape)
   */
  const handleSchemeComboKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!schemeComboOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setSchemeComboOpen(true);
      setSchemeComboHighlight(0);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSchemeComboHighlight((h) => Math.min(h + 1, schemeComboResults.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSchemeComboHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (schemeComboOpen && schemeComboResults[schemeComboHighlight]) {
        const picked = schemeComboResults[schemeComboHighlight];
        setSchemeComboOpen(false);
        handleSchemeSelectForRateList(picked.id);
        setTimeout(() => codeInputRef.current?.focus(), 80);
      }
      return;
    }
    if (e.key === 'Escape') {
      setSchemeComboOpen(false);
      return;
    }
  };

  /**
   * Automatically apply scheme discount across all products in real time
   */
  const handleApplySchemeDiscount = (newDiscountPct: number) => {
    const validPct = Math.max(0, Math.min(100, Number(newDiscountPct) || 0));
    setRateListItems((prev) =>
      prev.map((item) => {
        const base = Number(item.baseRate) || 0;
        const newRate = validPct > 0 ? Math.round(base * (1 - validPct / 100)) : base;
        return {
          ...item,
          discountPercent: validPct,
          schemeRate: newRate,
          rateType: validPct > 0 ? 'DISCOUNT' : 'DIRECT',
          minAllowedRate: Math.round(newRate * 0.8),
        };
      })
    );
  };

  /**
   * Save (Create or Update) Rate List with Duplicate Rate Protection (Requirement 12, 14)
   */
  const handleSaveRateList = async () => {
    if (!rateListForm.schemeId) {
      showToast({ title: 'Validation Error', message: 'Please select a Scheme first.', type: 'error' });
      return;
    }
    if (!rateListForm.code.trim() || !rateListForm.name.trim()) {
      showToast({ title: 'Validation Error', message: 'Rate List Code and Name are required.', type: 'error' });
      return;
    }
    if (rateListItems.length === 0) {
      showToast({
        title: 'Products Required',
        message: 'No finished products found for this scheme.',
        type: 'warning',
      });
      return;
    }

    try {
      const payload = {
        schemeId: rateListForm.schemeId,
        schemeShortCode: rateListForm.schemeShortCode,
        schemeName: rateListForm.schemeName,
        code: rateListForm.code.trim().toUpperCase(),
        name: rateListForm.name.trim(),
        description: rateListForm.description,
        category: rateListForm.category,
        currency: rateListForm.currency,
        isMobileVisible: rateListForm.isMobileVisible,
        isMobileSelectable: rateListForm.isMobileSelectable,
        isInternalOnly: rateListForm.isInternalOnly,
        priority: rateListForm.priority,
        effectiveFrom: rateListForm.effectiveFrom,
        effectiveTo: rateListForm.effectiveTo || undefined,
        notes: rateListForm.notes,
        items: rateListItems.map((it) => ({
          finishedProductId: it.finishedProductId,
          packSizeId: it.packSizeId || null,
          baseRate: it.baseRate,
          schemeRate: it.schemeRate,
          discountPercent: it.discountPercent,
          rateType: it.rateType,
          minAllowedRate: it.minAllowedRate,
        })),
      };

      if (editingRateList?.id) {
        await ApiClient.put(`/api/v1/pricing/rate-lists/${editingRateList.id}`, payload);
        showToast({
          title: 'Rate List Updated',
          message: `Rate list '${rateListForm.code}' updated successfully with ${rateListItems.length} products.`,
          type: 'success',
        });
      } else {
        await ApiClient.post('/api/v1/pricing/rate-lists', payload);
        showToast({
          title: 'Rate List Created',
          message: `Rate list '${rateListForm.code}' published successfully with ${rateListItems.length} finished products.`,
          type: 'success',
        });
      }

      setEditingRateList(null);
      setIsRateListModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast({
        title: 'Error Saving Rate List',
        message: err.message || 'Failed to save rate list configuration.',
        type: 'error',
      });
    }
  };

  /**
   * Requirement 21: Auto-generate / Add Newly Created Finished Products to Rate List
   */
  const handleAddNewProductsToRateList = async (rateListId: string) => {
    try {
      const res = await ApiClient.post<any>(`/api/v1/pricing/rate-lists/${rateListId}/add-products`, {});
      const data = res.data?.data || res.data;
      showToast({
        title: 'Finished Products Synced',
        message: data.message || `Added ${data.addedCount || 0} newly created finished products to rate list.`,
        type: 'success',
      });
      loadData();
      if (selectedRateList && selectedRateList.id === rateListId) {
        handleViewRateListDetail(rateListId);
      }
    } catch (err: any) {
      showToast({
        title: 'Sync Failed',
        message: err.message,
        type: 'error',
      });
    }
  };

  const handleViewRateListDetail = async (id: string) => {
    try {
      const res = await ApiClient.get<any>(`/api/v1/pricing/rate-lists/${id}`);
      setSelectedRateList(res.data?.data || res.data);
      setIsRateListDetailModalOpen(true);
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message, type: 'error' });
    }
  };

  /**
   * Requirement 19: Rate List PDF Export
   */
  const handleExportPdf = async (rl: any) => {
    try {
      let fullRateList = rl;
      const hasItems = (rl?.items && rl.items.length > 0) || 
                       (rl?.versions && rl.versions.some((v: any) => v.items && v.items.length > 0));

      if (!hasItems && rl?.id) {
        showToast({
          title: 'Preparing PDF',
          message: 'Loading finished products for official rate list document...',
          type: 'info',
        });
        const res = await ApiClient.get<any>(`/api/v1/pricing/rate-lists/${rl.id}`);
        fullRateList = res.data?.data || res.data;
      }

      const targetItems = fullRateList?.items?.length
        ? fullRateList.items
        : fullRateList?.versions?.find((v: any) => v.status === 'ACTIVE')?.items ||
          fullRateList?.versions?.[0]?.items || [];

      if (targetItems.length === 0 && fullRateList?.id) {
        try {
          const syncRes = await ApiClient.post<any>(`/api/v1/pricing/rate-lists/${fullRateList.id}/add-products`, {});
          const synced = syncRes.data?.data || syncRes.data;
          if (synced && (synced.items?.length > 0 || synced.versions?.[0]?.items?.length > 0)) {
            fullRateList = synced;
          }
        } catch (_) {
          // ignore sync failure
        }
      }

      exportRateListToPdf(fullRateList);
      showToast({
        title: 'Rate List PDF',
        message: `Print document opened for ${fullRateList.schemeName || fullRateList.name}.`,
        type: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'PDF Export Failed',
        message: err.message || 'Unable to open PDF print preview.',
        type: 'error',
      });
    }
  };

  // ==========================================
  // VERSIONING (Requirement 13)
  // ==========================================

  const handleOpenNewVersionModal = (rl: any) => {
    setVersionTargetRateList(rl);
    setNewVersionForm({
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
      notes: `Version ${(rl.totalVersionsCount || 1) + 1} Commercial Revision`,
    });
    setIsVersionModalOpen(true);
  };

  const handleSaveNewVersion = async () => {
    if (!versionTargetRateList) return;
    try {
      const fullDetail = await ApiClient.get<any>(`/api/v1/pricing/rate-lists/${versionTargetRateList.id}`);
      const rlData = fullDetail.data?.data || fullDetail.data;
      const activeVersion = rlData.versions?.find((v: any) => v.status === 'ACTIVE') || rlData.versions?.[0];
      const itemsToClone = (activeVersion?.items || []).map((it: any) => ({
        finishedProductId: it.finishedProductId,
        packSizeId: it.packSizeId,
        baseRate: Number(it.baseRate),
        schemeRate: Number(it.schemeRate ?? it.customPrice ?? it.baseRate),
        discountPercent: Number(it.discountPercent || 0),
        rateType: it.rateType || 'DIRECT',
        unit: it.unit,
        minAllowedRate: it.minAllowedRate ? Number(it.minAllowedRate) : null,
        freeQuantity: Number(it.freeQuantity || 0),
        isActive: it.isActive,
      }));

      await ApiClient.post(`/api/v1/pricing/rate-lists/${versionTargetRateList.id}/versions`, {
        effectiveFrom: newVersionForm.effectiveFrom,
        effectiveTo: newVersionForm.effectiveTo || undefined,
        notes: newVersionForm.notes,
        items: itemsToClone,
      });

      showToast({
        title: 'New Version Published',
        message: `Incremental rate version created without altering historical transaction records.`,
        type: 'success',
      });
      setIsVersionModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error Creating Version', message: err.message, type: 'error' });
    }
  };

  // ==========================================
  // AUTHORITY LIMITS ACTIONS
  // ==========================================

  const handleOpenEditAuthority = (limit: any) => {
    setSelectedAuthority(limit);
    setAuthorityForm({
      roleCode: limit.roleCode,
      maxDiscountPct: Number(limit.maxDiscountPct),
      canSetNetRate: limit.canSetNetRate,
      canApplySpecialRate: limit.canApplySpecialRate || false,
      canApproveOwnOverride: limit.canApproveOwnOverride || false,
      requiresApproval: limit.requiresApproval,
    });
    setIsAuthorityModalOpen(true);
  };

  const handleSaveAuthority = async () => {
    try {
      await ApiClient.put('/api/v1/pricing/authority-limits', authorityForm);
      showToast({
        title: 'Authority Limit Updated',
        message: `Pricing threshold for ${authorityForm.roleCode} updated successfully.`,
        type: 'success',
      });
      setIsAuthorityModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error Updating Authority', message: err.message, type: 'error' });
    }
  };

  // ==========================================
  // SIMULATOR
  // ==========================================

  const handleRunSimulation = async () => {
    if (!simProductId) return;
    setIsSimulating(true);
    try {
      const res = await ApiClient.post<any>('/api/v1/pricing/resolve', {
        dealerId: simDealerId || undefined,
        finishedProductId: simProductId,
        quantity: simQuantity,
        paymentTerm: simPaymentTerm,
        requestedSchemeId: simSchemeId || undefined,
        requestedRate: simRequestedRate !== '' ? Number(simRequestedRate) : undefined,
      });

      setSimResult(res.data?.data || res.data);
    } catch (err: any) {
      showToast({ title: 'Simulation Error', message: err.message, type: 'error' });
    } finally {
      setIsSimulating(false);
    }
  };

  // Filtered lists
  const filteredRateLists = useMemo(() => {
    return rateLists.filter((rl) => {
      const matchesSearch =
        (rl.name || '').toLowerCase().includes(rateListSearch.toLowerCase()) ||
        (rl.code || '').toLowerCase().includes(rateListSearch.toLowerCase()) ||
        (rl.schemeShortCode || '').toLowerCase().includes(rateListSearch.toLowerCase()) ||
        (rl.schemeName || '').toLowerCase().includes(rateListSearch.toLowerCase());
      const matchesScheme =
        rateListSchemeFilter === 'ALL' ||
        rl.schemeId === rateListSchemeFilter ||
        rl.schemeShortCode === rateListSchemeFilter;
      return matchesSearch && matchesScheme;
    });
  }, [rateLists, rateListSearch, rateListSchemeFilter]);

  const filteredSchemes = useMemo(() => {
    return schemes.filter((s) => {
      const matchesSearch =
        (s.name || '').toLowerCase().includes(schemeSearch.toLowerCase()) ||
        (s.code || '').toLowerCase().includes(schemeSearch.toLowerCase()) ||
        (s.shortCode || '').toLowerCase().includes(schemeSearch.toLowerCase());
      const matchesType =
        schemeTypeFilter === 'ALL' ||
        s.schemeTypeCode === schemeTypeFilter ||
        s.schemeTypeId === schemeTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [schemes, schemeSearch, schemeTypeFilter]);

  const filteredModalItems = useMemo(() => {
    if (!rateListItemSearch.trim()) return rateListItems;
    const q = rateListItemSearch.toLowerCase().trim();
    return rateListItems.filter(
      (it) =>
        (it.productName || '').toLowerCase().includes(q) ||
        (it.productCode || '').toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q) ||
        (it.mType || '').toLowerCase().includes(q)
    );
  }, [rateListItems, rateListItemSearch]);

  const filteredMatrixProducts = useMemo(() => {
    if (!productMatrixSearch.trim()) return allProducts;
    const q = productMatrixSearch.toLowerCase().trim();
    return allProducts.filter(
      (p) =>
        (p.productName || '').toLowerCase().includes(q) ||
        (p.productCode || '').toLowerCase().includes(q) ||
        (resolveProductCategory(p) || '').toLowerCase().includes(q) ||
        (p.mType || '').toLowerCase().includes(q)
    );
  }, [allProducts, productMatrixSearch]);

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              }}
            >
              <IconTag size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Rate Lists & Commercial Schemes
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Integrated flow: Scheme Master → Scheme Selection → Finished Products Auto-Load → Scheme Rates → Sales Orders
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" onClick={loadData} isLoading={isLoading}>
            <IconRefresh size={16} /> Refresh
          </Button>
          {activeTab === 'rate-lists' && (
            <Button variant="primary" onClick={() => handleOpenCreateRateList()}>
              <IconPlus size={16} /> Create Rate List
            </Button>
          )}
          {activeTab === 'schemes' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" onClick={() => setIsSchemeTypeModalOpen(true)}>
                <IconLayers size={16} /> + Scheme Type
              </Button>
              <Button variant="primary" onClick={handleOpenCreateScheme}>
                <IconPlus size={16} /> + Add Scheme
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Overview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <KpiCard
          title="Active Rate Lists"
          value={rateLists.filter((r) => r.status === 'ACTIVE').length.toString()}
          subtitle="Scheme-bound pricing matrices"
          icon={<IconLayers size={22} color="#059669" />}
        />
        <KpiCard
          title="Commercial Schemes"
          value={schemes.filter((s) => (s.computedStatus || s.status) === 'ACTIVE').length.toString()}
          subtitle="CA, ABC, SR, NNR & Custom"
          icon={<IconPercent size={22} color="#2563EB" />}
        />
        <KpiCard
          title="Sellable Finished Goods"
          value={allProducts.length.toString()}
          subtitle="Only finished goods in rate lists"
          icon={<IconCheck size={22} color="#10B981" />}
        />
        <KpiCard
          title="Scheme Types"
          value={schemeTypes.length.toString()}
          subtitle="Dynamic commercial structures"
          icon={<IconShield size={22} color="#8B5CF6" />}
        />
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid var(--border-default)',
          marginBottom: '24px',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        {[
          { id: 'rate-lists', label: 'Rate Lists', count: rateLists.length, icon: <IconLayers size={16} /> },
          { id: 'schemes', label: 'Scheme Master', count: schemes.length, icon: <IconPercent size={16} /> },
          { id: 'active-matrix', label: 'Active Finished Goods Matrix', icon: <IconTag size={16} /> },
          { id: 'authority', label: 'Authority Governance', count: authorityLimits.length, icon: <IconShield size={16} /> },
          { id: 'simulator', label: 'Live Price Engine Simulator', icon: <IconCheck size={16} /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as PricingTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 18px',
                fontWeight: isActive ? 700 : 500,
                fontSize: '14px',
                color: isActive ? '#059669' : 'var(--text-secondary)',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid #059669' : '3px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  style={{
                    backgroundColor: isActive ? '#d1fae5' : 'var(--bg-subtle)',
                    color: isActive ? '#065f46' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================== */}
      {/* TAB 1: RATE LISTS TABLE (Requirements 6 - 14, 19, 21)     */}
      {/* ========================================================== */}
      {activeTab === 'rate-lists' && (
        <div>
          {/* Filter Bar */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '18px',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Input
                  placeholder="Search rate lists by scheme name, short code, or list code..."
                  value={rateListSearch}
                  onChange={(e) => setRateListSearch(e.target.value)}
                />
              </div>
              <Select
                value={rateListSchemeFilter}
                onChange={(e) => setRateListSchemeFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Schemes' },
                  ...schemes.map((s) => ({
                    value: s.id,
                    label: `${s.shortCode || s.code} - ${s.name}`,
                  })),
                ]}
              />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Showing {filteredRateLists.length} of {rateLists.length} rate lists
            </div>
          </div>

          {/* Rate Lists Grid / Table */}
          {isLoading ? (
            <TableSkeleton rows={5} columns={8} />
          ) : filteredRateLists.length === 0 ? (
            <EmptyState
              title="No Rate Lists Created Yet"
              description="Click '+ Create Rate List', select a Scheme, and the system will automatically load finished products with scheme rates."
              actionLabel="Create First Rate List"
              onAction={() => handleOpenCreateRateList()}
            />
          ) : (
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Scheme & Code</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Rate List Name</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Scheme Type</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Version</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Finished Goods</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Validity Window</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRateLists.map((rl) => {
                    const shortCode = rl.schemeShortCode || rl.scheme?.shortCode || rl.code;
                    const schemeName = rl.schemeName || rl.scheme?.name || rl.name;
                    const typeCode = rl.scheme?.schemeTypeRef?.code || rl.schemeTypeCode || rl.category;

                    return (
                      <tr
                        key={rl.id}
                        onDoubleClick={() => handleOpenEditRateList(rl)}
                        title="Double-click to edit rate list and pricing matrix"
                        style={{
                          borderBottom: '1px solid var(--border-default)',
                          transition: 'background 0.15s ease',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: '13px',
                                color: '#047857',
                                backgroundColor: '#ecfdf5',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                border: '1px solid #a7f3d0',
                              }}
                            >
                              {shortCode}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                            {rl.code}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{schemeName}</div>
                          {rl.description && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {rl.description}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor:
                                typeCode === 'CA'
                                  ? '#eff6ff'
                                  : typeCode === 'ABC'
                                  ? '#fef3c7'
                                  : typeCode === 'NNR'
                                  ? '#f3e8ff'
                                  : '#ecfdf5',
                              color:
                                typeCode === 'CA'
                                  ? '#1d4ed8'
                                  : typeCode === 'ABC'
                                  ? '#b45309'
                                  : typeCode === 'NNR'
                                  ? '#7e22ce'
                                  : '#047857',
                            }}
                          >
                            {typeCode}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontWeight: 700 }}>v{rl.activeVersionNumber || 1}.0</span>
                          {rl.totalVersionsCount > 1 && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                              ({rl.totalVersionsCount} revisions)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              padding: '3px 8px',
                              borderRadius: '10px',
                            }}
                          >
                            {rl.productCount || rl.items?.length || 0} Products
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <div>{new Date(rl.effectiveFrom || rl.validFrom).toLocaleDateString()}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            to {rl.effectiveTo || rl.validTo ? new Date(rl.effectiveTo || rl.validTo).toLocaleDateString() : 'Active/Indefinite'}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <StatusBadge status={rl.status} />
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenEditRateList(rl)}
                              title="Edit Rate List & Pricing Matrix"
                              style={{ color: '#2563eb', borderColor: '#bfdbfe' }}
                            >
                              <IconEdit size={14} /> Edit
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleViewRateListDetail(rl.id)}
                              title="View Products & Scheme Rates"
                            >
                              <IconEye size={14} /> View
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleExportPdf(rl)}
                              title="Print Official Rate List PDF (Requirement 19)"
                              style={{ color: '#047857' }}
                            >
                              <IconPrinter size={14} /> PDF
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleAddNewProductsToRateList(rl.id)}
                              title="Sync & Add Any Newly Created Finished Goods (Requirement 21)"
                            >
                              <IconPlus size={14} /> Sync FG
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenNewVersionModal(rl)}
                              title="Create New Version (Preserves Historical Transactions)"
                            >
                              <IconClock size={14} /> +Ver
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setRateListToDelete(rl)}
                              title="Delete Rate List"
                              style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                            >
                              <IconTrash size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 2: SCHEME MASTER (Requirements 1 - 5, 12, 14)          */}
      {/* ========================================================== */}
      {activeTab === 'schemes' && (
        <div>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '18px',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '320px' }}>
              <Input
                placeholder="Search schemes by name, short code (e.g. MCCM), or type code..."
                value={schemeSearch}
                onChange={(e) => setSchemeSearch(e.target.value)}
              />
              <Select
                value={schemeTypeFilter}
                onChange={(e) => setSchemeTypeFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Scheme Types' },
                  ...schemeTypes.map((t) => ({ value: t.code, label: `${t.code} - ${t.name}` })),
                ]}
              />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {filteredSchemes.length} schemes configured (Unlimited user-created)
            </div>
          </div>

          {filteredSchemes.length === 0 ? (
            <EmptyState
              title="No Schemes Configured Yet"
              description="Click '+ Add Scheme' to define a commercial pricing scheme."
              actionLabel="Add First Scheme"
              onAction={() => handleOpenCreateScheme()}
            />
          ) : (
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Scheme Code</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Scheme Name</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Scheme Type</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Discount %</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Payment Type</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Validity Window</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Rate Lists</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchemes.map((sc) => {
                    const typeCode = sc.schemeTypeCode || sc.schemeTypeRef?.code || 'SR';
                    const typeName = sc.schemeTypeRef?.name || typeCode;
                    const shortCode = sc.shortCode || sc.code;
                    const status = sc.computedStatus || sc.status || 'ACTIVE';
                    const attachedRateLists = rateLists.filter((rl) => rl.schemeId === sc.id);
                    const disc = Number(sc.discountPct ?? sc.defaultDiscountPct ?? sc.cashDiscountPct ?? 0);

                    return (
                      <tr
                        key={sc.id}
                        onDoubleClick={() => handleOpenEditScheme(sc)}
                        title="Double-click to edit commercial scheme"
                        style={{ borderBottom: '1px solid var(--border-default)', transition: 'background 0.15s ease', cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '12px',
                              color: '#047857',
                              backgroundColor: '#ecfdf5',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: '1px solid #a7f3d0',
                              fontFamily: 'var(--font-mono, monospace)',
                            }}
                          >
                            {shortCode}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sc.name}</div>
                          {sc.description && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {sc.description}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                            }}
                          >
                            {typeName} ({typeCode})
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 800,
                              backgroundColor: disc > 0 ? '#eff6ff' : '#f8fafc',
                              color: disc > 0 ? '#1d4ed8' : '#64748b',
                              border: disc > 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                            }}
                          >
                            {disc > 0 ? `${disc}% Off` : '0% Direct'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: sc.paymentType === 'CREDIT' ? '#fef3c7' : '#ecfdf5',
                              color: sc.paymentType === 'CREDIT' ? '#b45309' : '#047857',
                            }}
                          >
                            {sc.paymentType || 'CASH'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <div>{new Date(sc.startDate || sc.effectiveFrom).toLocaleDateString()}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            to {sc.endDate || sc.effectiveTo ? new Date(sc.endDate || sc.effectiveTo).toLocaleDateString() : 'Ongoing'}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '11px',
                              backgroundColor: attachedRateLists.length > 0 ? '#ecfdf5' : '#fffbeb',
                              color: attachedRateLists.length > 0 ? '#047857' : '#b45309',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: attachedRateLists.length > 0 ? '1px solid #a7f3d0' : '1px solid #fde68a',
                            }}
                          >
                            {attachedRateLists.length} Attached
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <StatusBadge status={status} />
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <Button variant="secondary" size="sm" onClick={() => handleOpenEditScheme(sc)} title="Edit Scheme">
                              <IconEdit size={14} /> Edit
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenCreateRateList(sc.id)}
                              style={{ color: '#047857', borderColor: '#a7f3d0' }}
                              title="Create Rate List from Scheme"
                            >
                              <IconPlus size={14} /> + Rate List
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSchemeToDelete(sc)}
                              style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                              title="Delete Scheme"
                            >
                              <IconTrash size={14} /> Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 3: ACTIVE FINISHED GOODS MATRIX                        */}
      {/* ========================================================== */}
      {activeTab === 'active-matrix' && (
        <div>
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: '#eff6ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <strong>Centralized Finished Product Master:</strong> Showing active sellable finished products only. Double-click any row to edit product specifications.
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<IconPlus size={14} />}
              onClick={() => setIsAddProductModalOpen(true)}
              style={{ backgroundColor: '#059669', borderColor: '#059669', color: '#fff' }}
            >
              + Add Product
            </Button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ flex: 1, minWidth: '260px', maxWidth: '420px' }}>
              <Input
                placeholder="Search by code, product name, or formulation category..."
                value={productMatrixSearch}
                onChange={(e) => setProductMatrixSearch(e.target.value)}
              />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Showing {filteredMatrixProducts.length} of {allProducts.length} finished products
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
              overflowX: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '2px solid var(--border-default)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Product Code</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Finished Product Name</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Category</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Pack Size</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Batch Number</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Base Selling Price</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, backgroundColor: '#ecfdf5' }}>CA (-10%)</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, backgroundColor: '#fef3c7' }}>ABC (-15%)</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Min Allowed Floor</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatrixProducts.map((p) => {
                  const base = Number(p.baseRate || p.defaultSellingPrice || 0);
                  const caRate = Math.round(base * 0.9);
                  const abcRate = Math.round(base * 0.85);
                  const minFloor = Number(p.minAllowedRate || Math.round(base * 0.75));

                  return (
                    <tr
                      key={p.finishedProductId || p.id}
                      onDoubleClick={() => setEditingProductInPricing(p)}
                      title="Double-click to edit finished product specifications"
                      style={{
                        borderBottom: '1px solid var(--border-default)',
                        cursor: 'pointer',
                        transition: 'background-color 0.12s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-subtle)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#047857' }}>
                        {p.productCode}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>{p.productName}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={getCategoryBadgeStyle(resolveProductCategory(p))}>
                          {resolveProductCategory(p)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                        {p.packSize ? `${p.packSize} ${p.packagingMaterial || ''}`.trim() : p.unit || 'Unit'}
                        {resolvePackSizeDisplay(p)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {p.batchNumber ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBatchModalProduct({
                                id: p.finishedProductId || p.id,
                                productName: p.productName,
                                productCode: p.productCode,
                                packSize: p.packSize,
                                category: p.category,
                              });
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 8px',
                              borderRadius: '5px',
                              backgroundColor: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              color: '#166534',
                              fontFamily: 'monospace',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title={`Active Batch: ${p.batchNumber}. Click to manage product batches.`}
                          >
                            <span>{p.batchNumber}</span>
                            {p.isBatchExpired && (
                              <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>Expired</span>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBatchModalProduct({
                                id: p.finishedProductId || p.id,
                                productName: p.productName,
                                productCode: p.productCode,
                                packSize: p.packSize,
                                category: p.category,
                              });
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#f8fafc',
                              border: '1px dashed #cbd5e1',
                              color: '#64748b',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                            title="No batch assigned. Click to assign a batch."
                          >
                            <IconPlus size={11} /> Add Batch
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                        PKR {base.toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#047857', backgroundColor: '#f0fdf4' }}>
                        PKR {caRate.toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#b45309', backgroundColor: '#fffbeb' }}>
                        PKR {abcRate.toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#dc2626' }}>
                        PKR {minFloor.toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<IconEdit size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProductInPricing(p);
                          }}
                          style={{
                            color: '#047857',
                            backgroundColor: '#f0fdf4',
                            borderColor: '#bbf7d0',
                            fontSize: '12px',
                            height: '28px',
                            padding: '0 10px',
                          }}
                          title="Edit Finished Product (or Double-Click row)"
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 4: AUTHORITY GOVERNANCE                                */}
      {/* ========================================================== */}
      {activeTab === 'authority' && (
        <div>
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Role</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Max Discount %</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Can Set Net Rate</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Can Apply Special Rate</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Approval Required</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {authorityLimits.map((l) => (
                  <tr key={l.id || l.roleCode} style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {l.roleCode}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '14px',
                          color: Number(l.maxDiscountPct) >= 25 ? '#7c3aed' : '#059669',
                        }}
                      >
                        {Number(l.maxDiscountPct)}%
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {l.canSetNetRate ? (
                        <span style={{ color: '#059669', fontWeight: 700 }}>Allowed</span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Restricted</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {l.canApplySpecialRate ? (
                        <span style={{ color: '#059669', fontWeight: 700 }}>Allowed</span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Restricted</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {l.requiresApproval ? (
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '10px',
                            backgroundColor: '#fef3c7',
                            color: '#b45309',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          Requires Escalation
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '10px',
                            backgroundColor: '#ecfdf5',
                            color: '#047857',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          Self-Approving
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <Button variant="secondary" size="sm" onClick={() => handleOpenEditAuthority(l)}>
                        <IconEdit size={14} /> Configure
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 5: LIVE PRICE RESOLUTION SIMULATOR                     */}
      {/* ========================================================== */}
      {activeTab === 'simulator' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: '24px' }}>
          <Card>
            <CardHeader>
              <CardTitle>Authoritative Engine Simulator</CardTitle>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Select Dealer
                </label>
                <Select
                  value={simDealerId}
                  onChange={(e) => setSimDealerId(e.target.value)}
                  options={dealers.map((d) => ({ value: d.id, label: `${d.code} - ${d.name}` }))}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Select Finished Product
                </label>
                <Select
                  value={simProductId}
                  onChange={(e) => setSimProductId(e.target.value)}
                  options={allProducts.map((p) => ({
                    value: p.finishedProductId || p.id,
                    label: `${p.productCode} - ${p.productName} (Base: ${p.baseRate || p.defaultSellingPrice || 0} PKR)`,
                  }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Quantity
                  </label>
                  <Input
                    type="number"
                    value={simQuantity}
                    onChange={(e) => setSimQuantity(Math.max(1, Number(e.target.value)))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Payment Term
                  </label>
                  <Select
                    value={simPaymentTerm}
                    onChange={(e) => setSimPaymentTerm(e.target.value)}
                    options={[
                      { value: 'CASH', label: 'CASH' },
                      { value: 'CREDIT', label: 'CREDIT' },
                      { value: 'ADVANCE', label: 'ADVANCE' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Commercial Scheme (Requirement 15, 16)
                </label>
                <Select
                  value={simSchemeId}
                  onChange={(e) => setSimSchemeId(e.target.value)}
                  options={[
                    { value: '', label: '-- Standard Catalogue (No Scheme) --' },
                    ...schemes.map((s) => ({
                      value: s.id,
                      label: `${s.shortCode || s.code} - ${s.name} (${s.schemeTypeCode || 'SR'})`,
                    })),
                  ]}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Custom Requested Selling Rate (PKR)
                </label>
                <Input
                  type="number"
                  placeholder="Leave empty for scheme rate"
                  value={simRequestedRate}
                  onChange={(e) => setSimRequestedRate(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <Button variant="primary" onClick={handleRunSimulation} isLoading={isSimulating} style={{ marginTop: '8px' }}>
                Resolve Authoritative Price
              </Button>
            </CardContent>
          </Card>

          {/* Simulation Output Card */}
          <div>
            {simResult ? (
              <Card
                style={{
                  border: simResult.approvalRequired ? '2px solid #f59e0b' : '2px solid #10b981',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                }}
              >
                <CardHeader
                  style={{
                    backgroundColor: simResult.approvalRequired ? '#fffbeb' : '#f0fdf4',
                    borderBottom: '1px solid var(--border-default)',
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>
                        RESOLVED PRICE
                      </span>
                      <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 800 }}>
                        {simResult.productName}
                      </h3>
                    </div>
                    {simResult.approvalRequired ? (
                      <span
                        style={{
                          padding: '6px 12px',
                          borderRadius: '16px',
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          fontWeight: 800,
                          fontSize: '12px',
                        }}
                      >
                        Requires {simResult.authorityRequired} Approval
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: '6px 12px',
                          borderRadius: '16px',
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          fontWeight: 800,
                          fontSize: '12px',
                        }}
                      >
                        Self-Approved Rate
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent style={{ padding: '24px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '16px',
                      marginBottom: '24px',
                    }}
                  >
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--bg-subtle)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>BASE RATE</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
                        PKR {Number(simResult.baseRate || 0).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--bg-subtle)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        SCHEME UNIT RATE
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#047857', marginTop: '4px' }}>
                        PKR {Number(simResult.finalUnitRate || 0).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#f0fdf4' }}>
                      <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600 }}>TOTAL ORDER VALUE</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#047857', marginTop: '4px' }}>
                        PKR {Number(simResult.finalAmount || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      fontSize: '13px',
                      borderTop: '1px solid var(--border-default)',
                      paddingTop: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Applied Scheme:</span>
                      <strong>{simResult.schemeName || 'None (Base Rate)'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Unit Discount / Benefit:</span>
                      <strong style={{ color: '#059669' }}>
                        -PKR {Number(simResult.discountAmount || 0).toLocaleString()} ({simResult.discountPercent}%)
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Payment Term:</span>
                      <strong>{simResult.paymentTerm}</strong>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <div>
                  <IconPercent size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: 'var(--text-primary)' }}>
                    Authoritative Pricing Engine Ready
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px' }}>
                    Select dealer, product and scheme on the left to verify real-time price resolution from the database.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL: CREATE RATE LIST (First Field: Select Scheme)       */}
      {/* Requirements 6, 7, 8, 9, 10, 11, 14                        */}
      {/* ========================================================== */}
      <Modal
        isOpen={isRateListModalOpen}
        onClose={() => {
          setIsRateListModalOpen(false);
          setEditingRateList(null);
        }}
        title={editingRateList ? `Edit Rate List & Pricing: ${editingRateList.schemeShortCode || editingRateList.code}` : "Create Scheme Rate List"}
        size="xl"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* STEP 1: FIRST FIELD MUST BE SELECT SCHEME (Requirement 6, 7) */}
          <div
            style={{
              padding: '16px',
              backgroundColor: '#ecfdf5',
              borderRadius: '8px',
              border: '1.5px solid #a7f3d0',
            }}
          >
            <label
              style={{
                fontSize: '13px',
                fontWeight: 800,
                display: 'block',
                marginBottom: '6px',
                color: '#065f46',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              1. Select Scheme * (Searchable Dropdown)
            </label>

            {/* ── Searchable Scheme Combobox ── */}
            <div style={{ position: 'relative' }}>
              <input
                ref={schemeComboInputRef}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Type scheme code or name (e.g. MCCM, Mega Carnival, SR)…"
                value={schemeComboQuery}
                onChange={(e) => {
                  setSchemeComboQuery(e.target.value);
                  setSchemeComboOpen(true);
                  setSchemeComboHighlight(0);
                  // If user clears the field, reset scheme selection
                  if (!e.target.value.trim()) {
                    setRateListForm((prev) => ({
                      ...prev,
                      schemeId: '',
                      schemeShortCode: '',
                      schemeName: '',
                      schemeTypeCode: '',
                    }));
                    setRateListItems([]);
                    setSelectedSchemeInfo(null);
                  }
                }}
                onFocus={() => { setSchemeComboOpen(true); setSchemeComboHighlight(0); }}
                onBlur={() => setTimeout(() => setSchemeComboOpen(false), 160)}
                onKeyDown={handleSchemeComboKeyDown}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  border: rateListForm.schemeId
                    ? '2px solid #059669'
                    : '1.5px solid #a7f3d0',
                  borderRadius: '6px',
                  outline: 'none',
                  backgroundColor: '#fff',
                  boxSizing: 'border-box',
                }}
              />
              {/* Dropdown list */}
              {schemeComboOpen && schemeComboResults.length > 0 && (
                <ul
                  ref={schemeComboListRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    maxHeight: '240px',
                    overflowY: 'auto',
                    margin: '2px 0 0 0',
                    padding: 0,
                    listStyle: 'none',
                    backgroundColor: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  }}
                >
                  {schemeComboResults.map((s, idx) => {
                    const typeCode = s.schemeTypeCode || s.schemeTypeRef?.code || '';
                    const shortCode = s.shortCode || s.code;
                    const isHighlighted = idx === schemeComboHighlight;
                    return (
                      <li
                        key={s.id}
                        onMouseDown={() => {
                          setSchemeComboOpen(false);
                          handleSchemeSelectForRateList(s.id);
                          setTimeout(() => codeInputRef.current?.focus(), 80);
                        }}
                        onMouseEnter={() => setSchemeComboHighlight(idx)}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          backgroundColor: isHighlighted ? '#ecfdf5' : 'transparent',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 800,
                            backgroundColor: typeCode === 'NNR' ? '#f3e8ff' : typeCode === 'CA' ? '#fef9c3' : typeCode === 'ABC' ? '#e0f2fe' : '#ecfdf5',
                            color: typeCode === 'NNR' ? '#7e22ce' : typeCode === 'CA' ? '#92400e' : typeCode === 'ABC' ? '#0369a1' : '#065f46',
                            flexShrink: 0,
                          }}
                        >
                          {typeCode}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#059669', flexShrink: 0 }}>
                          {shortCode}
                        </span>
                        <span style={{ fontSize: '13px', color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </span>
                        {s.status === 'ACTIVE' && (
                          <span style={{ fontSize: '10px', color: '#059669', flexShrink: 0 }}>● ACTIVE</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {schemeComboOpen && schemeComboResults.length === 0 && schemeComboQuery.trim() && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    padding: '12px 14px',
                    backgroundColor: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '13px',
                    color: '#94a3b8',
                  }}
                >
                  No schemes found for &quot;{schemeComboQuery}&quot;
                </div>
              )}
            </div>

            {/* Keyboard hint */}
            <div style={{ fontSize: '11px', color: '#047857', marginTop: '6px', display: 'flex', gap: '12px' }}>
              <span>↓↑ navigate</span>
              <span>Enter select</span>
              <span>Esc close</span>
              <span style={{ marginLeft: 'auto' }}>Selecting a scheme auto-loads all active finished products with scheme-calculated rates.</span>
            </div>

            {/* Scheme Summary Card — shown after selection */}
            {selectedSchemeInfo && rateListForm.schemeId && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '10px 14px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '6px',
                  border: '1px solid #86efac',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '16px',
                  alignItems: 'center',
                  fontSize: '13px',
                }}
              >
                <span style={{ fontWeight: 800, color: '#065f46' }}>
                  ✓ {selectedSchemeInfo.name}
                </span>
                <span style={{ color: '#475569' }}>
                  Code: <strong>{selectedSchemeInfo.shortCode || selectedSchemeInfo.code}</strong>
                </span>
                <span style={{ color: '#475569' }}>
                  Type: <strong>{rateListForm.schemeTypeCode}</strong>
                </span>
                {(selectedSchemeInfo.defaultDiscountPct || selectedSchemeInfo.cashDiscountPct) > 0 && (
                  <span style={{ color: '#b45309', fontWeight: 700 }}>
                    Discount: {selectedSchemeInfo.defaultDiscountPct || selectedSchemeInfo.cashDiscountPct}%
                  </span>
                )}
                {selectedSchemeInfo.startDate && (
                  <span style={{ color: '#475569' }}>
                    Valid: {new Date(selectedSchemeInfo.startDate).toLocaleDateString()} → {selectedSchemeInfo.endDate ? new Date(selectedSchemeInfo.endDate).toLocaleDateString() : 'Ongoing'}
                  </span>
                )}
                <span style={{ fontWeight: 700, color: '#059669', marginLeft: 'auto' }}>
                  {rateListItems.length} Products
                </span>
              </div>
            )}
          </div>

          {/* Rate List Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Rate List Code *
              </label>
              <Input
                ref={codeInputRef}
                placeholder="e.g. RL-MCCM-2026"
                value={rateListForm.code}
                disabled={Boolean(editingRateList)}
                onChange={(e) => setRateListForm({ ...rateListForm, code: e.target.value.toUpperCase() })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    nameInputRef.current?.focus();
                  }
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Rate List Name *
              </label>
              <Input
                ref={nameInputRef}
                placeholder="e.g. Mega Carnival Open Mela Official Rate List"
                value={rateListForm.name}
                onChange={(e) => setRateListForm({ ...rateListForm, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    effectiveFromInputRef.current?.focus();
                  }
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Scheme Type
              </label>
              <Input value={rateListForm.schemeTypeCode || 'SR'} disabled />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Validity From *
              </label>
              <Input
                ref={effectiveFromInputRef}
                type="date"
                value={rateListForm.effectiveFrom}
                onChange={(e) => setRateListForm({ ...rateListForm, effectiveFrom: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    effectiveToInputRef.current?.focus();
                  }
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Validity To (Optional)
              </label>
              <Input
                ref={effectiveToInputRef}
                type="date"
                value={rateListForm.effectiveTo}
                onChange={(e) => setRateListForm({ ...rateListForm, effectiveTo: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (rateInputRefs.current[0]) {
                      rateInputRefs.current[0]?.focus();
                      rateInputRefs.current[0]?.select();
                    }
                  }
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
              <input
                type="checkbox"
                id="isMobileVisible"
                checked={rateListForm.isMobileVisible}
                onChange={(e) => setRateListForm({ ...rateListForm, isMobileVisible: e.target.checked })}
              />
              <label htmlFor="isMobileVisible" style={{ fontSize: '13px', fontWeight: 600 }}>
                Publish to Sales Officers Mobile
              </label>
            </div>
          </div>

          {/* STEP 2: FINISHED PRODUCTS AUTO-LOADED GRID (Requirements 7 - 11) */}
          <div
            style={{
              marginTop: '8px',
              padding: '16px',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>
                  2. Sellable Finished Products ({rateListItems.length} Products Auto-Loaded)
                </h4>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Only sellable finished products from FinishedProduct Master (No raw materials, packaging, cartons, or tape)
                </span>
              </div>

              {rateListItems.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Input
                    placeholder="Search product..."
                    style={{ width: '150px', padding: '4px 8px', fontSize: '12px' }}
                    value={rateListItemSearch}
                    onChange={(e) => setRateListItemSearch(e.target.value)}
                  />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#ecfdf5',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px solid #a7f3d0',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#065f46' }}>
                      Scheme Discount:
                    </span>
                    <input
                      type="number"
                      placeholder="0"
                      style={{
                        width: '60px',
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontWeight: 800,
                        color: '#065f46',
                        border: '1px solid #059669',
                        borderRadius: '6px',
                        textAlign: 'center',
                        outline: 'none',
                        backgroundColor: '#fff',
                      }}
                      value={bulkAdjustmentPct}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setBulkAdjustmentPct(val);
                        handleApplySchemeDiscount(Number(val) || 0);
                      }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#065f46' }}>% (Auto-Applied)</span>
                  </div>
                </div>
              )}
            </div>

            {isLoadingSchemeProducts ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ fontWeight: 600, color: '#047857' }}>Auto-loading active finished goods for scheme...</p>
              </div>
            ) : rateListItems.length === 0 ? (
              <div
                style={{
                  padding: '36px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: '6px',
                  border: '1px dashed var(--border-default)',
                }}
              >
                <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Please select a Scheme above to auto-generate the product rate list.
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  The user does NOT manually add products one by one. All active finished products are loaded automatically.
                </p>
              </div>
            ) : (
              <div style={{ maxHeight: '380px', overflowY: 'auto', borderRadius: '6px', border: '1px solid var(--border-default)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', backgroundColor: 'var(--bg-surface)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-subtle)', position: 'sticky', top: 0, borderBottom: '1px solid var(--border-default)', zIndex: 1 }}>
                      <th style={{ padding: '8px 6px', textAlign: 'center', width: '40px' }} title="Remove item">−</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '120px' }}>Code</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Product Name & Category</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '120px' }}>Batch #</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '120px' }}>Pack Size</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', width: '120px' }}>Base Price (PKR)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', width: '140px' }}>Scheme Rate (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModalItems.map((item, idx) => {
                      const basePrice = Number(item.baseRate || 0);
                      const schemeRate = item.schemeRate !== undefined && item.schemeRate !== null ? item.schemeRate : basePrice;

                      return (
                        <tr
                          key={item.finishedProductId || idx}
                          style={{
                            borderBottom: '1px solid var(--border-default)',
                            transition: 'background-color 0.1s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-subtle)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                            <button
                              type="button"
                              tabIndex={0}
                              aria-label={`Remove ${item.productName} from rate list`}
                              title="Remove product from rate list"
                              onClick={() => handleRemoveRateListItem(item.finishedProductId)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleRemoveRateListItem(item.finishedProductId);
                                }
                              }}
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                border: '1px solid #fca5a5',
                                backgroundColor: '#fee2e2',
                                color: '#dc2626',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '13px',
                                fontWeight: 800,
                                lineHeight: 1,
                                padding: 0,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#dc2626';
                                e.currentTarget.style.color = '#ffffff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#fee2e2';
                                e.currentTarget.style.color = '#dc2626';
                              }}
                            >
                              −
                            </button>
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: '#047857' }}>
                            {item.productCode}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.productName}</span>
                              <span style={getCategoryBadgeStyle(item.category || item.mType || 'General Formulation')}>
                                {item.category || item.mType || 'General Formulation'}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {item.packagingMaterial ? item.packagingMaterial : ''}
                              {item.packSize && item.packagingMaterial ? ' • ' : ''}
                              {item.packSize ? `Pack: ${item.packSize}` : ''}
                              {resolvePackSizeDisplay(item)}
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {item.batchNumber ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setBatchModalProduct({
                                    id: item.finishedProductId,
                                    productName: item.productName,
                                    productCode: item.productCode,
                                    packSize: item.packSize,
                                    category: item.category,
                                  });
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: '#f0fdf4',
                                  border: '1px solid #bbf7d0',
                                  color: '#166534',
                                  fontFamily: 'monospace',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                                title="Click to view/manage batches"
                              >
                                <span>{item.batchNumber}</span>
                                {item.isBatchExpired && (
                                  <span style={{ fontSize: '9px', color: '#dc2626' }}>Expired</span>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setBatchModalProduct({
                                    id: item.finishedProductId,
                                    productName: item.productName,
                                    productCode: item.productCode,
                                    packSize: item.packSize,
                                    category: item.category,
                                  });
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: '#f8fafc',
                                  border: '1px dashed #cbd5e1',
                                  color: '#64748b',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                }}
                                title="No batch assigned. Click to assign batch."
                              >
                                <IconPlus size={10} /> Add Batch
                              </button>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                            {item.packSize || item.unit || 'Standard'}
                            {resolvePackSizeDisplay(item)}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>
                            {basePrice.toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <input
                              ref={(el) => { rateInputRefs.current[idx] = el; }}
                              type="number"
                              value={schemeRate}
                              style={{
                                width: '120px',
                                padding: '5px 8px',
                                fontSize: '13px',
                                fontWeight: 700,
                                color: '#047857',
                                textAlign: 'right',
                                border: '1.5px solid #a7f3d0',
                                borderRadius: '4px',
                                outline: 'none',
                                backgroundColor: '#fff',
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = '#059669';
                                e.currentTarget.select();
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = '#a7f3d0';
                              }}
                              onChange={(e) => handleItemRateChange(idx, Number(e.target.value))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (idx + 1 < filteredModalItems.length) {
                                    rateInputRefs.current[idx + 1]?.focus();
                                    rateInputRefs.current[idx + 1]?.select();
                                  }
                                }
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setIsRateListModalOpen(false);
                setEditingRateList(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveRateList}
              style={{ backgroundColor: editingRateList ? '#2563eb' : '#059669' }}
            >
              {editingRateList ? 'Update Rate List & Pricing' : 'Save & Publish Rate List'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL: RATE LIST DETAIL & PRODUCTS (Requirements 19, 21)   */}
      {/* ========================================================== */}
      {selectedRateList && (
        <Modal
          isOpen={isRateListDetailModalOpen}
          onClose={() => setIsRateListDetailModalOpen(false)}
          title={`Rate List: ${selectedRateList.schemeName || selectedRateList.name} (${selectedRateList.schemeShortCode || selectedRateList.code})`}
          size="xl"
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                <div><strong>Scheme:</strong> {selectedRateList.schemeName || selectedRateList.name}</div>
                <div><strong>Short Code:</strong> {selectedRateList.schemeShortCode || selectedRateList.code}</div>
                <div><strong>Status:</strong> <StatusBadge status={selectedRateList.status} /></div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExportPdf(selectedRateList)}
                  style={{ color: '#047857' }}
                >
                  <IconPrinter size={14} /> Print / Export PDF
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAddNewProductsToRateList(selectedRateList.id)}
                >
                  <IconPlus size={14} /> Sync New Finished Goods
                </Button>
              </div>
            </div>

            {selectedRateList.versions?.map((ver: any) => (
              <div key={ver.id} style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: '8px',
                    fontWeight: 700,
                    marginBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Version {ver.versionNumber}.0 ({ver.status})</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Effective: {new Date(ver.effectiveFrom).toLocaleDateString()} to{' '}
                    {ver.effectiveTo ? new Date(ver.effectiveTo).toLocaleDateString() : 'Active/Indefinite'}
                  </span>
                </div>

                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ padding: '8px 12px' }}>Product Code</th>
                        <th style={{ padding: '8px 12px' }}>Sellable Finished Product</th>
                        <th style={{ padding: '8px 12px' }}>Batch #</th>
                        <th style={{ padding: '8px 12px' }}>Pack Size</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Base Price</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Discount</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Scheme Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ver.items || []).map((it: any) => {
                        const product = it.product || it.finishedProduct || {};
                        const activeBatch = product.batches?.find((b: any) => b.isActive) || product.batches?.[0];
                        const batchNumber = it.batchNumber || activeBatch?.batchNumber;
                        const basePrice = Number(it.basePrice || it.baseRate || product.defaultSellingPrice || 0);
                        const schemeRate = Number(it.schemeRate ?? it.customPrice ?? it.baseRate ?? 0);
                        const discount = Number(it.discountPercent || 0);

                        return (
                          <tr key={it.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#047857' }}>
                              {product.productCode || it.productCode || '-'}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {product.productName || it.productName || 'Product'}
                                </span>
                                <span style={getCategoryBadgeStyle(resolveProductCategory(product.mType ? product : (it.category ? it : product)))}>
                                  {resolveProductCategory(product.mType ? product : (it.category ? it : product))}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {batchNumber ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontFamily: 'monospace', fontSize: '11px', fontWeight: 700 }}>
                                  {batchNumber}
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '11px' }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                              {product.packSize ? `${product.packSize} ${product.packagingMaterial || ''}`.trim() : it.unit || '-'}
                              {resolvePackSizeDisplay(product, it)}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                              {basePrice > 0 ? `PKR ${basePrice.toLocaleString()}` : '-'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: discount > 0 ? '#1d4ed8' : '#64748b' }}>
                                {discount > 0 ? `${discount}%` : '-'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#047857' }}>
                              PKR {schemeRate.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <Button
                variant="primary"
                onClick={() => {
                  const rlToEdit = selectedRateList;
                  setIsRateListDetailModalOpen(false);
                  handleOpenEditRateList(rlToEdit);
                }}
                style={{ backgroundColor: '#2563eb' }}
              >
                <IconEdit size={14} /> Edit Rate List & Pricing
              </Button>
              <Button variant="secondary" onClick={() => setIsRateListDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================== */}
      {/* MODAL: CREATE NEW VERSION (Requirement 13)                 */}
      {/* ========================================================== */}
      {versionTargetRateList && (
        <Modal
          isOpen={isVersionModalOpen}
          onClose={() => setIsVersionModalOpen(false)}
          title={`Create New Version for ${versionTargetRateList.schemeShortCode || versionTargetRateList.code}`}
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Creates an incremental version that preserves historical transactions while updating active baseline prices from effective date.
            </p>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Effective From Date *
              </label>
              <Input
                type="date"
                value={newVersionForm.effectiveFrom}
                onChange={(e) => setNewVersionForm({ ...newVersionForm, effectiveFrom: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Effective To Date (Optional)
              </label>
              <Input
                type="date"
                value={newVersionForm.effectiveTo}
                onChange={(e) => setNewVersionForm({ ...newVersionForm, effectiveTo: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Version Notes
              </label>
              <Textarea
                rows={3}
                placeholder="e.g. Mid-season price adjustment for Rabi campaign"
                value={newVersionForm.notes}
                onChange={(e) => setNewVersionForm({ ...newVersionForm, notes: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button variant="secondary" onClick={() => setIsVersionModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveNewVersion}>
                Publish Version
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================== */}
      {/* MODAL: CREATE / EDIT SCHEME MASTER (Requirements 1 - 22)  */}
      {/* ========================================================== */}
      <Modal
        isOpen={isSchemeModalOpen}
        onClose={() => setIsSchemeModalOpen(false)}
        title={selectedScheme ? 'Edit Commercial Scheme' : 'Add Scheme Master'}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* STEP 1: SCHEME TYPE & PREDEFINED TYPE CODE (Requirements 2, 4) */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Scheme Type * (Searchable Dropdown)
                </label>
                <button
                  type="button"
                  onClick={() => setIsSchemeTypeModalOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#059669',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  + Add Scheme Type
                </button>
              </div>

              {/* Searchable Scheme Type Combobox */}
              <div style={{ position: 'relative' }}>
                <input
                  ref={schemeTypeComboInputRef}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Search scheme type (e.g. Seasonal, Advance Booking, CA)..."
                  value={schemeTypeComboQuery}
                  onChange={(e) => {
                    setSchemeTypeComboQuery(e.target.value);
                    setSchemeTypeComboOpen(true);
                    setSchemeTypeComboHighlight(0);
                  }}
                  onFocus={() => { setSchemeTypeComboOpen(true); setSchemeTypeComboHighlight(0); }}
                  onBlur={() => setTimeout(() => setSchemeTypeComboOpen(false), 160)}
                  onKeyDown={handleSchemeTypeComboKeyDown}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '13px',
                    border: schemeForm.schemeTypeId ? '2px solid #059669' : '1px solid var(--border-default)',
                    borderRadius: '6px',
                    outline: 'none',
                    backgroundColor: '#fff',
                    boxSizing: 'border-box',
                  }}
                />
                {schemeTypeComboOpen && schemeTypeComboResults.length > 0 && (
                  <ul
                    ref={schemeTypeListRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 9999,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      margin: '2px 0 0 0',
                      padding: 0,
                      listStyle: 'none',
                      backgroundColor: '#fff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    }}
                  >
                    {schemeTypeComboResults.map((t, idx) => {
                      const isHighlighted = idx === schemeTypeComboHighlight;
                      return (
                        <li
                          key={t.id}
                          onMouseDown={() => handleSelectSchemeType(t.id)}
                          onMouseEnter={() => setSchemeTypeComboHighlight(idx)}
                          style={{
                            padding: '9px 12px',
                            cursor: 'pointer',
                            backgroundColor: isHighlighted ? '#ecfdf5' : 'transparent',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 800,
                              backgroundColor: '#ecfdf5',
                              color: '#065f46',
                            }}
                          >
                            {t.code}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                            {t.name}
                          </span>
                          {t.defaultShortCode && (
                            <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto' }}>
                              Default: {t.defaultShortCode}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Type Code (Predefined/Automatic)
              </label>
              <Input
                value={schemeForm.schemeTypeCode}
                disabled
                style={{ backgroundColor: '#f8fafc', fontWeight: 700, color: '#047857' }}
              />
            </div>
          </div>

          {/* STEP 2: SCHEME NAME & SCHEME SHORT CODE (Requirements 5, 6, 7) */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Scheme Name * (Business/User-Friendly Name)
              </label>
              <Input
                ref={schemeNameInputRef}
                placeholder="e.g. Mega Carnival Open Mela, January Advance Booking 2027"
                value={schemeForm.name}
                onChange={(e) => setSchemeForm({ ...schemeForm, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    colStartInputRef.current?.focus();
                  }
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Auto-populated from Scheme Type, editable for individual campaign name.
              </span>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Scheme Short Code (Optional)
              </label>
              <Input
                ref={schemeShortCodeInputRef}
                placeholder="Optional e.g. MCCM"
                value={schemeForm.shortCode}
                onChange={(e) => setSchemeForm({ ...schemeForm, shortCode: e.target.value.toUpperCase() })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    colStartInputRef.current?.focus();
                  }
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Optional shortcut reference.
              </span>
            </div>
          </div>

          {/* STEP 3: FOUR DATES (Requirements 8, 9, 10) */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Validity Periods (Collection & Invoice Dates Kept Strictly Independent)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#0369a1' }}>
                  Collection Start Date *
                </label>
                <Input
                  ref={colStartInputRef}
                  type="date"
                  value={schemeForm.collectionStartDate}
                  onChange={(e) => setSchemeForm({ ...schemeForm, collectionStartDate: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      colEndInputRef.current?.focus();
                    }
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#0369a1' }}>
                  Collection End Date (Optional)
                </label>
                <Input
                  ref={colEndInputRef}
                  type="date"
                  value={schemeForm.collectionEndDate}
                  onChange={(e) => setSchemeForm({ ...schemeForm, collectionEndDate: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      invStartInputRef.current?.focus();
                    }
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#047857' }}>
                  Invoice Start Date *
                </label>
                <Input
                  ref={invStartInputRef}
                  type="date"
                  value={schemeForm.invoiceStartDate}
                  onChange={(e) => setSchemeForm({ ...schemeForm, invoiceStartDate: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      invEndInputRef.current?.focus();
                    }
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px', color: '#047857' }}>
                  Invoice End Date (Optional)
                </label>
                <Input
                  ref={invEndInputRef}
                  type="date"
                  value={schemeForm.invoiceEndDate}
                  onChange={(e) => setSchemeForm({ ...schemeForm, invoiceEndDate: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      discountInputRef.current?.focus();
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* STEP 4: COMMERCIAL FIELDS - SINGLE DISCOUNT %, PAYMENT TYPE, STATUS (Requirements 11, 13, 14, 15) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Discount % (Optional)
              </label>
              <Input
                ref={discountInputRef}
                type="number"
                placeholder="0"
                value={schemeForm.discountPct}
                onChange={(e) =>
                  setSchemeForm({
                    ...schemeForm,
                    discountPct: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveSchemeBtnRef.current?.focus();
                  }
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Default discount on products (0% if direct/net).
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>
                  Payment Type *
                </label>
                <button
                  type="button"
                  onClick={() => setIsPaymentTypeModalOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#059669',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  + Add Payment Type
                </button>
              </div>
              <Select
                value={schemeForm.paymentType}
                onChange={(valOrEvent: any) => {
                  const val = typeof valOrEvent === 'string' ? valOrEvent : valOrEvent?.target?.value || 'CASH';
                  setSchemeForm({ ...schemeForm, paymentType: val });
                }}
                options={paymentTypes.map((pt) => ({
                  value: String(pt.code),
                  label: `${pt.name} (${pt.code})`,
                }))}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Dynamic payment applicability (Cash, Credit, etc.).
              </span>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Status
              </label>
              <Select
                value={schemeForm.status}
                onChange={(valOrEvent: any) => {
                  const val = typeof valOrEvent === 'string' ? valOrEvent : valOrEvent?.target?.value || 'ACTIVE';
                  setSchemeForm({ ...schemeForm, status: val });
                }}
                options={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'DRAFT', label: 'Draft' },
                  { value: 'INACTIVE', label: 'Inactive' },
                  { value: 'EXPIRED', label: 'Expired' },
                ]}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Description / Notes (Optional)
            </label>
            <Textarea
              rows={2}
              placeholder="e.g. Mega Open Mela scheme applicable across all dealers for Rabi campaign"
              value={schemeForm.description}
              onChange={(e) => setSchemeForm({ ...schemeForm, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <Button variant="secondary" onClick={() => setIsSchemeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              ref={saveSchemeBtnRef}
              variant="primary"
              onClick={handleSaveScheme}
              style={{ backgroundColor: '#059669' }}
            >
              Save Scheme
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL: ADD SCHEME TYPE (Requirement 2 & 3)                 */}
      {/* ========================================================== */}
      <Modal
        isOpen={isSchemeTypeModalOpen}
        onClose={() => setIsSchemeTypeModalOpen(false)}
        title="Add Scheme Type"
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Create a new scheme type without code modification. Available immediately in Scheme Type dropdown.
          </p>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Scheme Type Name *
            </label>
            <Input
              placeholder="e.g. Seasonal Scheme, Advance Booking"
              value={schemeTypeForm.name}
              onChange={(e) => setSchemeTypeForm({ ...schemeTypeForm, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Type Code *
              </label>
              <Input
                placeholder="e.g. SR, ABC, CA"
                value={schemeTypeForm.code}
                onChange={(e) => setSchemeTypeForm({ ...schemeTypeForm, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Default Short Code (Optional)
              </label>
              <Input
                placeholder="e.g. SR"
                value={schemeTypeForm.defaultShortCode}
                onChange={(e) => setSchemeTypeForm({ ...schemeTypeForm, defaultShortCode: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Status
            </label>
            <Select
              value={schemeTypeForm.status}
              onChange={(e) => setSchemeTypeForm({ ...schemeTypeForm, status: e.target.value })}
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Description (Optional)
            </label>
            <Textarea
              rows={2}
              placeholder="Commercial description"
              value={schemeTypeForm.description}
              onChange={(e) => setSchemeTypeForm({ ...schemeTypeForm, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => setIsSchemeTypeModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveSchemeType} style={{ backgroundColor: '#059669' }}>
              Save Scheme Type
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL: ADD PAYMENT TYPE (Requirements 15, 16, 17)          */}
      {/* ========================================================== */}
      <Modal
        isOpen={isPaymentTypeModalOpen}
        onClose={() => setIsPaymentTypeModalOpen(false)}
        title="Add Payment Type"
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Create a new payment type dynamically (e.g. Advance, Bank, PDC). Available immediately without page refresh.
          </p>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Payment Type Name *
            </label>
            <Input
              placeholder="e.g. Advance, Bank Transfer, PDC"
              value={paymentTypeForm.name}
              onChange={(e) => setPaymentTypeForm({ ...paymentTypeForm, name: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Code *
            </label>
            <Input
              placeholder="e.g. ADVANCE, BANK, PDC"
              value={paymentTypeForm.code}
              onChange={(e) => setPaymentTypeForm({ ...paymentTypeForm, code: e.target.value.toUpperCase() })}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Status
            </label>
            <Select
              value={paymentTypeForm.status}
              onChange={(e) => setPaymentTypeForm({ ...paymentTypeForm, status: e.target.value })}
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Description (Optional)
            </label>
            <Textarea
              rows={2}
              placeholder="Payment terms description"
              value={paymentTypeForm.description}
              onChange={(e) => setPaymentTypeForm({ ...paymentTypeForm, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => setIsPaymentTypeModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSavePaymentType} style={{ backgroundColor: '#059669' }}>
              Save Payment Type
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL: EDIT AUTHORITY LIMIT                               */}
      {/* ========================================================== */}
      {selectedAuthority && (
        <Modal
          isOpen={isAuthorityModalOpen}
          onClose={() => setIsAuthorityModalOpen(false)}
          title={`Configure Discount Authority for ${authorityForm.roleCode}`}
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Maximum Allowed Discount %
              </label>
              <Input
                type="number"
                value={authorityForm.maxDiscountPct}
                onChange={(e) => setAuthorityForm({ ...authorityForm, maxDiscountPct: Number(e.target.value) })}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={authorityForm.canSetNetRate}
                  onChange={(e) => setAuthorityForm({ ...authorityForm, canSetNetRate: e.target.checked })}
                />
                <strong>Can Set Custom Net Rate</strong>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={authorityForm.canApplySpecialRate}
                  onChange={(e) => setAuthorityForm({ ...authorityForm, canApplySpecialRate: e.target.checked })}
                />
                <strong>Can Apply Special Rate Deals</strong>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={authorityForm.canApproveOwnOverride}
                  onChange={(e) => setAuthorityForm({ ...authorityForm, canApproveOwnOverride: e.target.checked })}
                />
                <strong>Can Approve Own Discount Override</strong>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button variant="secondary" onClick={() => setIsAuthorityModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveAuthority}>
                Save Authority Settings
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rate List Delete Confirmation Modal */}
      {rateListToDelete && (
        <Modal
          isOpen={Boolean(rateListToDelete)}
          onClose={() => setRateListToDelete(null)}
          title="Delete Rate List"
          size="sm"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#fef2f2',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <IconTrash size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  Confirm Rate List Deletion
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Are you sure you want to delete rate list <strong>{rateListToDelete.name || rateListToDelete.code}</strong> ({rateListToDelete.code})?
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setRateListToDelete(null)} disabled={isDeletingRateList}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmDeleteRateList}
                isLoading={isDeletingRateList}
                style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
              >
                Delete Rate List
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Scheme Delete Confirmation Modal */}
      {schemeToDelete && (
        <Modal
          isOpen={Boolean(schemeToDelete)}
          onClose={() => setSchemeToDelete(null)}
          title="Delete Commercial Scheme"
          size="sm"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#fef2f2',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <IconTrash size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  Confirm Scheme Deletion
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Are you sure you want to delete commercial scheme <strong>{schemeToDelete.name}</strong> ({schemeToDelete.shortCode || schemeToDelete.code})?
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setSchemeToDelete(null)} disabled={isDeletingScheme}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmDeleteScheme}
                isLoading={isDeletingScheme}
                style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
              >
                Delete Scheme
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Finished Product Modal */}
      <AddFinishedProductModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        onProductCreated={() => {
          setIsAddProductModalOpen(false);
          loadData();
        }}
      />

      {/* Edit Finished Product Modal */}
      {editingProductInPricing && (
        <AddFinishedProductModal
          isOpen={!!editingProductInPricing}
          onClose={() => setEditingProductInPricing(null)}
          productToEdit={editingProductInPricing}
          onProductUpdated={() => {
            setEditingProductInPricing(null);
            loadData();
          }}
        />
      )}

      {/* Product Batch Management Modal */}
      {batchModalProduct && (
        <AddBatchModal
          isOpen={Boolean(batchModalProduct)}
          onClose={() => setBatchModalProduct(null)}
          product={batchModalProduct}
          onBatchSaved={handleBatchSaved}
        />
      )}
    </div>
  );
};
