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
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';
import { exportRateListToPdf } from '../../lib/pdf-export';

export type PricingTab =
  | 'rate-lists'
  | 'schemes'
  | 'active-matrix'
  | 'authority'
  | 'simulator';

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
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    status: 'ACTIVE',
    defaultDiscountPct: '' as number | '',
    additionalBookingPct: '' as number | '',
    cashDiscountPct: '' as number | '',
    calculationMethod: 'ADDITIVE',
    paymentTerm: 'CASH',
    isMobileVisible: true,
    isMobileSelectable: true,
  });

  // Dynamic Scheme Type Modal State
  const [isSchemeTypeModalOpen, setIsSchemeTypeModalOpen] = useState(false);
  const [schemeTypeForm, setSchemeTypeForm] = useState({
    code: '',
    name: '',
    description: '',
  });

  // ==========================================================
  // RATE LIST CREATION STATE (Requirements 6 - 11, 13, 21)
  // ==========================================================
  const [isRateListModalOpen, setIsRateListModalOpen] = useState(false);
  const [selectedRateList, setSelectedRateList] = useState<any | null>(null);
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
      const [rateListsRes, schemesRes, schemeTypesRes, limitsRes, productsRes, dealersRes] =
        await Promise.all([
          ApiClient.get<any>('/api/v1/pricing/rate-lists'),
          ApiClient.get<any>('/api/v1/pricing/schemes'),
          ApiClient.get<any>('/api/v1/pricing/scheme-types'),
          ApiClient.get<any>('/api/v1/pricing/authority-limits'),
          ApiClient.get<any>('/api/v1/pricing/active-products'),
          ApiClient.get<any>('/api/v1/dealers'),
        ]);

      const rateListsData = rateListsRes.data?.data || rateListsRes.data || [];
      const schemesData = schemesRes.data?.data || schemesRes.data || [];
      const schemeTypesData = schemeTypesRes.data?.data || schemeTypesRes.data || [];
      const limitsData = limitsRes.data?.data || limitsRes.data || [];
      const productsData = productsRes.data?.data || productsRes.data || [];
      const dealersData = dealersRes.data?.data || dealersRes.data || [];

      setRateLists(Array.isArray(rateListsData) ? rateListsData : []);
      setSchemes(Array.isArray(schemesData) ? schemesData : []);
      setSchemeTypes(Array.isArray(schemeTypesData) ? schemeTypesData : []);
      setAuthorityLimits(Array.isArray(limitsData) ? limitsData : []);
      setAllProducts(Array.isArray(productsData) ? productsData : []);
      setDealers(Array.isArray(dealersData) ? dealersData : []);

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
      name: 'Seasonal Rate List',
    };

    setSchemeForm({
      schemeTypeId: defaultType.id || '',
      schemeTypeCode: defaultType.code,
      name: '',
      shortCode: '',
      code: '',
      description: '',
      startDate: new Date().toISOString().split('T')[0] as string,
      endDate: '',
      status: 'ACTIVE',
      defaultDiscountPct: '',
      additionalBookingPct: '',
      cashDiscountPct: '',
      calculationMethod: 'ADDITIVE',
      paymentTerm: 'CASH',
      isMobileVisible: true,
      isMobileSelectable: true,
    });
    setIsSchemeModalOpen(true);
  };

  const handleOpenEditScheme = (scheme: any) => {
    setSelectedScheme(scheme);
    const startStr = scheme.startDate
      ? new Date(scheme.startDate).toISOString().split('T')[0]
      : new Date(scheme.effectiveFrom || Date.now()).toISOString().split('T')[0];
    const endStr = scheme.endDate
      ? new Date(scheme.endDate).toISOString().split('T')[0]
      : scheme.effectiveTo
      ? new Date(scheme.effectiveTo).toISOString().split('T')[0]
      : '';

    setSchemeForm({
      schemeTypeId: scheme.schemeTypeId || '',
      schemeTypeCode: scheme.schemeTypeCode || scheme.schemeTypeRef?.code || 'SR',
      name: scheme.name || '',
      shortCode: scheme.shortCode || '',
      code: scheme.code || '',
      description: scheme.description || '',
      startDate: startStr || '',
      endDate: endStr || '',
      status: scheme.status || 'ACTIVE',
      defaultDiscountPct:
        scheme.defaultDiscountPct !== null && scheme.defaultDiscountPct !== undefined
          ? Number(scheme.defaultDiscountPct)
          : '',
      additionalBookingPct:
        scheme.additionalBookingPct !== null && scheme.additionalBookingPct !== undefined
          ? Number(scheme.additionalBookingPct)
          : '',
      cashDiscountPct:
        scheme.cashDiscountPct !== null && scheme.cashDiscountPct !== undefined
          ? Number(scheme.cashDiscountPct)
          : '',
      calculationMethod: scheme.calculationMethod || 'ADDITIVE',
      paymentTerm: scheme.paymentTerm || 'CASH',
      isMobileVisible: scheme.isMobileVisible ?? true,
      isMobileSelectable: scheme.isMobileSelectable ?? true,
    });
    setIsSchemeModalOpen(true);
  };

  const handleSchemeTypeChange = (typeId: string) => {
    const selected = schemeTypes.find((t) => t.id === typeId);
    if (selected) {
      setSchemeForm((prev) => ({
        ...prev,
        schemeTypeId: selected.id,
        schemeTypeCode: selected.code,
        // Set commercial hints based on type
        cashDiscountPct: selected.code === 'CA' ? 10 : prev.cashDiscountPct,
        additionalBookingPct: selected.code === 'ABC' ? 5 : prev.additionalBookingPct,
      }));
    }
  };

  const handleSaveScheme = async () => {
    if (!schemeForm.name.trim()) {
      showToast({ title: 'Validation Error', message: 'Scheme Name is required.', type: 'error' });
      return;
    }
    if (!schemeForm.shortCode.trim()) {
      showToast({ title: 'Validation Error', message: 'Scheme Short Code is required.', type: 'error' });
      return;
    }

    try {
      const generatedCode = `${schemeForm.schemeTypeCode}-${schemeForm.shortCode.toUpperCase()}`;
      const payload = {
        name: schemeForm.name.trim(),
        code: schemeForm.code || generatedCode,
        shortCode: schemeForm.shortCode.trim().toUpperCase(),
        schemeTypeId: schemeForm.schemeTypeId || undefined,
        schemeTypeCode: schemeForm.schemeTypeCode,
        description: schemeForm.description,
        startDate: schemeForm.startDate ? new Date(schemeForm.startDate).toISOString() : undefined,
        endDate: schemeForm.endDate ? new Date(schemeForm.endDate).toISOString() : undefined,
        status: schemeForm.status,
        defaultDiscountPct:
          schemeForm.defaultDiscountPct !== '' ? Number(schemeForm.defaultDiscountPct) : undefined,
        additionalBookingPct:
          schemeForm.additionalBookingPct !== '' ? Number(schemeForm.additionalBookingPct) : undefined,
        cashDiscountPct:
          schemeForm.cashDiscountPct !== '' ? Number(schemeForm.cashDiscountPct) : undefined,
        calculationMethod: schemeForm.calculationMethod,
        paymentTerm: schemeForm.paymentTerm,
        isMobileVisible: schemeForm.isMobileVisible,
        isMobileSelectable: schemeForm.isMobileSelectable,
      };

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
          message: `Scheme '${schemeForm.name}' (${schemeForm.shortCode}) created successfully.`,
          type: 'success',
        });
      }

      setIsSchemeModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error Saving Scheme', message: err.message, type: 'error' });
    }
  };

  const handleSaveSchemeType = async () => {
    if (!schemeTypeForm.code.trim() || !schemeTypeForm.name.trim()) {
      showToast({ title: 'Validation Error', message: 'Type Code and Name are required.', type: 'error' });
      return;
    }

    try {
      const res = await ApiClient.post<any>('/api/v1/pricing/scheme-types', {
        code: schemeTypeForm.code.trim().toUpperCase(),
        name: schemeTypeForm.name.trim(),
        description: schemeTypeForm.description.trim(),
      });
      const created = res.data?.data || res.data;
      showToast({
        title: 'Scheme Type Added',
        message: `Scheme Type '${created.name}' (${created.code}) created successfully.`,
        type: 'success',
      });
      setIsSchemeTypeModalOpen(false);
      setSchemeTypeForm({ code: '', name: '', description: '' });

      // Refresh scheme types
      const typesRes = await ApiClient.get<any>('/api/v1/pricing/scheme-types');
      const types = typesRes.data?.data || typesRes.data || [];
      setSchemeTypes(types);
    } catch (err: any) {
      showToast({ title: 'Error Creating Scheme Type', message: err.message, type: 'error' });
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

      // Map loaded products to editable rate list items
      const mappedItems = (products || []).map((p: any) => ({
        finishedProductId: p.finishedProductId,
        productCode: p.productCode,
        productName: p.productName,
        category: p.category,
        packagingMaterial: p.packagingMaterial,
        packSize: p.packSize,
        unit: p.unit || 'Unit',
        baseRate: Number(p.baseSellingPrice || 0),
        schemeRate: Number(p.schemeRate || p.baseSellingPrice || 0),
        discountPercent: Number(p.discountPercent || 0),
        rateType: p.rateType || 'DIRECT',
        minAllowedRate: Math.round(Number(p.schemeRate || p.baseSellingPrice || 0) * 0.8),
      }));

      setRateListItems(mappedItems);

      showToast({
        title: 'Finished Products Auto-Loaded',
        message: `Loaded ${mappedItems.length} sellable finished products for '${scheme.name}'.`,
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
   * Bulk Percentage Adjust on All Items in Modal
   */
  const handleApplyBulkAdjustment = () => {
    if (bulkAdjustmentPct === '' || isNaN(Number(bulkAdjustmentPct))) return;
    const pct = Number(bulkAdjustmentPct);
    const multiplier = 1 + pct / 100;

    setRateListItems((prev) =>
      prev.map((item) => {
        const newRate = Math.round(Number(item.schemeRate) * multiplier);
        const base = Number(item.baseRate) || 0;
        let discountPct = 0;
        if (base > 0 && newRate < base) {
          discountPct = Math.round(((base - newRate) / base) * 1000) / 10;
        }
        return {
          ...item,
          schemeRate: newRate,
          discountPercent: discountPct,
          minAllowedRate: Math.round(newRate * 0.8),
        };
      })
    );

    showToast({
      title: 'Bulk Adjustment Applied',
      message: `Adjusted all ${rateListItems.length} product rates by ${pct > 0 ? '+' : ''}${pct}%.`,
      type: 'info',
    });
    setBulkAdjustmentPct('');
  };

  /**
   * Save & Publish Rate List with Duplicate Rate Protection (Requirement 12, 14)
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
      await ApiClient.post('/api/v1/pricing/rate-lists', {
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
          baseRate: it.baseRate,
          schemeRate: it.schemeRate,
          discountPercent: it.discountPercent,
          rateType: it.rateType,
          minAllowedRate: it.minAllowedRate,
        })),
      });

      showToast({
        title: 'Rate List Created',
        message: `Rate list '${rateListForm.code}' published successfully with ${rateListItems.length} finished products.`,
        type: 'success',
      });
      setIsRateListModalOpen(false);
      loadData();
    } catch (err: any) {
      // Duplicate rate protection warning
      showToast({
        title: 'Error Saving Rate List',
        message: err.message || 'Duplicate active rate list already exists for this scheme and validity period.',
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
  const handleExportPdf = (rl: any) => {
    exportRateListToPdf(rl);
    showToast({
      title: 'Rate List PDF',
      message: `Print document opened for ${rl.schemeName || rl.name}.`,
      type: 'info',
    });
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
    const q = rateListItemSearch.toLowerCase();
    return rateListItems.filter(
      (it) =>
        (it.productName || '').toLowerCase().includes(q) ||
        (it.productCode || '').toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q)
    );
  }, [rateListItems, rateListItemSearch]);

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
                        style={{
                          borderBottom: '1px solid var(--border-default)',
                          transition: 'background 0.15s ease',
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
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '18px',
            }}
          >
            {filteredSchemes.map((sc) => {
              const typeCode = sc.schemeTypeCode || sc.schemeTypeRef?.code || 'SR';
              const typeName = sc.schemeTypeRef?.name || typeCode;
              const shortCode = sc.shortCode || sc.code;
              const status = sc.computedStatus || sc.status || 'ACTIVE';
              const attachedRateLists = rateLists.filter((rl) => rl.schemeId === sc.id);

              return (
                <Card key={sc.id} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <CardHeader
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      borderBottom: '1px solid var(--border-default)',
                      paddingBottom: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 900,
                            color: '#047857',
                            backgroundColor: '#ecfdf5',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #a7f3d0',
                          }}
                        >
                          {shortCode}
                        </span>
                        <StatusBadge status={status} />
                      </div>
                      <CardTitle style={{ fontSize: '16px', fontWeight: 800, marginTop: '6px' }}>
                        {sc.name}
                      </CardTitle>
                    </div>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                      }}
                    >
                      {typeName} ({typeCode})
                    </span>
                  </CardHeader>
                  <CardContent style={{ flex: 1, paddingTop: '14px', fontSize: '13px' }}>
                    {sc.description && (
                      <p style={{ color: 'var(--text-secondary)', margin: '0 0 14px 0', fontSize: '12px' }}>
                        {sc.description}
                      </p>
                    )}

                    {/* Commercial Benefit Parameters */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                        COMMERCIAL TERMS
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {sc.defaultDiscountPct > 0 && (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                            }}
                          >
                            Default: {Number(sc.defaultDiscountPct)}%
                          </span>
                        )}
                        {sc.cashDiscountPct > 0 && (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: '#ecfdf5',
                              color: '#047857',
                            }}
                          >
                            Cash Discount: {Number(sc.cashDiscountPct)}%
                          </span>
                        )}
                        {sc.additionalBookingPct > 0 && (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                            }}
                          >
                            Booking Benefit: {Number(sc.additionalBookingPct)}%
                          </span>
                        )}
                        {typeCode === 'NNR' && (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: '#f3e8ff',
                              color: '#7e22ce',
                            }}
                          >
                            Direct Net Net Pricing
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata details */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-subtle)',
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        marginBottom: '14px',
                      }}
                    >
                      <div>
                        <strong>Validity Start:</strong>{' '}
                        {new Date(sc.startDate || sc.effectiveFrom).toLocaleDateString()}
                      </div>
                      <div>
                        <strong>Validity End:</strong>{' '}
                        {sc.endDate || sc.effectiveTo
                          ? new Date(sc.endDate || sc.effectiveTo).toLocaleDateString()
                          : 'Ongoing'}
                      </div>
                      <div>
                        <strong>Mobile:</strong>{' '}
                        {sc.isMobileVisible ? <span style={{ color: '#059669' }}>Published</span> : 'Internal'}
                      </div>
                      <div>
                        <strong>Rate Lists:</strong>{' '}
                        <span style={{ fontWeight: 700, color: attachedRateLists.length > 0 ? '#047857' : '#d97706' }}>
                          {attachedRateLists.length > 0 ? `${attachedRateLists.length} Attached` : 'Pending'}
                        </span>
                      </div>
                    </div>

                    {/* Quick Action buttons */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <Button variant="secondary" size="sm" onClick={() => handleOpenEditScheme(sc)}>
                        <IconEdit size={14} /> Edit
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenCreateRateList(sc.id)}
                        style={{ backgroundColor: '#059669' }}
                      >
                        <IconLayers size={14} /> + Rate List
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
              marginBottom: '18px',
            }}
          >
            <strong>Centralized Finished Product Master:</strong> Showing active sellable finished products only (no raw materials, packing materials, bottles, cartons, or tape). Each finished product can have scheme-wise rates configured across active rate lists.
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
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Base Selling Price</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, backgroundColor: '#ecfdf5' }}>CA (-10%)</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700, backgroundColor: '#fef3c7' }}>ABC (-15%)</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Min Allowed Floor</th>
                </tr>
              </thead>
              <tbody>
                {allProducts.map((p) => {
                  const base = Number(p.baseRate || p.defaultSellingPrice || 0);
                  const caRate = Math.round(base * 0.9);
                  const abcRate = Math.round(base * 0.85);
                  const minFloor = Number(p.minAllowedRate || Math.round(base * 0.75));

                  return (
                    <tr key={p.finishedProductId || p.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#047857' }}>
                        {p.productCode}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>{p.productName}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                        {p.category || 'Finished Goods'}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                        {p.packSize ? `${p.packSize} ${p.packagingMaterial || ''}`.trim() : p.unit || 'Unit'}
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
        onClose={() => setIsRateListModalOpen(false)}
        title="Create Scheme Rate List"
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
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <Input
                      type="number"
                      placeholder="±%"
                      style={{ width: '70px', padding: '4px 8px', fontSize: '12px' }}
                      value={bulkAdjustmentPct}
                      onChange={(e) => setBulkAdjustmentPct(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                    <Button variant="secondary" size="sm" onClick={handleApplyBulkAdjustment}>
                      Adjust All
                    </Button>
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
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '130px' }}>Pack Size</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', width: '130px' }}>Base Price (PKR)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', width: '150px' }}>Scheme Rate (PKR)</th>
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
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.productName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {item.category || 'Finished Good'} {item.packagingMaterial ? `• ${item.packagingMaterial}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                            {item.packSize || item.unit || 'Standard'}
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
            <Button variant="secondary" onClick={() => setIsRateListModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveRateList} style={{ backgroundColor: '#059669' }}>
              Save & Publish Rate List
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
                        <th style={{ padding: '8px 12px' }}>Pack Size</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Base Price</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Discount</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Scheme Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ver.items || []).map((it: any) => {
                        const product = it.product || it.finishedProduct || {};
                        const basePrice = Number(it.basePrice || it.baseRate || product.defaultSellingPrice || 0);
                        const schemeRate = Number(it.schemeRate ?? it.customPrice ?? it.baseRate ?? 0);
                        const discount = Number(it.discountPercent || 0);

                        return (
                          <tr key={it.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#047857' }}>
                              {product.productCode || it.productCode || '-'}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                              {product.productName || it.productName || 'Product'}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                              {product.packSize ? `${product.packSize} ${product.packagingMaterial || ''}`.trim() : it.unit || '-'}
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
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
      {/* MODAL: CREATE / EDIT SCHEME MASTER (Requirements 1 - 5)   */}
      {/* ========================================================== */}
      <Modal
        isOpen={isSchemeModalOpen}
        onClose={() => setIsSchemeModalOpen(false)}
        title={selectedScheme ? 'Edit Commercial Scheme' : 'Add Scheme Master'}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Scheme Type & Predefined Type Code */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>
                  Scheme Type *
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
              <Select
                value={schemeForm.schemeTypeId}
                onChange={(e) => handleSchemeTypeChange(e.target.value)}
                options={schemeTypes.map((t) => ({
                  value: t.id,
                  label: `${t.name} (${t.code})`,
                }))}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Type Code (Predefined)
              </label>
              <Input value={schemeForm.schemeTypeCode} disabled />
            </div>
          </div>

          {/* Scheme Name & Scheme Short Code */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Scheme Name * (Business/User-Friendly Name)
              </label>
              <Input
                placeholder="e.g. Mega Carnival Open Mela, January Advance Booking 2027"
                value={schemeForm.name}
                onChange={(e) => setSchemeForm({ ...schemeForm, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Scheme Short Code *
              </label>
              <Input
                placeholder="e.g. MCCM, ABC-27"
                value={schemeForm.shortCode}
                onChange={(e) => setSchemeForm({ ...schemeForm, shortCode: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          {/* Dates & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Start Date *
              </label>
              <Input
                type="date"
                value={schemeForm.startDate}
                onChange={(e) => setSchemeForm({ ...schemeForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                End Date (Optional)
              </label>
              <Input
                type="date"
                value={schemeForm.endDate}
                onChange={(e) => setSchemeForm({ ...schemeForm, endDate: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Status
              </label>
              <Select
                value={schemeForm.status}
                onChange={(e) => setSchemeForm({ ...schemeForm, status: e.target.value })}
                options={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'SCHEDULED', label: 'Scheduled' },
                  { value: 'DRAFT', label: 'Draft' },
                  { value: 'EXPIRED', label: 'Expired' },
                  { value: 'INACTIVE', label: 'Inactive' },
                ]}
              />
            </div>
          </div>

          {/* Optional Commercial Fields (Requirement 5) */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              OPTIONAL COMMERCIAL PARAMETERS (Auto-Populates Rate Calculations)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Default Discount %
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 15"
                  value={schemeForm.defaultDiscountPct}
                  onChange={(e) =>
                    setSchemeForm({
                      ...schemeForm,
                      defaultDiscountPct: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Cash Discount % (CA)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 10"
                  value={schemeForm.cashDiscountPct}
                  onChange={(e) =>
                    setSchemeForm({
                      ...schemeForm,
                      cashDiscountPct: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Additional Booking % (ABC)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 5"
                  value={schemeForm.additionalBookingPct}
                  onChange={(e) =>
                    setSchemeForm({
                      ...schemeForm,
                      additionalBookingPct: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Description / Notes
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
            <Button variant="primary" onClick={handleSaveScheme} style={{ backgroundColor: '#059669' }}>
              Save Scheme
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL: ADD SCHEME TYPE (Requirement 2 - Dynamic Types)     */}
      {/* ========================================================== */}
      <Modal
        isOpen={isSchemeTypeModalOpen}
        onClose={() => setIsSchemeTypeModalOpen(false)}
        title="Add Dynamic Scheme Type"
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Create a new scheme type to support future commercial structures without modifying codebase.
          </p>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Scheme Type Code * (e.g. FLR, DL, VIP)
            </label>
            <Input
              placeholder="e.g. VIP"
              value={schemeTypeForm.code}
              onChange={(e) => setSchemeTypeForm({ ...schemeTypeForm, code: e.target.value.toUpperCase() })}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Scheme Type Name *
            </label>
            <Input
              placeholder="e.g. VIP Club Rate List"
              value={schemeTypeForm.name}
              onChange={(e) => setSchemeTypeForm({ ...schemeTypeForm, name: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Description
            </label>
            <Textarea
              rows={2}
              placeholder="Commercial logic and description"
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
    </div>
  );
};
