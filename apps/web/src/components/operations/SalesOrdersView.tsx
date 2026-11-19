'use client';

/**
 * SHEHSWAR ONE360 - Sales Orders Management UI
 *
 * Follows Canonical Flow:
 * - Single Shared Record: Orders booked on Mobile App appear here instantly.
 * - Approval Workflow: Manager Approves/Rejects order. Mobile officer gets instant status update.
 * - Conversion to Sale: APPROVED order converted to Sales Invoice (Stock deducted, Dealer ledger debited).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ListPageTemplate, DetailPageTemplate, FormPageTemplate } from '../templates';
import {
  DataTable,
  ColumnDef,
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
  SearchableCombobox,
} from '../ui';
import {
  IconPlus,
  IconCheck,
  IconEye,
  IconTrash,
  IconEdit,
  IconMoreVertical,
  IconClose,
  IconFileText,
  IconAlertTriangle,
} from '../icons';
import { useToast } from '../../context/toast-context';
import { useCompany } from '../../context/company-context';
import { ApiClient } from '../../lib/api-client';
import { SalesInvoiceModal } from './SalesInvoiceModal';
import { SalesInvoiceExportData } from '../../lib/pdf-export';
import { cleanPackSize } from './PurchaseOrdersView';

export interface SalesOrderItemRow {
  finishedProductId?: string;
  productCode?: string;
  productName: string;
  packSize?: string;
  packing?: string;
  batchId?: string;
  batchNumber?: string;
  schemeId?: string;
  rateListId?: string;
  quantity: number;
  baseRate?: number;
  discountPercent?: number;
  discountAmount?: number;
  freeQuantity?: number;
  unitPrice: number;
  totalPrice: number;
  commercialCondition?: string;
  originalQuantity?: number;
  availableStock?: number;
  availableBatches?: any[];
}

export interface SalesOrderRecord {
  id: string;
  orderNumber: string;
  companyId?: string;
  orderDate: string;
  dealerId: string;
  salesOfficerId?: string;
  paymentTerm?: string;
  rateListId?: string;
  schemeId?: string;
  appliedSchemeName?: string;
  discountAmount?: number;
  freeQuantityTotal?: number;
  dealer?: { id: string; name: string; code: string; currentBalance?: number; creditLimit?: number };
  salesOfficer?: { id: string; firstName?: string; lastName?: string; name?: string };
  warehouseId?: string;
  totalAmount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED_TO_SALE';
  rejectionReason?: string;
  notes?: string;
  items?: SalesOrderItemRow[];
}

export interface SalesOrdersViewProps {
  onNavigateToInvoices?: () => void;
  initialDealerId?: string | null;
  onClearDealerId?: () => void;
}

export const SalesOrdersView: React.FC<SalesOrdersViewProps> = ({
  onNavigateToInvoices,
  initialDealerId,
  onClearDealerId,
}) => {
  const { showToast } = useToast();
  const { activeCompanyId, activeCompanyName } = useCompany();

  const [orders, setOrders] = useState<SalesOrderRecord[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrderRecord | null>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'create'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Convert to Sale Modal State
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [orderToConvert, setOrderToConvert] = useState<SalesOrderRecord | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [convertItems, setConvertItems] = useState<SalesOrderItemRow[]>([]);
  const [isResolvingConvertPricing, setIsResolvingConvertPricing] = useState(false);
  const [isConvertingToSale, setIsConvertingToSale] = useState(false);

  // Customize Order Modal State (Manager adjusts requested quantity e.g. 100 -> 50)
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [orderToCustomize, setOrderToCustomize] = useState<SalesOrderRecord | null>(null);
  const [customizeItems, setCustomizeItems] = useState<SalesOrderItemRow[]>([]);
  const [customizeWarehouseId, setCustomizeWarehouseId] = useState('');
  const [customizeNotes, setCustomizeNotes] = useState('');
  const [customizeSchemeId, setCustomizeSchemeId] = useState('');
  const [customizeRateListId, setCustomizeRateListId] = useState('');
  const [customizePaymentTerm, setCustomizePaymentTerm] = useState('CASH');
  const [isResolvingCustomizePricing, setIsResolvingCustomizePricing] = useState(false);
  const [isSavingCustomization, setIsSavingCustomization] = useState(false);

  // Sales Invoice Preview & PDF Modal State
  const [activeInvoice, setActiveInvoice] = useState<SalesInvoiceExportData | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Direct Invoice generation on Order creation
  const [generateInvoiceImmediately, setGenerateInvoiceImmediately] = useState(true);

  // Reject Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [orderToReject, setOrderToReject] = useState<SalesOrderRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Floating Action Portal State
  const [isMounted, setIsMounted] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{
    id: string;
    order: SalesOrderRecord;
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!menuAnchor) return;

    const handleClose = (e: MouseEvent | Event) => {
      if ((e.target as HTMLElement).closest?.('[data-order-actions-portal]')) {
        return;
      }
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
  }, [menuAnchor]);

  // Create Order Form State
  const [formData, setFormData] = useState({
    dealerId: '',
    orderDate: new Date().toISOString().split('T')[0],
    warehouseId: '',
    paymentTerm: 'CASH',
    rateListId: '',
    schemeId: '',
    notes: '',
  });
  const [rateLists, setRateLists] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [dealerHierarchy, setDealerHierarchy] = useState<any | null>(null);

  const companyWarehouses = React.useMemo(() => {
    return activeCompanyId
      ? warehouses.filter((w) => !w.companyId || w.companyId === activeCompanyId)
      : warehouses;
  }, [warehouses, activeCompanyId]);

  const companyDealers = React.useMemo(() => {
    return dealers.filter((d) => {
      if (activeCompanyId && d.companyId && d.companyId !== activeCompanyId) return false;
      if (d.code && (d.code.startsWith('IC-') || d.code.startsWith('IC-D-'))) return false;
      if (activeCompanyName && d.name && d.name.toLowerCase() === activeCompanyName.toLowerCase()) return false;
      return true;
    });
  }, [dealers, activeCompanyId, activeCompanyName]);

  const dealerOptions = React.useMemo(() => {
    return companyDealers.map((d) => {
      const terrCode = d.territory?.code || '';
      const terrName = d.territory?.name || '';
      const zoneName = d.territory?.zone?.name || '';
      const regName = d.territory?.zone?.region?.name || '';
      let prov = 'Punjab';
      const regLow = (regName || '').toLowerCase();
      const cityLow = (d.city || '').toLowerCase();
      const addrLow = (d.address || '').toLowerCase();
      if (/sindh/i.test(regLow) || /karachi|hyderabad|sukkur|larkana/i.test(cityLow + ' ' + addrLow)) {
        prov = 'Sindh';
      } else if (/kpk|khyber/i.test(regLow) || /peshawar|mardan|swat|abbottabad/i.test(cityLow + ' ' + addrLow)) {
        prov = 'KPK';
      } else if (/baloch/i.test(regLow) || /quetta/i.test(cityLow + ' ' + addrLow)) {
        prov = 'Balochistan';
      } else if (/islamabad/i.test(regLow) || /islamabad/i.test(cityLow + ' ' + addrLow)) {
        prov = 'Islamabad';
      }

      const shopName = (d.businessName || '').trim();
      const dealerName = (d.name || '').trim() || shopName;
      const dealerCode = (d.code || '').trim();
      const addressParts = [d.address?.trim(), d.city?.trim()].filter(Boolean).join(', ');
      const soName = d.assignedOfficer
        ? `${d.assignedOfficer.firstName || ''} ${d.assignedOfficer.lastName || ''}`.trim()
        : (d.territory?.salesOfficer
          ? `${d.territory.salesOfficer.firstName || ''} ${d.territory.salesOfficer.lastName || ''}`.trim()
          : (d.territory?.manager
            ? `${d.territory.manager.firstName || ''} ${d.territory.manager.lastName || ''}`.trim()
            : ''));

      // Structure:
      // ABC Traders · DL-000125
      // Shop: ABC Agro Store · Main Bazar, Chiniot
      // CH · Chiniot · Faisalabad · Central
      // SO: Ahmed
      const hierarchyLine = [terrCode, terrName, zoneName, regName].filter(Boolean).join(' · ');
      const subtextParts = [
        shopName ? `Shop: ${shopName}${addressParts ? ` · ${addressParts}` : ''}` : (addressParts ? `Address: ${addressParts}` : ''),
        hierarchyLine,
        soName ? `SO: ${soName}` : '',
      ].filter(Boolean);

      return {
        value: d.id,
        label: `${dealerName}${dealerCode ? ` · ${dealerCode}` : ''}`,
        subtext: subtextParts.join('\n'),
        badge: terrCode || undefined,
        searchTerms: `${dealerName} ${dealerCode} ${shopName} ${d.businessName || ''} ${d.address || ''} ${d.city || ''} ${d.phone || ''} ${terrCode} ${terrName} ${zoneName} ${regName} ${prov} ${soName}`,
      };
    });
  }, [companyDealers]);

  const companyProducts = React.useMemo(() => {
    return activeCompanyId
      ? products.filter((p) => !p.companyId || p.companyId === activeCompanyId)
      : products;
  }, [products, activeCompanyId]);

  const companySchemes = React.useMemo(() => {
    return schemes;
  }, [schemes]);

  const productOptions = React.useMemo(() => {
    return companyProducts.map((p) => {
      const cleanName = (p.productName || 'Unnamed Product').trim();
      return {
        value: String(p.id),
        label: cleanName,
        searchTerms: `${cleanName} ${p.productCode || ''} ${p.sku || ''}`,
      };
    });
  }, [companyProducts]);

  const schemeOptions = React.useMemo(() => {
    return companySchemes.map((s) => {
      const codeOnly = (s.shortCode || s.code || 'SCHEME').trim();
      return {
        value: s.id,
        label: codeOnly,
        searchTerms: `${codeOnly} ${s.name || s.schemeName || ''} ${s.description || ''}`,
      };
    });
  }, [companySchemes]);

  const rateListOptions = React.useMemo(() => {
    return [
      { label: 'Master Catalogue Rates (Standard)', value: '' },
      ...rateLists.map((rl) => {
        const isParent = activeCompanyId && rl.companyId && rl.companyId !== activeCompanyId;
        return {
          value: rl.id,
          label: `${rl.code} — ${rl.name}${isParent ? ' [Parent Group]' : ''}`,
          subtext: rl.description || (rl.scheme ? `Linked Scheme: ${rl.scheme.name || rl.scheme.code}` : undefined),
        };
      }),
    ];
  }, [rateLists, activeCompanyId]);

  const handleDealerChange = (dealerId: string) => {
    if (activeCompanyId && dealerId === activeCompanyId) {
      showToast({
        title: 'Invalid Dealer Selection',
        message: 'The active company cannot be selected as a customer dealer. Please select a commercial dealer.',
        type: 'error',
      });
      return;
    }
    setFormData((prev) => ({ ...prev, dealerId }));
    if (!dealerId) {
      setDealerHierarchy(null);
      return;
    }
    ApiClient.get<any>(`/api/v1/dealers/${dealerId}/market-hierarchy`)
      .then((res) => {
        setDealerHierarchy(res.data?.data || res.data);
      })
      .catch(() => setDealerHierarchy(null));
  };

  const [formItems, setFormItems] = useState<SalesOrderItemRow[]>([
    {
      finishedProductId: '',
      productName: '',
      quantity: 1,
      baseRate: 0,
      discountPercent: 0,
      discountAmount: 0,
      freeQuantity: 0,
      unitPrice: 0,
      totalPrice: 0,
    },
  ]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const compParam = activeCompanyId ? `?companyId=${activeCompanyId}` : '';
      const [orderRes, dealerRes, whRes, prodRes, schemesRes, rateListsRes] = await Promise.all([
        ApiClient.get<any>(`/api/v1/sales-orders${compParam}`).catch(() => ({ data: [] })),
        ApiClient.get<any>(`/api/v1/dealers${compParam}`).catch(() => ({ data: [] })),
        ApiClient.get<any>(`/api/v1/master-data/warehouses${compParam}`).catch(() => ({ data: [] })),
        ApiClient.get<any>(`/api/v1/master-data/finished-products${compParam}`).catch(() => ({ data: [] })),
        ApiClient.get<any>(`/api/v1/pricing/schemes${compParam}`).catch(() => ({ data: [] })),
        ApiClient.get<any>(`/api/v1/pricing/rate-lists${compParam}`).catch(() => ({ data: [] })),
      ]);

      const parsedOrders = Array.isArray(orderRes.data)
        ? orderRes.data
        : (orderRes as any)?.data?.data || (orderRes as any)?.data || [];
      const parsedDealers = Array.isArray(dealerRes.data)
        ? dealerRes.data
        : (dealerRes as any)?.data?.data || (dealerRes as any)?.data || [];
      const parsedWarehouses = Array.isArray(whRes.data)
        ? whRes.data
        : (whRes as any)?.data?.data || (whRes as any)?.data || [];
      const parsedProducts = Array.isArray(prodRes.data)
        ? prodRes.data
        : (prodRes as any)?.data?.data || (prodRes as any)?.items || (prodRes as any)?.data || [];
      const parsedSchemes = Array.isArray(schemesRes.data)
        ? schemesRes.data
        : (schemesRes as any)?.data?.data || (schemesRes as any)?.data || [];
      const parsedRateLists = Array.isArray(rateListsRes.data)
        ? rateListsRes.data
        : (rateListsRes as any)?.data?.data || (rateListsRes as any)?.data || [];

      setOrders(parsedOrders);
      setDealers(parsedDealers);
      setWarehouses(parsedWarehouses);
      setProducts(parsedProducts);
      setSchemes(parsedSchemes);
      setRateLists(parsedRateLists);
    } catch (err: any) {
      showToast({ title: 'Error', message: 'Failed to load sales orders', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [showToast, activeCompanyId]);

  useEffect(() => {
    loadData();
  }, [loadData, activeCompanyId]);

  useEffect(() => {
    if (initialDealerId) {
      setMode('create');
      handleDealerChange(initialDealerId);
      onClearDealerId?.();
    }
  }, [initialDealerId]);

  // Set default warehouse when entering create mode
  useEffect(() => {
    if (mode === 'create') {
      if (!formData.warehouseId && companyWarehouses.length > 0) {
        setFormData((prev) => ({ ...prev, warehouseId: companyWarehouses[0].id }));
      }
    }
  }, [mode, companyWarehouses]);

  // Fetch batches for product in warehouse
  const fetchBatchesForLine = async (idx: number, productId: string, warehouseId?: string) => {
    if (!productId) return;
    try {
      const wh = warehouseId || formData.warehouseId || companyWarehouses[0]?.id;
      const whParam = wh ? `?warehouseId=${encodeURIComponent(wh)}` : '';
      const res = await ApiClient.get<any>(`/api/v1/batches/product/${productId}${whParam}`);
      const batchList = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setFormItems((prev) => {
        const next = [...prev];
        if (next[idx]) {
          const validBatches = batchList.filter((b: any) => !b.isExpired);
          const firstWithStock = validBatches.find((b: any) => Number(b.availableQuantity) > 0) || validBatches[0];
          next[idx] = {
            ...next[idx],
            availableBatches: batchList,
            batchId: next[idx].batchId || (firstWithStock ? firstWithStock.id : undefined),
            batchNumber: next[idx].batchNumber || (firstWithStock ? firstWithStock.batchNumber : undefined),
          };
        }
        return next;
      });
    } catch {
      // batch fetch failure fallback
    }
  };

  const handleWarehouseChange = (warehouseId: string) => {
    setFormData((prev) => ({ ...prev, warehouseId }));
    formItems.forEach((it, idx) => {
      if (it.finishedProductId) {
        fetchBatchesForLine(idx, it.finishedProductId, warehouseId);
      }
    });
  };

  // (Header scheme removed; line-item scheme used instead)

  // Real-time authoritative price resolution for line item
  const resolveLinePrice = async (
    idx: number,
    prodId: string,
    qty: number,
    schemeId?: string,
    overrideRateListId?: string,
  ) => {
    if (!prodId) return;
    try {
      const effectiveSchemeId = schemeId ? String(schemeId).trim() : undefined;
      const targetRateListId = overrideRateListId !== undefined ? overrideRateListId : (formData.rateListId || undefined);
      const res = await ApiClient.post<any>('/api/v1/pricing/resolve', {
        companyId: activeCompanyId || undefined,
        dealerId: formData.dealerId || undefined,
        finishedProductId: prodId,
        quantity: qty,
        paymentTerm: formData.paymentTerm || 'CASH',
        requestedSchemeId: effectiveSchemeId,
        requestedRateListId: targetRateListId,
        rateListId: targetRateListId,
        orderDate: formData.orderDate || undefined,
      });

      const r = res.data?.data || res.data;
      if (r) {
        setFormItems((prev) => {
          const next = [...prev];
          if (next[idx]) {
            // If no scheme was selected, discount MUST be 0!
            const discPct = effectiveSchemeId ? Number(r.discountPercent || 0) : 0;
            const discAmt = effectiveSchemeId ? Number(r.discountAmount || 0) : 0;
            const base = Number(r.baseRate || 0);
            const net = effectiveSchemeId && discAmt > 0 ? Number(r.finalUnitRate || (base - discAmt)) : base;

            next[idx] = {
              ...next[idx],
              baseRate: base,
              unitPrice: net,
              discountPercent: discPct,
              discountAmount: discAmt,
              freeQuantity: effectiveSchemeId ? Number(r.freeQuantity || 0) : 0,
              totalPrice: net * qty,
              commercialCondition: effectiveSchemeId ? (r.commercialCondition || undefined) : undefined,
              rateListId: targetRateListId || '',
            };
          }
          return next;
        });
      }
    } catch {
      // Keep manual price on error
    }
  };

  // Form item updates
  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...formItems];
    const item = { ...updated[index], [field]: value } as SalesOrderItemRow;

    if (field === 'finishedProductId') {
      const prod = companyProducts.find((p) => p.id === value);
      if (prod) {
        item.productName = prod.productName;
        item.productCode = prod.productCode;
        item.packSize = cleanPackSize(prod.packSize?.name || prod.packSize || prod.packingUnit);
        item.baseRate = Number(prod.defaultSellingPrice || 1200);
        item.unitPrice = Number(prod.defaultSellingPrice || 1200);
        item.totalPrice = (Number(item.quantity) || 1) * item.unitPrice;
      }
      item.batchId = '';
      item.batchNumber = '';
      if (!item.schemeId) {
        item.discountPercent = 0;
        item.discountAmount = 0;
        item.freeQuantity = 0;
      }
      updated[index] = item;
      setFormItems(updated);
      resolveLinePrice(index, value, Number(item.quantity) || 1, item.schemeId || undefined, item.rateListId || undefined);
      fetchBatchesForLine(index, value, formData.warehouseId || companyWarehouses[0]?.id);
      return;
    } else if (field === 'batchId') {
      const selectedBatch = item.availableBatches?.find((b: any) => b.id === value);
      if (selectedBatch) {
        item.batchId = selectedBatch.id;
        item.batchNumber = selectedBatch.batchNumber;
      } else {
        item.batchId = value;
        item.batchNumber = undefined;
      }
    } else if (field === 'rateListId') {
      item.rateListId = value;
      updated[index] = item;
      setFormItems(updated);
      if (item.finishedProductId) {
        resolveLinePrice(index, item.finishedProductId, Number(item.quantity) || 1, item.schemeId, value);
      }
      return;
    } else if (field === 'quantity') {
      const qty = Number(value) || 1;
      item.quantity = qty;
      item.totalPrice = qty * Number(item.unitPrice || 0);
      updated[index] = item;
      setFormItems(updated);
      if (item.finishedProductId) {
        resolveLinePrice(index, item.finishedProductId, qty, item.schemeId, item.rateListId);
      }
      return;
    } else if (field === 'schemeId') {
      const newSchemeId = String(value || '').trim();
      item.schemeId = newSchemeId;
      // Auto-fetch linked rate list for this scheme
      let linkedRlId = '';
      if (newSchemeId) {
        const sc = companySchemes.find((s) => s.id === newSchemeId);
        if (sc) {
          linkedRlId = sc.baseRateListId || sc.baseRateList?.id;
          if (!linkedRlId && Array.isArray(sc.rateLists) && sc.rateLists.length > 0) {
            linkedRlId = sc.rateLists[0].id;
          }
          if (!linkedRlId) {
            const matchedRl = rateLists.find(
              (rl) => rl.schemeId === sc.id || (sc.shortCode && rl.schemeShortCode === sc.shortCode)
            );
            if (matchedRl) linkedRlId = matchedRl.id;
          }
        }
      }
      item.rateListId = linkedRlId;
      if (!newSchemeId) {
        item.discountPercent = 0;
        item.discountAmount = 0;
        item.freeQuantity = 0;
        item.unitPrice = Number(item.baseRate || 0);
        item.totalPrice = (Number(item.quantity) || 1) * item.unitPrice;
      }
      updated[index] = item;
      setFormItems(updated);
      if (item.finishedProductId) {
        resolveLinePrice(index, item.finishedProductId, Number(item.quantity) || 1, newSchemeId || undefined, linkedRlId || undefined);
      }
      return;
    } else if (field === 'unitPrice') {
      const price = Number(value) || 0;
      item.unitPrice = price;
      item.totalPrice = (Number(item.quantity) || 1) * price;
    }

    updated[index] = item;
    setFormItems(updated);
  };

  const addItemRow = () => {
    const newIdx = formItems.length;
    setFormItems((prev) => [
      ...prev,
      {
        finishedProductId: '',
        productName: '',
        rateListId: '',
        schemeId: '', // No scheme by default: 0% discount until chosen
        quantity: 1,
        baseRate: 0,
        discountPercent: 0,
        discountAmount: 0,
        freeQuantity: 0,
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
    setTimeout(() => {
      const el = document.getElementById(`field-item-scheme-${newIdx}`) || document.getElementById(`field-item-product-${newIdx}`);
      el?.focus();
    }, 60);
  };

  const removeItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleCreateOrder = async (immediateInvoice: boolean = generateInvoiceImmediately) => {
    if (!formData.dealerId) {
      showToast({ title: 'Validation Error', message: 'Please select a Dealer', type: 'error' });
      return;
    }
    if (activeCompanyId && formData.dealerId === activeCompanyId) {
      showToast({
        title: 'Validation Error',
        message: 'A company cannot be selected as a customer dealer. Please select a valid commercial dealer.',
        type: 'error',
      });
      return;
    }
    const warehouseIdToUse = formData.warehouseId || companyWarehouses[0]?.id;
    if (!warehouseIdToUse) {
      showToast({ title: 'Validation Error', message: 'Please select a Dispatch Warehouse', type: 'error' });
      return;
    }

    // Line items validation
    for (let i = 0; i < formItems.length; i++) {
      const it = formItems[i];
      if (!it) continue;
      if (!it.finishedProductId) {
        showToast({ title: 'Validation Error', message: `Line #${i + 1}: Please select a Finished Product`, type: 'error' });
        return;
      }
      if (!it.batchId) {
        showToast({ title: 'Validation Error', message: `Line #${i + 1} (${it.productName || 'Item'}): Please select a Batch in WH`, type: 'error' });
        return;
      }
      if (Number(it.quantity) <= 0) {
        showToast({ title: 'Validation Error', message: `Line #${i + 1} (${it.productName || 'Item'}): Quantity must be greater than 0`, type: 'error' });
        return;
      }
      if (!it.schemeId) {
        showToast({ title: 'Validation Error', message: `Line #${i + 1} (${it.productName || 'Item'}): Please select a Scheme`, type: 'error' });
        return;
      }
      const selectedBatch = it.availableBatches?.find((b: any) => b.id === it.batchId);
      if (selectedBatch) {
        if (selectedBatch.isExpired) {
          showToast({
            title: 'Expired Batch',
            message: `Line #${i + 1}: Batch ${selectedBatch.batchNumber} has expired. Please select a valid active batch.`,
            type: 'error',
          });
          return;
        }
        if (Number(selectedBatch.availableQuantity) < Number(it.quantity)) {
          showToast({
            title: 'Insufficient Batch Stock',
            message: `Line #${i + 1} (${it.productName || 'Item'}): Requested ${it.quantity} units exceeds available batch stock (${selectedBatch.availableQuantity} units in batch ${selectedBatch.batchNumber}).`,
            type: 'error',
          });
          return;
        }
      }
    }

    const totalOrderVal = formItems.reduce((sum, i) => sum + (Number(i.totalPrice) || 0), 0);
    const creditLimit = Number(dealerHierarchy?.dealer?.creditLimit || 0);
    const currentBal = Number(dealerHierarchy?.dealer?.currentBalance || 0);
    const availCredit = dealerHierarchy?.availableCredit !== undefined
      ? Number(dealerHierarchy.availableCredit)
      : (creditLimit > 0 ? Math.max(0, creditLimit - currentBal) : 999999999);
    const isExceeded = creditLimit > 0 && totalOrderVal > availCredit;

    if (isExceeded && immediateInvoice) {
      showToast({
        title: 'Credit Limit Exceeded',
        message: `Order total (PKR ${totalOrderVal.toLocaleString()}) exceeds available credit (PKR ${availCredit.toLocaleString()}). Direct invoice disabled; booking as pending order on CREDIT_HOLD for managerial review.`,
        type: 'warning',
      });
      immediateInvoice = false;
    }

    try {
      const payload = {
        dealerId: formData.dealerId,
        territoryId: dealerHierarchy?.territoryId || dealerHierarchy?.territory?.id || undefined,
        zoneId: dealerHierarchy?.zoneId || dealerHierarchy?.zone?.id || undefined,
        regionId: dealerHierarchy?.regionId || dealerHierarchy?.region?.id || undefined,
        salesOfficerId: dealerHierarchy?.salesOfficerId || dealerHierarchy?.salesOfficer?.id || undefined,
        areaManagerId: dealerHierarchy?.areaManagerId || dealerHierarchy?.areaManager?.id || undefined,
        businessManagerId: dealerHierarchy?.businessManagerId || dealerHierarchy?.businessManager?.id || undefined,
        warehouseId: warehouseIdToUse,
        orderDate: formData.orderDate,
        notes: formData.notes || undefined,
        paymentTerm: formData.paymentTerm || 'CASH',
        rateListId: formData.rateListId || undefined,
        schemeId: formData.schemeId || undefined,
        companyId: activeCompanyId || undefined,
        items: formItems.map((it) => ({
          finishedProductId: it.finishedProductId,
          productName: it.productName,
          packing: it.packSize || undefined,
          batchId: it.batchId || undefined,
          batchNumber: it.batchNumber || undefined,
          schemeId: it.schemeId || undefined,
          rateListId: it.rateListId || formData.rateListId || undefined,
          quantity: Number(it.quantity) || 1,
          baseRate: Number(it.baseRate) || Number(it.unitPrice) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          discountPercent: Number(it.discountPercent) || 0,
          discountAmount: Number(it.discountAmount) || 0,
          freeQuantity: Number(it.freeQuantity) || 0,
          totalPrice: Number(it.totalPrice) || 0,
          commercialCondition: it.commercialCondition || undefined,
        })),
      };

      const res = await ApiClient.post<any>('/api/v1/sales-orders', payload);
      const createdOrder = res.data?.data || res.data;
      const effectiveOrderNumber = createdOrder?.orderNumber || 'SO-NEW';

      if (immediateInvoice && createdOrder?.id && !isExceeded) {
        await ApiClient.patch(`/api/v1/sales-orders/${createdOrder.id}/approve`, { approved: true });
        const convRes = await ApiClient.post<any>(`/api/v1/sales-orders/${createdOrder.id}/convert-to-sale`, {
          warehouseId: warehouseIdToUse,
        });
        const invoice = convRes.data?.data || convRes.data;
        showToast({
          title: 'Direct Sale Invoice Created!',
          message: `✓ Sales Order ${effectiveOrderNumber} created and invoiced successfully. Ready for the next Sales Order.`,
          type: 'success',
        });
        if (invoice && invoice.invoiceNumber) {
          setActiveInvoice(invoice);
        }
      } else {
        showToast({
          title: isExceeded ? 'Order Booked (Credit Hold)' : 'Order Booked Successfully',
          message: isExceeded
            ? `✓ Sales Order ${effectiveOrderNumber} placed on CREDIT_HOLD. Ready for next order.`
            : `✓ Sales Order ${effectiveOrderNumber} created successfully. Ready for the next Sales Order.`,
          type: isExceeded ? 'warning' : 'success',
        });
      }

      // DO NOT close modal: keep mode === 'create'
      // Reset transaction-specific fields: clear dealer, notes, product lines, quantities, rates
      setFormData((prev) => ({
        ...prev,
        dealerId: '',
        notes: '',
        schemeId: '',
        rateListId: '',
      }));
      setDealerHierarchy(null);
      setFormItems([
        {
          finishedProductId: '',
          productName: '',
          schemeId: '',
          rateListId: '',
          quantity: 1,
          baseRate: 0,
          discountPercent: 0,
          discountAmount: 0,
          freeQuantity: 0,
          unitPrice: 0,
          totalPrice: 0,
        },
      ]);

      // Refresh list in background
      loadData();

      // Automatically focus first input (Dealer) for continuous data entry
      setTimeout(() => {
        const dealerInput = document.getElementById('field-so-dealer') as HTMLInputElement | null;
        if (dealerInput) {
          dealerInput.focus();
        }
      }, 100);
    } catch (err: any) {
      // Keep modal open, keep user's entered data, show error
      showToast({
        title: 'Error',
        message: err?.response?.data?.message || err?.message || 'Failed to create sales order',
        type: 'error',
      });
    }
  };

  // Order Approval
  const handleApproveOrder = async (orderId: string) => {
    try {
      await ApiClient.patch(`/api/v1/sales-orders/${orderId}/approve`, { approved: true });
      showToast({ title: 'Order Approved', message: 'Sales officer notified on mobile app', type: 'success' });
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Failed to approve order', type: 'error' });
    }
  };

  // Order Rejection
  const handleRejectOrder = async () => {
    if (!orderToReject) return;
    try {
      await ApiClient.patch(`/api/v1/sales-orders/${orderToReject.id}/reject`, {
        rejectionReason: rejectionReason || 'Credit check or stock unavailable',
      });
      showToast({ title: 'Order Rejected', message: 'Reason dispatched to mobile sales officer', type: 'info' });
      setIsRejectModalOpen(false);
      setOrderToReject(null);
      setRejectionReason('');
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Failed to reject order', type: 'error' });
    }
  };

  // Order Deletion
  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete order ${orderNumber}?`)) {
      return;
    }
    try {
      await ApiClient.delete(`/api/v1/sales-orders/${orderId}`);
      showToast({ title: 'Order Deleted', message: `Order ${orderNumber} has been removed`, type: 'success' });
      if (mode === 'detail') setMode('list');
      loadData();
    } catch (err: any) {
      showToast({ title: 'Delete Failed', message: err?.message || 'Could not delete sales order', type: 'error' });
    }
  };

  const isOrderPending = (status: string) => status === 'PENDING' || status === 'PENDING_APPROVAL';
  const isOrderApproved = (status: string) => status === 'APPROVED';
  const isOrderPendingOrApproved = (status: string) => isOrderPending(status) || isOrderApproved(status);

  // Open Colorful Sales Invoice for converted orders
  const handleOpenInvoice = async (order: SalesOrderRecord) => {
    try {
      // 1. Check if invoice exists in search
      const res = await ApiClient.get<any>(`/api/v1/sales-invoices?search=${encodeURIComponent(order.orderNumber)}`);
      const invList = Array.isArray(res.data) ? res.data : res.data?.data || [];
      const matched = invList.find((i: any) => i.salesOrderId === order.id || i.invoiceNumber.includes(order.orderNumber)) || invList[0];

      if (matched) {
        const fullRes = await ApiClient.get<any>(`/api/v1/sales-invoices/${matched.id}`).catch(() => ({ data: matched }));
        const fullInv = fullRes.data?.data || fullRes.data || matched;
        setActiveInvoice(fullInv);
        setIsInvoiceModalOpen(true);
        return;
      }

      // 2. Synthesize invoice data from order details if not indexed yet
      const synthInvoice: SalesInvoiceExportData = {
        invoiceNumber: `INV-${order.orderNumber}`,
        invoiceDate: order.orderDate || new Date().toISOString(),
        postingStatus: 'POSTED',
        grossAmount: order.totalAmount,
        discountAmount: 0,
        taxAmount: 0,
        netAmount: order.totalAmount,
        notes: `Official Commercial Tax Invoice converted against Sales Order ${order.orderNumber}`,
        dealer: order.dealer ? {
          ...order.dealer,
          businessName: (order.dealer as any).businessName,
          address: (order.dealer as any).address,
          city: (order.dealer as any).city,
          territory: (order.dealer as any).territory || (order as any).territory,
        } : undefined,
        territory: (order as any).territory,
        territoryName: (order as any).territory?.name || (order.dealer as any)?.territory?.name,
        commercialCondition: (order as any).commercialCondition || (order as any).appliedSchemeName,
        warehouse: warehouses.find((w) => w.id === order.warehouseId) || warehouses[0],
        salesOrder: {
          orderNumber: order.orderNumber,
          orderDate: order.orderDate,
          territory: (order as any).territory,
          salesOfficer: order.salesOfficer,
        },
        items: (order.items || []).map((it) => {
          const prod = products.find((p: any) => p.id === it.finishedProductId);
          const ppc = prod?.ppc || (it as any).finishedProduct?.ppc || null;
          const schemeCode = (it as any).scheme?.code || (it as any).schemeCode || 'SS';
          return {
            productName: it.productName,
            packing: it.packing || 'Commercial Pack',
            quantity: it.quantity,
            rate: it.unitPrice,
            grossAmount: it.totalPrice,
            discountAmount: it.discountAmount || 0,
            discountPercent: it.discountPercent || 0,
            taxAmount: 0,
            netAmount: it.totalPrice,
            ppc,
            ctn: ppc && ppc > 0 ? Math.ceil(Number(it.quantity) / ppc) : 1,
            schemeCode,
            scheme: schemeCode,
          };
        }),
      };

      setActiveInvoice(synthInvoice);
      setIsInvoiceModalOpen(true);
    } catch {
      showToast({ title: 'Invoice', message: 'Displaying Sales Invoice...', type: 'info' });
    }
  };

  // Open Customize Order Modal (e.g. Sales Manager adjusts scheme, rate list, product allocations & quantities)
  const openCustomizeModal = (order: SalesOrderRecord) => {
    setOrderToCustomize(order);
    setCustomizeWarehouseId(order.warehouseId || warehouses[0]?.id || '');
    setCustomizeNotes(order.notes || '');
    setCustomizeSchemeId(order.schemeId || '');
    setCustomizeRateListId(order.rateListId || rateLists[0]?.id || '');
    setCustomizePaymentTerm(order.paymentTerm || 'CASH');
    setCustomizeItems(
      (order.items || []).map((i) => ({
        ...i,
        finishedProductId: i.finishedProductId || '',
        productName: i.productName || 'Product',
        originalQuantity: Number(i.quantity) || 0,
        quantity: Number(i.quantity) || 0,
        baseRate: Number(i.baseRate) || Number(i.unitPrice) || 0,
        unitPrice: Number(i.unitPrice) || 0,
        discountPercent: Number(i.discountPercent) || 0,
        discountAmount: Number(i.discountAmount) || 0,
        freeQuantity: Number(i.freeQuantity) || 0,
        totalPrice: Number(i.totalPrice) || (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
        schemeId: i.schemeId || order.schemeId || '',
        rateListId: i.rateListId || order.rateListId || '',
        commercialCondition: i.commercialCondition || '',
      }))
    );
    setIsCustomizeModalOpen(true);
  };

  // Dynamically resolve & recalculate prices across all items when Scheme, Rate List, or Payment Term changes
  const recalculateCustomizePricing = async (
    itemsList: any[],
    schemeIdToUse: string,
    rateListIdToUse: string,
    paymentTermToUse: string,
  ) => {
    if (!orderToCustomize || itemsList.length === 0) return;
    setIsResolvingCustomizePricing(true);
    try {
      const resolvedList = await Promise.all(
        itemsList.map(async (it) => {
          if (!it.finishedProductId) return it;
          try {
            const res = await ApiClient.post<any>('/api/v1/pricing/resolve', {
              companyId: activeCompanyId || undefined,
              dealerId: orderToCustomize.dealerId,
              finishedProductId: it.finishedProductId,
              quantity: Number(it.quantity) || 1,
              paymentTerm: paymentTermToUse,
              requestedSchemeId: schemeIdToUse || undefined,
              requestedRateListId: rateListIdToUse || undefined,
              rateListId: rateListIdToUse || undefined,
            });
            const r = res.data?.data || res.data;
            if (r) {
              return {
                ...it,
                baseRate: r.baseRate,
                unitPrice: r.finalUnitRate,
                discountPercent: r.discountPercent,
                discountAmount: r.discountAmount,
                freeQuantity: r.freeQuantity || 0,
                totalPrice: r.finalAmount,
                commercialCondition: r.commercialCondition || undefined,
                schemeId: schemeIdToUse,
                rateListId: rateListIdToUse,
              };
            }
          } catch {
            // Keep existing rate on failure
          }
          return it;
        })
      );
      setCustomizeItems(resolvedList);
    } finally {
      setIsResolvingCustomizePricing(false);
    }
  };

  const handleCustomizeSchemeChange = (newSchemeId: string) => {
    setCustomizeSchemeId(newSchemeId);
    const matchedScheme = schemes.find((s) => s.id === newSchemeId);
    let linkedRlId = customizeRateListId;
    if (matchedScheme) {
      const linked = rateLists.find((rl) => rl.schemeId === newSchemeId || (matchedScheme.shortCode && rl.schemeShortCode === matchedScheme.shortCode));
      if (linked) {
        linkedRlId = linked.id;
        setCustomizeRateListId(linked.id);
      }
    }
    recalculateCustomizePricing(customizeItems, newSchemeId, linkedRlId, customizePaymentTerm);
  };

  const handleCustomizeRateListChange = (newRateListId: string) => {
    setCustomizeRateListId(newRateListId);
    recalculateCustomizePricing(customizeItems, customizeSchemeId, newRateListId, customizePaymentTerm);
  };

  const handleCustomizePaymentTermChange = (newPaymentTerm: string) => {
    setCustomizePaymentTerm(newPaymentTerm);
    recalculateCustomizePricing(customizeItems, customizeSchemeId, customizeRateListId, newPaymentTerm);
  };

  const updateCustomizeItem = async (index: number, field: string, val: any) => {
    const updated = [...customizeItems];
    const prev = updated[index];
    if (!prev) return;
    const item = { ...prev, [field]: val };

    if (field === 'finishedProductId') {
      const prod = products.find((p) => p.id === val);
      if (prod) {
        item.productName = prod.productName;
        item.baseRate = Number(prod.defaultSellingPrice || prev.unitPrice || 0);
        item.unitPrice = Number(prod.defaultSellingPrice || prev.unitPrice || 0);
      }
    }

    if (field === 'quantity' || field === 'finishedProductId') {
      const qty = Number(field === 'quantity' ? val : item.quantity) || 1;
      const prodId = field === 'finishedProductId' ? val : item.finishedProductId;
      if (prodId && orderToCustomize) {
        try {
          const res = await ApiClient.post<any>('/api/v1/pricing/resolve', {
            companyId: activeCompanyId || undefined,
            dealerId: orderToCustomize.dealerId,
            finishedProductId: prodId,
            quantity: qty,
            paymentTerm: customizePaymentTerm,
            requestedSchemeId: customizeSchemeId || undefined,
            requestedRateListId: customizeRateListId || undefined,
            rateListId: customizeRateListId || undefined,
          });
          const r = res.data?.data || res.data;
          if (r) {
            item.baseRate = r.baseRate;
            item.unitPrice = r.finalUnitRate;
            item.discountPercent = r.discountPercent;
            item.discountAmount = r.discountAmount;
            item.freeQuantity = r.freeQuantity || 0;
            item.totalPrice = r.finalAmount;
            item.commercialCondition = r.commercialCondition || undefined;
          }
        } catch {
          const price = Number(item.unitPrice) || 0;
          item.totalPrice = qty * price;
        }
      } else {
        const price = Number(item.unitPrice) || 0;
        item.totalPrice = qty * price;
      }
    } else if (field === 'unitPrice') {
      const qty = Number(item.quantity) || 0;
      const price = Number(val) || 0;
      item.totalPrice = qty * price;
    }

    updated[index] = item;
    setCustomizeItems(updated);
  };

  const addCustomizeItemRow = () => {
    const defaultProd = products[0];
    const initialPrice = Number(defaultProd?.defaultSellingPrice || 0);
    setCustomizeItems([
      ...customizeItems,
      {
        finishedProductId: defaultProd?.id || '',
        productName: defaultProd?.productName || 'Additional Product',
        originalQuantity: 1,
        quantity: 1,
        baseRate: initialPrice,
        unitPrice: initialPrice,
        discountPercent: 0,
        discountAmount: 0,
        freeQuantity: 0,
        totalPrice: initialPrice,
        schemeId: customizeSchemeId,
        rateListId: customizeRateListId,
      },
    ]);
  };

  const removeCustomizeItemRow = (index: number) => {
    if (customizeItems.length <= 1) {
      showToast({ title: 'Validation', message: 'Order must contain at least 1 line item', type: 'error' });
      return;
    }
    setCustomizeItems(customizeItems.filter((_, i) => i !== index));
  };

  const handleSaveCustomizedOrder = async () => {
    if (!orderToCustomize) return;
    if (customizeItems.some((i) => Number(i.quantity) <= 0)) {
      showToast({ title: 'Validation', message: 'All item quantities must be greater than 0', type: 'error' });
      return;
    }
    setIsSavingCustomization(true);
    try {
      const totalDiscount = customizeItems.reduce(
        (sum, it) => sum + (Number(it.discountAmount || 0) * Number(it.quantity || 1)),
        0,
      );
      const totalFree = customizeItems.reduce(
        (sum, it) => sum + Number(it.freeQuantity || 0),
        0,
      );

      const res = await ApiClient.patch<any>(`/api/v1/sales-orders/${orderToCustomize.id}`, {
        warehouseId: customizeWarehouseId,
        notes: customizeNotes,
        schemeId: customizeSchemeId || null,
        rateListId: customizeRateListId || null,
        paymentTerm: customizePaymentTerm,
        discountAmount: totalDiscount,
        freeQuantityTotal: totalFree,
        items: customizeItems.map((i) => ({
          finishedProductId: i.finishedProductId,
          productName: i.productName,
          packing: i.packing,
          quantity: Number(i.quantity),
          baseRate: Number(i.baseRate || i.unitPrice),
          unitPrice: Number(i.unitPrice),
          discountPercent: Number(i.discountPercent || 0),
          discountAmount: Number(i.discountAmount || 0),
          freeQuantity: Number(i.freeQuantity || 0),
          totalPrice: Number(i.totalPrice) || (Number(i.quantity) * Number(i.unitPrice)),
          schemeId: customizeSchemeId || null,
          rateListId: customizeRateListId || null,
          commercialCondition: i.commercialCondition || null,
        })),
      });

      showToast({
        title: 'Order Updated Successfully',
        message: `Sales order ${orderToCustomize.orderNumber} updated with dynamic scheme pricing!`,
        type: 'success',
      });
      setIsCustomizeModalOpen(false);
      setOrderToCustomize(null);
      await loadData();
      if (selectedOrder && selectedOrder.id === orderToCustomize.id) {
        setSelectedOrder(res.data?.data || res.data || null);
      }
    } catch (err: any) {
      showToast({ title: 'Error', message: err?.message || 'Failed to update sales order', type: 'error' });
    } finally {
      setIsSavingCustomization(false);
    }
  };

  // Dynamically resolve & recalculate prices across all items in Convert to Sale modal when Scheme, Rate List, or Payment Term changes
  const recalculateConvertPricing = async (
    itemsList: any[],
    schemeIdToUse: string,
    rateListIdToUse: string,
    paymentTermToUse: string,
    dealerIdToUse?: string,
  ) => {
    const targetDealerId = dealerIdToUse || orderToConvert?.dealerId;
    if (!targetDealerId || itemsList.length === 0) return;
    setIsResolvingConvertPricing(true);
    try {
      const resolvedList = await Promise.all(
        itemsList.map(async (it) => {
          if (!it.finishedProductId) return it;
          try {
            const res = await ApiClient.post<any>('/api/v1/pricing/resolve', {
              companyId: activeCompanyId || undefined,
              dealerId: targetDealerId,
              finishedProductId: it.finishedProductId,
              quantity: Number(it.quantity) || 1,
              paymentTerm: paymentTermToUse,
              requestedSchemeId: schemeIdToUse || undefined,
              requestedRateListId: rateListIdToUse || undefined,
              rateListId: rateListIdToUse || undefined,
            });
            const r = res.data?.data || res.data;
            if (r) {
              return {
                ...it,
                baseRate: r.baseRate,
                unitPrice: r.finalUnitRate,
                discountPercent: r.discountPercent,
                discountAmount: r.discountAmount,
                freeQuantity: r.freeQuantity || 0,
                totalPrice: r.finalAmount,
                commercialCondition: r.commercialCondition || undefined,
                schemeId: schemeIdToUse,
                rateListId: rateListIdToUse,
              };
            }
          } catch {
            // Keep existing rate on error
          }
          return it;
        })
      );
      setConvertItems(resolvedList);
    } finally {
      setIsResolvingConvertPricing(false);
    }
  };

  // Open Convert to Sale Modal with adjustable items & dynamic scheme pricing
  const openConvertModal = (order: SalesOrderRecord) => {
    setOrderToConvert(order);
    setSelectedWarehouseId(order.warehouseId || warehouses[0]?.id || '');
    const schemeToUse = order.schemeId || '';
    const rateListToUse = order.rateListId || rateLists[0]?.id || '';
    const paymentTermToUse = order.paymentTerm || 'CASH';

    const initialItems = (order.items || []).map((i) => ({
      ...i,
      finishedProductId: i.finishedProductId || '',
      productName: i.productName || 'Product',
      originalQuantity: Number(i.quantity) || 0,
      quantity: Number(i.quantity) || 0,
      baseRate: Number(i.baseRate) || Number(i.unitPrice) || 0,
      unitPrice: Number(i.unitPrice) || 0,
      discountPercent: Number(i.discountPercent) || 0,
      discountAmount: Number(i.discountAmount) || 0,
      freeQuantity: Number(i.freeQuantity) || 0,
      totalPrice: Number(i.totalPrice) || (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
      schemeId: i.schemeId || schemeToUse || '',
      rateListId: i.rateListId || rateListToUse || '',
      commercialCondition: i.commercialCondition || '',
    }));
    setConvertItems(initialItems);
    setIsConvertModalOpen(true);

    // Auto-resolve prices if any item has 0 price or if scheme/rate list is available
    if (initialItems.some((it) => !it.unitPrice || it.unitPrice === 0) || schemeToUse || rateListToUse) {
      recalculateConvertPricing(initialItems, schemeToUse, rateListToUse, paymentTermToUse, order.dealerId);
    }
  };

  const updateConvertItemScheme = async (index: number, newSchemeId: string) => {
    const updated = [...convertItems];
    const prev = updated[index];
    if (!prev) return;
    const item = { ...prev, schemeId: newSchemeId };
    updated[index] = item;
    setConvertItems(updated);

    if (item.finishedProductId && orderToConvert) {
      try {
        const res = await ApiClient.post<any>('/api/v1/pricing/resolve', {
          companyId: orderToConvert.companyId || activeCompanyId || undefined,
          dealerId: orderToConvert.dealerId,
          finishedProductId: item.finishedProductId,
          quantity: Number(item.quantity) || 1,
          paymentTerm: orderToConvert.paymentTerm || 'CASH',
          requestedSchemeId: newSchemeId || undefined,
          requestedRateListId: item.rateListId || orderToConvert.rateListId || undefined,
          rateListId: item.rateListId || orderToConvert.rateListId || undefined,
        });
        const r = res.data?.data || res.data;
        if (r) {
          item.baseRate = Number(r.baseRate || 0);
          item.unitPrice = Number(r.finalUnitRate || r.baseRate || 0);
          item.discountPercent = Number(r.discountPercent || 0);
          item.discountAmount = Number(r.discountAmount || 0);
          item.freeQuantity = Number(r.freeQuantity || 0);
          item.totalPrice = Number(r.finalAmount || (Number(r.finalUnitRate || 0) * Number(item.quantity || 1)));
          item.commercialCondition = r.commercialCondition || undefined;
          item.schemeId = newSchemeId;
          updated[index] = item;
          setConvertItems([...updated]);
        }
      } catch {
        // Keep fallback
      }
    }
  };

  const updateConvertItemQty = async (index: number, qtyVal: any) => {
    const updated = [...convertItems];
    const prev = updated[index];
    if (!prev) return;
    const qty = Math.max(0, Number(qtyVal) || 0);
    const item = { ...prev, quantity: qty, totalPrice: qty * Number(prev.unitPrice) };
    updated[index] = item;
    setConvertItems(updated);

    // If finishedProductId and dealer available, re-resolve for this specific item with new quantity
    if (item.finishedProductId && orderToConvert) {
      try {
        const res = await ApiClient.post<any>('/api/v1/pricing/resolve', {
          companyId: orderToConvert.companyId || activeCompanyId || undefined,
          dealerId: orderToConvert.dealerId,
          finishedProductId: item.finishedProductId,
          quantity: qty,
          paymentTerm: orderToConvert.paymentTerm || 'CASH',
          requestedSchemeId: item.schemeId || undefined,
          requestedRateListId: item.rateListId || orderToConvert.rateListId || undefined,
          rateListId: item.rateListId || orderToConvert.rateListId || undefined,
        });
        const r = res.data?.data || res.data;
        if (r) {
          item.baseRate = Number(r.baseRate || 0);
          item.unitPrice = Number(r.finalUnitRate || r.baseRate || 0);
          item.discountPercent = Number(r.discountPercent || 0);
          item.discountAmount = Number(r.discountAmount || 0);
          item.freeQuantity = Number(r.freeQuantity || 0);
          item.totalPrice = Number(r.finalAmount || (Number(r.finalUnitRate || 0) * qty));
          item.commercialCondition = r.commercialCondition || undefined;
          updated[index] = item;
          setConvertItems([...updated]);
        }
      } catch {
        // Keep fallback
      }
    }
  };

  // Convert to Sale and immediately generate & display Invoice
  const handleConvertToSale = async () => {
    if (!orderToConvert || !selectedWarehouseId) {
      showToast({ title: 'Error', message: 'Please select a dispatch warehouse', type: 'error' });
      return;
    }

    setIsConvertingToSale(true);
    try {
      const targetCompanyId = orderToConvert.companyId || activeCompanyId;
      const compParam = targetCompanyId ? `?companyId=${targetCompanyId}` : '';

      // 1. Update order with line-item schemes and dynamic prices
      const totalDiscount = convertItems.reduce(
        (sum, it) => sum + (Number(it.discountAmount || 0) * Number(it.quantity || 1)),
        0,
      );
      const totalFree = convertItems.reduce(
        (sum, it) => sum + Number(it.freeQuantity || 0),
        0,
      );
      const primarySchemeId = convertItems.find((it) => it.schemeId)?.schemeId || orderToConvert.schemeId || null;

      await ApiClient.patch(`/api/v1/sales-orders/${orderToConvert.id}${compParam}`, {
        companyId: targetCompanyId,
        warehouseId: selectedWarehouseId,
        schemeId: primarySchemeId,
        rateListId: orderToConvert.rateListId || null,
        paymentTerm: orderToConvert.paymentTerm || 'CASH',
        discountAmount: totalDiscount,
        freeQuantityTotal: totalFree,
        items: convertItems.map((i) => ({
          finishedProductId: i.finishedProductId,
          productName: i.productName,
          packing: i.packing,
          quantity: Number(i.quantity),
          baseRate: Number(i.baseRate || i.unitPrice),
          unitPrice: Number(i.unitPrice),
          discountPercent: Number(i.discountPercent || 0),
          discountAmount: Number(i.discountAmount || 0),
          freeQuantity: Number(i.freeQuantity || 0),
          totalPrice: Number(i.totalPrice) || (Number(i.quantity) * Number(i.unitPrice)),
          schemeId: i.schemeId || null,
          rateListId: i.rateListId || orderToConvert.rateListId || null,
          commercialCondition: i.commercialCondition || null,
        })),
      });

      // 2. If order is PENDING, auto-approve first before converting!
      if (orderToConvert.status === 'PENDING') {
        await ApiClient.patch(`/api/v1/sales-orders/${orderToConvert.id}/approve${compParam}`, {
          approved: true,
          companyId: targetCompanyId,
        });
      }

      // 3. Convert to Sale and generate invoice
      const res = await ApiClient.post<any>(`/api/v1/sales-orders/${orderToConvert.id}/convert-to-sale${compParam}`, {
        companyId: targetCompanyId,
        warehouseId: selectedWarehouseId,
        items: convertItems.length > 0 ? convertItems : undefined,
      });

      const generatedInvoice = res.data?.data || res.data;

      showToast({
        title: 'Order Converted to Sale!',
        message: 'Commercial Sales Invoice generated, stock deducted, and dealer ledger updated atomically.',
        type: 'success',
      });
      setIsConvertModalOpen(false);
      setOrderToConvert(null);
      loadData();

      // Automatically pop up the colorful modern invoice!
      if (generatedInvoice && generatedInvoice.invoiceNumber) {
        setActiveInvoice(generatedInvoice);
        setIsInvoiceModalOpen(true);
      }

      // Automatically navigate to Sales Invoices so the user sees it in the Invoices list!
      if (onNavigateToInvoices) {
        setTimeout(() => {
          onNavigateToInvoices();
        }, 1200);
      }
    } catch (err: any) {
      showToast({ title: 'Conversion Error', message: err.message || 'Failed to convert order to sale', type: 'error' });
    } finally {
      setIsConvertingToSale(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.dealer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.salesOfficer && (o.salesOfficer.name || `${o.salesOfficer.firstName || ''} ${o.salesOfficer.lastName || ''}`.trim()).toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPIs
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === 'PENDING').length;
  const approvedOrders = orders.filter((o) => o.status === 'APPROVED').length;
  const convertedSales = orders.filter((o) => o.status === 'CONVERTED_TO_SALE').length;

  const columns: ColumnDef<SalesOrderRecord>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (o) => <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{o.orderNumber}</span>,
    },
    {
      key: 'orderDate',
      header: 'Date',
      render: (o) => new Date(o.orderDate).toLocaleDateString(),
    },
    {
      key: 'dealer',
      header: 'Dealer',
      render: (o) => (
        <div>
          <div style={{ fontWeight: 600 }}>{o.dealer?.name || 'Dealer'}</div>
          {o.dealer?.code && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{o.dealer.code}</div>}
        </div>
      ),
    },
    {
      key: 'schemeTerm',
      header: 'Term / Scheme',
      render: (o) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span
            style={{
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: o.paymentTerm === 'CASH' ? '#ecfdf5' : '#eff6ff',
              color: o.paymentTerm === 'CASH' ? '#047857' : '#1e40af',
              display: 'inline-block',
              width: 'fit-content',
            }}
          >
            {o.paymentTerm || 'CASH'}
          </span>
          {o.appliedSchemeName && (
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {o.appliedSchemeName}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'salesOfficer',
      header: 'Booked By',
      render: (o) =>
        o.salesOfficer ? (o.salesOfficer.name || `${o.salesOfficer.firstName || ''} ${o.salesOfficer.lastName || ''}`.trim() || 'ERP Direct') : 'ERP Direct',
    },
    {
      key: 'totalAmount',
      header: 'Total Order Value',
      render: (o) => (
        <span style={{ fontWeight: 600 }}>PKR {Number(o.totalAmount || 0).toLocaleString()}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (o) => {
        const variant =
          o.status === 'CONVERTED_TO_SALE'
            ? 'success'
            : o.status === 'APPROVED'
              ? 'info'
              : o.status === 'REJECTED'
                ? 'danger'
                : 'warning';
        return <StatusBadge status={o.status} variant={variant} />;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (o) => {
        const pending = isOrderPending(o.status);
        const approved = isOrderApproved(o.status);
        const converted = o.status === 'CONVERTED_TO_SALE';

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
            {/* 1. Primary Action: Convert to Sale (Auto-resolves Scheme, Rate List & Invoices) */}
            {(pending || approved) && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => openConvertModal(o)}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  fontWeight: 700,
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                }}
                title="Convert Order to Sale & Generate Invoice (Apply Scheme / Rate List)"
              >
                <span>Convert</span>
              </Button>
            )}

            {/* 2. Customize Products / Quantities / Schemes */}
            {(pending || approved) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openCustomizeModal(o)}
                style={{
                  borderColor: '#3b82f6',
                  color: '#1d4ed8',
                  background: '#eff6ff',
                  fontWeight: 600,
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
                title="Review Remarks, Edit Products & Quantities, or Apply Scheme"
              >
                <IconEdit size={13} />
                <span>Customize</span>
              </Button>
            )}

            {/* 3. Quick Approve (if pending) */}
            {pending && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleApproveOrder(o.id)}
                style={{
                  color: '#059669',
                  fontWeight: 600,
                  fontSize: '12px',
                  padding: '5px 8px',
                  border: '1px solid #a7f3d0',
                  background: '#ecfdf5',
                }}
                title="Approve Order"
              >
                <IconCheck size={14} />
              </Button>
            )}

            {/* 4. Converted to Sale: View Invoice */}
            {converted && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleOpenInvoice(o)}
                style={{
                  color: 'var(--brand-primary, #2563eb)',
                  borderColor: 'var(--border-subtle)',
                  fontWeight: 600,
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                }}
              >
                <IconFileText size={14} /> Invoice
              </Button>
            )}

            {/* 5. Rejected Order: View */}
            {o.status === 'REJECTED' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedOrder(o);
                  setMode('detail');
                }}
                style={{
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                <IconEye size={14} /> View
              </Button>
            )}

            {/* 6. Quick Actions Dropdown Menu Button */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (menuAnchor?.id === o.id) {
                    setMenuAnchor(null);
                    return;
                  }
                  const rect = e.currentTarget.getBoundingClientRect();
                  const spaceBelow = window.innerHeight - rect.bottom;
                  // If space below is less than 280px, open ABOVE the table row!
                  const showAbove = spaceBelow < 280;

                  if (showAbove) {
                    setMenuAnchor({
                      id: o.id,
                      order: o,
                      bottom: window.innerHeight - rect.top + 6,
                      right: Math.max(16, window.innerWidth - rect.right),
                    });
                  } else {
                    setMenuAnchor({
                      id: o.id,
                      order: o,
                      top: rect.bottom + 6,
                      right: Math.max(16, window.innerWidth - rect.right),
                    });
                  }
                }}
                title="Order Actions"
                aria-label="Order Actions"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: menuAnchor?.id === o.id ? 'var(--bg-hover)' : 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <IconMoreVertical size={16} />
              </button>
            </div>
          </div>
        );
      },
    },
  ];

  const renderActionPortal = () => {
    if (!isMounted || !menuAnchor) return null;
    const o = menuAnchor.order;

    return createPortal(
      <div
        data-order-actions-portal
        style={{
          position: 'fixed',
          right: `${menuAnchor.right}px`,
          ...(menuAnchor.top !== undefined ? { top: `${menuAnchor.top}px` } : {}),
          ...(menuAnchor.bottom !== undefined ? { bottom: `${menuAnchor.bottom}px` } : {}),
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.35), 0 10px 15px -5px rgba(0, 0, 0, 0.2)',
          padding: '6px',
          minWidth: '220px',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setSelectedOrder(o);
            setMode('detail');
            setMenuAnchor(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 12px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            background: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <IconEye size={15} style={{ color: 'var(--text-secondary)' }} />
          <span>View Details</span>
        </button>

        {isOrderPendingOrApproved(o.status) && (
          <button
            type="button"
            onClick={() => {
              openCustomizeModal(o);
              setMenuAnchor(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <IconEdit size={15} style={{ color: 'var(--brand-primary)' }} />
            <span>Apply Scheme & Customize</span>
          </button>
        )}

        {isOrderPending(o.status) && (
          <button
            type="button"
            onClick={() => {
              handleApproveOrder(o.id);
              setMenuAnchor(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <IconCheck size={15} style={{ color: '#10b981' }} />
            <span>Approve Order</span>
          </button>
        )}

        {isOrderPendingOrApproved(o.status) && (
          <button
            type="button"
            onClick={() => {
              openConvertModal(o);
              setMenuAnchor(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <IconFileText size={15} style={{ color: '#059669' }} />
            <span>Convert to Invoice</span>
          </button>
        )}

        {o.status === 'CONVERTED_TO_SALE' && (
          <button
            type="button"
            onClick={() => {
              handleOpenInvoice(o);
              setMenuAnchor(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <IconFileText size={15} style={{ color: 'var(--brand-primary)' }} />
            <span>Print / View Invoice</span>
          </button>
        )}

        {isOrderPending(o.status) && (
          <button
            type="button"
            onClick={() => {
              setOrderToReject(o);
              setIsRejectModalOpen(true);
              setMenuAnchor(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              color: '#d97706',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(217, 119, 6, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <IconClose size={15} style={{ color: '#d97706' }} />
            <span>Reject Order</span>
          </button>
        )}

        {o.status !== 'CONVERTED_TO_SALE' && (
          <>
            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
            <button
              type="button"
              onClick={() => {
                handleDeleteOrder(o.id, o.orderNumber);
                setMenuAnchor(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                color: '#ef4444',
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <IconTrash size={15} style={{ color: '#ef4444' }} />
              <span>Delete Order</span>
            </button>
          </>
        )}
      </div>,
      document.body
    );
  };

  const renderCustomizeModal = () => {
    if (!orderToCustomize) return null;
    const currentAdjustedTotal = customizeItems.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
    const originalTotal = Number(orderToCustomize.totalAmount || 0);
    const diff = currentAdjustedTotal - originalTotal;
    const totalDiscounts = customizeItems.reduce(
      (sum, it) => sum + (Number(it.discountAmount || 0) * Number(it.quantity || 1)),
      0,
    );
    const totalFreeBags = customizeItems.reduce(
      (sum, it) => sum + Number(it.freeQuantity || 0),
      0,
    );

    return (
      <Modal
        size="2xl"
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
        title={`Review, Customize & Apply Scheme - Order ${orderToCustomize.orderNumber}`}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px' }}>
              <div>
                Adjusted Order Value: <strong style={{ color: 'var(--brand-primary)', fontSize: '16px' }}>PKR {currentAdjustedTotal.toLocaleString()}</strong>
                {diff !== 0 && (
                  <span style={{ marginLeft: '8px', color: diff < 0 ? '#b91c1c' : '#047857', fontWeight: 700 }}>
                    ({diff < 0 ? '-' : '+'}PKR {Math.abs(diff).toLocaleString()})
                  </span>
                )}
              </div>
              {totalDiscounts > 0 && (
                <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#047857', fontWeight: 700, fontSize: '12px' }}>
                  Total Scheme Discount: -PKR {totalDiscounts.toLocaleString()}
                </span>
              )}
              {totalFreeBags > 0 && (
                <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#faf5ff', color: '#7e22ce', fontWeight: 700, fontSize: '12px' }}>
                  Free Bags: +{totalFreeBags}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" onClick={() => setIsCustomizeModalOpen(false)} disabled={isSavingCustomization}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveCustomizedOrder}
                disabled={isSavingCustomization || isResolvingCustomizePricing}
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  fontWeight: 700,
                }}
              >
                {isSavingCustomization ? 'Saving Changes...' : 'Save & Update Order'}
              </Button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Sales Officer Remarks Card */}
          {orderToCustomize.notes ? (
            <div
              style={{
                padding: '14px 18px',
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                borderRadius: '10px',
                border: '1.5px solid #fcd34d',
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#92400e', fontSize: '13px' }}>
                  <span>Sales Officer Remarks / Scheme Request:</span>
                </div>
                {orderToCustomize.salesOfficer && (
                  <span style={{ fontSize: '12px', color: '#b45309', fontWeight: 600 }}>
                    Booked by: <strong>{orderToCustomize.salesOfficer.name || `${orderToCustomize.salesOfficer.firstName || ''} ${orderToCustomize.salesOfficer.lastName || ''}`.trim()}</strong>
                  </span>
                )}
              </div>
              <div style={{ color: '#78350f', fontSize: '14px', fontWeight: 700, fontStyle: 'italic', padding: '4px 0' }}>
                &ldquo;{orderToCustomize.notes}&rdquo;
              </div>
              <div style={{ fontSize: '12px', color: '#92400e', marginTop: '4px' }}>
                <strong>Dynamic Scheme Action:</strong> Select the requested Commercial Scheme below. The system will inspect every product in the order against the selected rate list and auto-update the unit prices, discounts, and bonus quantities!
              </div>
            </div>
          ) : (
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              No specific remarks entered by sales officer. You can select any Commercial Scheme or Rate List below to apply dynamic pricing.
            </div>
          )}

          {/* Pricing Controls: Scheme, Rate List, Payment Term, Warehouse (Spacious 2x2 grid) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            <Select
              label="Commercial Scheme (Auto-Updates Prices) *"
              value={customizeSchemeId}
              onChange={(e) => handleCustomizeSchemeChange(e.target.value)}
              options={[
                { label: 'Standard Catalogue (No Scheme)', value: '' },
                ...schemeOptions,
              ]}
            />
            <Select
              label="Commercial Rate List *"
              value={customizeRateListId}
              onChange={(e) => handleCustomizeRateListChange(e.target.value)}
              options={rateListOptions}
            />
            <Select
              label="Payment Term *"
              value={customizePaymentTerm}
              onChange={(e) => handleCustomizePaymentTermChange(e.target.value)}
              options={[
                { label: 'CASH (Immediate Settlement)', value: 'CASH' },
                { label: 'CREDIT (Standard Terms)', value: 'CREDIT' },
                { label: 'ADVANCE (Pre-Payment)', value: 'ADVANCE' },
              ]}
            />
            <Select
              label="Dispatch Warehouse *"
              value={customizeWarehouseId}
              onChange={(e) => setCustomizeWarehouseId(e.target.value)}
              options={warehouses.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
            />
          </div>

          <Input
            label="Manager Override / Review Notes"
            placeholder="e.g. Applied Scheme A per sales officer remarks and confirmed with BM"
            value={customizeNotes}
            onChange={(e) => setCustomizeNotes(e.target.value)}
          />

          {isResolvingCustomizePricing && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: '#ecfdf5',
                borderRadius: '8px',
                border: '1px solid #6ee7b7',
                color: '#065f46',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <span>Calculating dynamic scheme rates & bonus bags for all order products...</span>
            </div>
          )}

          {/* Products & Dynamic Pricing Table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflowX: 'auto', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr style={{ textAlign: 'left', color: '#475569', fontSize: '12px' }}>
                  <th style={{ padding: '12px 14px', minWidth: '240px', whiteSpace: 'nowrap' }}>Product / SKU</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', width: '85px', whiteSpace: 'nowrap' }}>Approved Qty</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', minWidth: '100px', whiteSpace: 'nowrap' }}>Base Rate</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '130px', whiteSpace: 'nowrap' }}>Scheme Discount</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', minWidth: '95px', whiteSpace: 'nowrap' }}>Free Bags</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', minWidth: '105px', whiteSpace: 'nowrap' }}>Net Unit Rate</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '120px', whiteSpace: 'nowrap' }}>Line Total</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', width: '45px', whiteSpace: 'nowrap' }}></th>
                </tr>
              </thead>
              <tbody>
                {customizeItems.map((item, idx) => {
                  const origQty = item.originalQuantity ?? item.quantity;
                  const isModified = Number(item.quantity) !== Number(origQty);
                  const hasDiscount = Number(item.discountAmount || 0) > 0;
                  const hasFreeQty = Number(item.freeQuantity || 0) > 0;

                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: isModified ? '#fffbeb' : hasDiscount ? '#f0fdf4' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '8px 12px' }}>
                        <select
                          value={item.finishedProductId || ''}
                          onChange={(e) => updateCustomizeItem(idx, 'finishedProductId', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-default)',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#0f172a',
                            backgroundColor: '#fff',
                          }}
                        >
                          <option value="">{item.productName || 'Select Product...'}</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.productCode ? `${p.productCode} - ` : ''}{p.productName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateCustomizeItem(idx, 'quantity', e.target.value)}
                          style={{
                            width: '65px',
                            padding: '5px 8px',
                            textAlign: 'center',
                            borderRadius: '6px',
                            border: isModified ? '2px solid #f59e0b' : '1px solid var(--border-default)',
                            fontWeight: 700,
                            fontSize: '13px',
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {item.baseRate ? `PKR ${Number(item.baseRate).toLocaleString()}` : '-'}
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                        {hasDiscount ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: '#dcfce7',
                              color: '#15803d',
                              fontWeight: 700,
                              fontSize: '11px',
                            }}
                          >
                            -PKR {Number(item.discountAmount).toLocaleString()} ({item.discountPercent || 0}%)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Standard</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                        {hasFreeQty ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: '#f3e8ff',
                              color: '#7e22ce',
                              fontWeight: 700,
                              fontSize: '11px',
                            }}
                          >
                            +{item.freeQuantity} Free
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                        <input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updateCustomizeItem(idx, 'unitPrice', e.target.value)}
                          style={{
                            width: '90px',
                            padding: '5px 8px',
                            textAlign: 'right',
                            borderRadius: '6px',
                            border: hasDiscount ? '2px solid #10b981' : '1px solid var(--border-default)',
                            fontWeight: 700,
                            fontSize: '13px',
                            color: hasDiscount ? '#047857' : 'inherit',
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                        PKR {Number(item.totalPrice).toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomizeItemRow(idx)}
                          title="Remove item line"
                          style={{ color: '#ef4444', padding: '4px' }}
                        >
                          <IconTrash size={15} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button variant="secondary" size="sm" onClick={addCustomizeItemRow}>
              <IconPlus size={15} /> + Add Another Product Line
            </Button>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Net Items: <strong>{customizeItems.length}</strong> | Total Units: <strong>{customizeItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0)}</strong>
            </div>
          </div>
        </div>
      </Modal>
    );
  };

  const renderConvertModal = () => {
    if (!orderToConvert) return null;
    const convertGrossTotal = convertItems.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.baseRate || i.unitPrice) || 0), 0);
    const convertNetTotal = convertItems.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
    const convertTotalDiscount = convertItems.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.discountAmount) || 0), 0);
    const convertTotalFreeBags = convertItems.reduce((sum, i) => sum + (Number(i.freeQuantity) || 0), 0);

    return (
      <Modal
        size="2xl"
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        title={`Convert Order ${orderToConvert?.orderNumber} to Sale`}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '14px', color: '#0f172a' }}>
                Dispatch Net Value: <strong style={{ color: '#047857', fontSize: '18px', fontWeight: 800 }}>PKR {convertNetTotal.toLocaleString()}</strong>
                {convertTotalDiscount > 0 && (
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>
                    (Gross: PKR {convertGrossTotal.toLocaleString()})
                  </span>
                )}
              </div>
              {convertTotalDiscount > 0 && (
                <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 700, background: '#dcfce7', padding: '3px 10px', borderRadius: '6px' }}>
                  Total Discount: -PKR {convertTotalDiscount.toLocaleString()}
                </span>
              )}
              {convertTotalFreeBags > 0 && (
                <span style={{ fontSize: '12px', color: '#7e22ce', fontWeight: 700, background: '#f3e8ff', padding: '3px 10px', borderRadius: '6px' }}>
                  Bonus: +{convertTotalFreeBags} Free Bags
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
              <Button variant="ghost" onClick={() => setIsConvertModalOpen(false)} disabled={isConvertingToSale}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConvertToSale}
                disabled={isConvertingToSale || isResolvingConvertPricing}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  fontWeight: 700,
                  padding: '10px 20px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                }}
              >
                {isConvertingToSale ? 'Posting Sale & Generating Invoice...' : 'Confirm Dispatch & Post Sale'}
              </Button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Order & Dealer Context Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>
                {orderToConvert.orderNumber}
              </span>
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                {orderToConvert.dealer?.name} {orderToConvert.dealer?.code ? `(${orderToConvert.dealer.code})` : ''}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Booked by: <strong style={{ color: '#0f172a' }}>{orderToConvert.salesOfficer ? (orderToConvert.salesOfficer.name || `${orderToConvert.salesOfficer.firstName || ''} ${orderToConvert.salesOfficer.lastName || ''}`.trim()) : 'Mobile Officer'}</strong>
              {orderToConvert.orderDate && (
                <span style={{ marginLeft: '10px' }}>&bull; {new Date(orderToConvert.orderDate).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* Sales Officer Remarks Card */}
          {orderToConvert.notes ? (
            <div
              style={{
                padding: '12px 16px',
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                borderRadius: '8px',
                border: '1.5px solid #fcd34d',
                boxShadow: '0 2px 4px rgba(245, 158, 11, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 800, color: '#92400e', fontSize: '13px' }}>
                  Sales Officer Remarks / Requested Scheme:
                </span>
                {orderToConvert.salesOfficer && (
                  <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 600 }}>
                    Booked by: <strong>{orderToConvert.salesOfficer.name || `${orderToConvert.salesOfficer.firstName || ''} ${orderToConvert.salesOfficer.lastName || ''}`.trim()}</strong>
                  </span>
                )}
              </div>
              <div style={{ color: '#78350f', fontSize: '14px', fontWeight: 700, fontStyle: 'italic', padding: '2px 0' }}>
                &ldquo;{orderToConvert.notes}&rdquo;
              </div>
              <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
                Select the requested Scheme below &mdash; prices, scheme discounts, and free bonus quantities will auto-calculate dynamically!
              </div>
            </div>
          ) : null}

          {/* Dispatch Warehouse Selector */}
          <div style={{ maxWidth: '420px', marginBottom: '12px' }}>
            <Select
              label="Dispatch Warehouse *"
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              options={warehouses.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
            />
          </div>

          {isResolvingConvertPricing && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: '#ecfdf5',
                borderRadius: '8px',
                border: '1px solid #6ee7b7',
                color: '#065f46',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '10px',
              }}
            >
              <span>Dynamically calculating scheme prices...</span>
            </div>
          )}

          {/* Products & Dynamic Pricing Table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflowX: 'auto', background: '#fff' }}>
            <div style={{ padding: '8px 14px', background: '#f8fafc', fontWeight: 700, fontSize: '13px', color: '#334155', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Products & Dynamic Scheme Rates:</span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>{convertItems.length} Product line item(s)</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr style={{ textAlign: 'left', color: '#475569', fontSize: '12px' }}>
                  <th style={{ padding: '12px 14px', minWidth: '200px', whiteSpace: 'nowrap' }}>Product</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', width: '70px', whiteSpace: 'nowrap' }}>Ordered</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', width: '85px', whiteSpace: 'nowrap' }}>Dispatch Qty</th>
                  <th style={{ padding: '12px 10px', minWidth: '180px', whiteSpace: 'nowrap' }}>Scheme</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', minWidth: '100px', whiteSpace: 'nowrap' }}>Base Rate</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '130px', whiteSpace: 'nowrap' }}>Scheme Discount</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', minWidth: '85px', whiteSpace: 'nowrap' }}>Free Bags</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', minWidth: '105px', whiteSpace: 'nowrap' }}>Net Unit Rate</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '120px', whiteSpace: 'nowrap' }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {convertItems.map((item, idx) => {
                  const origQty = item.originalQuantity ?? item.quantity;
                  const isModified = Number(item.quantity) !== Number(origQty);
                  const hasDiscount = Number(item.discountAmount || 0) > 0;
                  const hasFreeQty = Number(item.freeQuantity || 0) > 0;

                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: hasDiscount ? '#f0fdf4' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                        <div style={{ color: '#0f172a' }}>{item.productName}</div>
                        {item.packing && <span style={{ fontSize: '11px', color: '#64748b' }}>{item.packing}</span>}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                        {origQty}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => updateConvertItemQty(idx, e.target.value)}
                          style={{
                            width: '70px',
                            padding: '5px 6px',
                            textAlign: 'center',
                            borderRadius: '6px',
                            border: isModified ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                            fontWeight: 700,
                            fontSize: '13px',
                          }}
                        />
                      </td>
                      {/* Product-Specific Commercial Scheme */}
                      <td style={{ padding: '8px 10px', minWidth: '180px' }}>
                        <Select
                          placeholder="-- Select Scheme --"
                          value={item.schemeId || ''}
                          options={[
                            { label: 'Standard Catalogue (No Scheme)', value: '' },
                            ...schemeOptions,
                          ]}
                          onChange={(e: any) => updateConvertItemScheme(idx, e?.target?.value || e)}
                          isSearchable={true}
                        />
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', color: '#64748b' }}>
                        {item.baseRate ? `PKR ${Number(item.baseRate).toLocaleString()}` : '-'}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                        {hasDiscount ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: '#dcfce7',
                              color: '#15803d',
                              fontWeight: 700,
                              fontSize: '11px',
                            }}
                          >
                            -PKR {Number(item.discountAmount).toLocaleString()} ({item.discountPercent || 0}%)
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {hasFreeQty ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: '#f3e8ff',
                              color: '#7e22ce',
                              fontWeight: 700,
                              fontSize: '11px',
                            }}
                          >
                            +{item.freeQuantity} Free
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: hasDiscount ? '#047857' : '#0f172a' }}>
                        PKR {Number(item.unitPrice).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#047857', fontSize: '14px' }}>
                        PKR {Number(item.totalPrice).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    );
  };

  const renderRejectModal = () => (
    <Modal
      isOpen={isRejectModalOpen}
      onClose={() => setIsRejectModalOpen(false)}
      title={`Reject Order ${orderToReject?.orderNumber}`}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRejectOrder}>
            Confirm Rejection
          </Button>
        </div>
      }
    >
      <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
        Please specify the reason for rejection. This reason will be dispatched to the sales officer&apos;s mobile device.
      </p>

      <Textarea
        label="Rejection Reason *"
        placeholder="e.g. Dealer exceeds credit limit; or insufficient warehouse stock"
        value={rejectionReason}
        onChange={(e) => setRejectionReason(e.target.value)}
      />
    </Modal>
  );

  if (mode === 'create') {
    const totalOrderValue = formItems.reduce((sum, i) => sum + (Number(i.totalPrice) || 0), 0);
    const totalGrossValue = formItems.reduce(
      (sum, i) => sum + ((Number(i.baseRate) || Number(i.unitPrice) || 0) * (Number(i.quantity) || 1)),
      0,
    );
    const totalSchemeDiscount = formItems.reduce(
      (sum, i) => sum + ((Number(i.discountAmount) || 0) * (Number(i.quantity) || 1)),
      0,
    );
    const totalFreeUnits = formItems.reduce((sum, i) => sum + (Number(i.freeQuantity) || 0), 0);

    const creditLimit = Number(dealerHierarchy?.dealer?.creditLimit || 0);
    const currentBalance = Number(dealerHierarchy?.dealer?.currentBalance || 0);
    const availableCredit = dealerHierarchy?.availableCredit !== undefined
      ? Number(dealerHierarchy.availableCredit)
      : (creditLimit > 0 ? Math.max(0, creditLimit - currentBalance) : 0);
    const remainingCredit = creditLimit > 0 ? availableCredit - totalOrderValue : 0;
    const isCreditExceeded = creditLimit > 0 && totalOrderValue > availableCredit;

    // Schemes and rate lists resolve at line-item level

    return (
      <FormPageTemplate
        title="Create Direct Sale / Sales Order"
        subtitle="Book order and generate commercial sales invoice immediately or save as pending order for field review."
        breadcrumbs={[{ label: 'Sales Orders', onClick: () => setMode('list') }, { label: 'New Sale' }]}
        onCancel={() => setMode('list')}
        onSubmit={() => handleCreateOrder(!isCreditExceeded && generateInvoiceImmediately)}
        submitLabel={!isCreditExceeded && generateInvoiceImmediately ? 'Create & Generate Sales Invoice' : 'Book Sales Order'}
        draftLabel={!isCreditExceeded && generateInvoiceImmediately ? 'Save as Pending Order' : undefined}
        onSaveDraft={!isCreditExceeded && generateInvoiceImmediately ? () => handleCreateOrder(false) : undefined}
      >
        {/* Active Company Context Banner */}
        <div
          style={{
            padding: '14px 20px',
            borderRadius: '12px',
            backgroundColor: '#f0fdf4',
            border: '1.5px solid #86efac',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 800,
              }}
            >
              🏢
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Selling Company Context (Active ERP Scope)
              </div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#14532d' }}>
                {activeCompanyName || 'Holding Company'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                backgroundColor: '#dcfce7',
                color: '#166534',
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid #bbf7d0',
              }}
            >
              Company ID: {activeCompanyId ? `${activeCompanyId.slice(0, 12)}...` : 'Default'}
            </span>
            <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>
              Operating seller is strictly locked to this company
            </span>
          </div>
        </div>

        {/* Direct Sale / Invoice Generation Toggle Banner */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: isCreditExceeded ? '#fff1f2' : generateInvoiceImmediately ? '#eff6ff' : 'var(--bg-subtle, #f8fafc)',
            border: isCreditExceeded ? '2px solid #f43f5e' : generateInvoiceImmediately ? '2px solid #3b82f6' : '1px solid var(--border-default, #cbd5e1)',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: generateInvoiceImmediately && !isCreditExceeded ? '0 4px 12px rgba(59, 130, 246, 0.12)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontWeight: 800,
                  color: isCreditExceeded ? '#be123c' : generateInvoiceImmediately ? '#1e3a8a' : 'var(--text-primary)',
                  fontSize: '15px',
                }}
              >
                {isCreditExceeded ? 'Direct Invoice Blocked — Credit Limit Exceeded' : 'Auto-Generate Commercial Sales Invoice Immediately'}
              </span>
              <span
                style={{
                  backgroundColor: isCreditExceeded ? '#e11d48' : generateInvoiceImmediately ? '#2563eb' : '#6b7280',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                {isCreditExceeded ? 'CREDIT HOLD' : generateInvoiceImmediately ? 'DIRECT SALE' : 'BOOKING ONLY'}
              </span>
            </div>
            <div
              style={{
                fontSize: '13px',
                color: isCreditExceeded ? '#9f1239' : generateInvoiceImmediately ? '#1e40af' : 'var(--text-secondary)',
                marginTop: '4px',
              }}
            >
              {isCreditExceeded
                ? 'Order total exceeds available dealer credit. Must be booked as PENDING / CREDIT_HOLD for credit committee approval.'
                : generateInvoiceImmediately
                  ? 'Approves order, deducts warehouse inventory, debits dealer ledger, creates numbered Sales Invoice, and redirects directly to Sales Invoices!'
                  : 'Saves as PENDING order visible on mobile app. Manager approval and manual conversion required later.'}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isCreditExceeded ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              disabled={isCreditExceeded}
              checked={!isCreditExceeded && generateInvoiceImmediately}
              onChange={(e) => setGenerateInvoiceImmediately(e.target.checked)}
              style={{ width: '22px', height: '22px', cursor: isCreditExceeded ? 'not-allowed' : 'pointer', accentColor: '#2563eb' }}
            />
            <span style={{ color: isCreditExceeded ? '#9f1239' : undefined }}>
              {isCreditExceeded ? 'Disabled' : generateInvoiceImmediately ? 'Invoice Active' : 'Off'}
            </span>
          </label>
        </div>

        <Card style={{ marginBottom: '20px' }}>
          <CardHeader>
            <CardTitle>Order & Dispatch Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>
              <div style={{ gridColumn: 'span 5' }}>
                <SearchableCombobox
                  id="field-so-dealer"
                  label="Dealer (Customer / Party) *"
                  placeholder="Type to search dealer by shop name, address, code, city..."
                  required
                  value={formData.dealerId}
                  onChange={(val) => handleDealerChange(val)}
                  options={dealerOptions}
                  nextFocusId="field-so-warehouse"
                />
              </div>
              <div style={{ gridColumn: 'span 4' }}>
                <SearchableCombobox
                  id="field-so-warehouse"
                  label="Dispatch Warehouse *"
                  placeholder="Select warehouse..."
                  required
                  value={formData.warehouseId || companyWarehouses[0]?.id || ''}
                  onChange={(val) => handleWarehouseChange(val)}
                  options={companyWarehouses.map((w) => ({
                    value: w.id,
                    label: w.name,
                    subtext: w.code ? `Code: ${w.code}${w.type ? ` • ${w.type}` : ''}` : w.type,
                    searchTerms: `${w.name} ${w.code || ''} ${w.type || ''}`,
                  }))}
                  nextFocusId="field-so-order-date"
                />
              </div>

              <div style={{ gridColumn: 'span 3' }}>
                <Input
                  id="field-so-order-date"
                  label="Order Date *"
                  type="date"
                  required
                  value={formData.orderDate}
                  onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('field-so-notes')?.focus();
                    }
                  }}
                />
              </div>

              <div style={{ gridColumn: 'span 12' }}>
                <Input
                  id="field-so-notes"
                  label="Special Notes / Delivery Remarks"
                  placeholder="e.g. Requested transport dock instructions, special delivery timeline"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            {/* System-Resolved Market Hierarchy & 5-Tier Financial Card */}
            {dealerHierarchy && (
              <div
                style={{
                  marginTop: '18px',
                  padding: '16px 20px',
                  backgroundColor: '#f8fafc',
                  border: isCreditExceeded ? '2px solid #fecdd3' : '1px solid #bfdbfe',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ backgroundColor: '#2563eb', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px' }}>
                      SYSTEM-RESOLVED MARKET ATTRIBUTION
                    </span>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                      {dealerHierarchy.dealer?.businessName || dealerHierarchy.dealer?.name || dealerHierarchy.dealerName} ({dealerHierarchy.dealer?.code || dealerHierarchy.dealerCode})
                    </strong>
                    {dealerHierarchy.dealer?.address && (
                      <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                        • {dealerHierarchy.dealer.address}{dealerHierarchy.dealer.city ? `, ${dealerHierarchy.dealer.city}` : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Operating Scope: <strong style={{ color: '#0f172a' }}>{activeCompanyName || 'Holding Company'}</strong>
                  </div>
                </div>

                {/* 4-Tier Real Hierarchy Grid: Province -> Region -> Zone -> Territory */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Province</div>
                    <div style={{ fontWeight: 700, color: '#0284c7', fontSize: '14px', marginTop: '2px' }}>
                      {dealerHierarchy.province || dealerHierarchy.hierarchy?.province || 'Punjab'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Market Jurisdiction
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Tier 1: Region & BM</div>
                    <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '14px', marginTop: '2px' }}>
                      {dealerHierarchy.hierarchy?.region || dealerHierarchy.region?.name || 'Region'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>
                      BM: <strong>{
                        (dealerHierarchy.businessManager?.name && dealerHierarchy.businessManager.name !== 'Unassigned')
                          ? dealerHierarchy.businessManager.name
                          : (typeof dealerHierarchy.region?.businessManager === 'string' && dealerHierarchy.region.businessManager !== 'Unassigned'
                            ? dealerHierarchy.region.businessManager
                            : (dealerHierarchy.businessManager?.firstName && dealerHierarchy.businessManager.firstName !== 'Unassigned'
                              ? `${dealerHierarchy.businessManager.firstName} ${dealerHierarchy.businessManager.lastName || ''}`.trim()
                              : (dealerHierarchy.hierarchy?.businessManager || 'Unassigned')))
                      }</strong>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Tier 2: Zone & AM</div>
                    <div style={{ fontWeight: 700, color: '#047857', fontSize: '14px', marginTop: '2px' }}>
                      {dealerHierarchy.hierarchy?.zone || dealerHierarchy.zone?.name || 'Zone'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>
                      AM: <strong>{
                        (dealerHierarchy.areaManager?.name && dealerHierarchy.areaManager.name !== 'Unassigned')
                          ? dealerHierarchy.areaManager.name
                          : (typeof dealerHierarchy.zone?.areaManager === 'string' && dealerHierarchy.zone.areaManager !== 'Unassigned'
                            ? dealerHierarchy.zone.areaManager
                            : (dealerHierarchy.areaManager?.firstName && dealerHierarchy.areaManager.firstName !== 'Unassigned'
                              ? `${dealerHierarchy.areaManager.firstName} ${dealerHierarchy.areaManager.lastName || ''}`.trim()
                              : (dealerHierarchy.hierarchy?.areaManager || 'Unassigned')))
                      }</strong>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Tier 3: Territory & SO</div>
                    <div style={{ fontWeight: 700, color: '#d97706', fontSize: '14px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{dealerHierarchy.hierarchy?.territory || dealerHierarchy.territory?.name || 'Territory'}</span>
                      {(dealerHierarchy.territoryCode || dealerHierarchy.hierarchy?.territoryCode) && (
                        <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                          {dealerHierarchy.territoryCode || dealerHierarchy.hierarchy?.territoryCode}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>
                      Responsible SO: <strong style={{ color: '#2563eb' }}>{
                        (dealerHierarchy.salesOfficer?.name && dealerHierarchy.salesOfficer.name !== 'ERP Direct' && dealerHierarchy.salesOfficer.name !== 'Unassigned')
                          ? dealerHierarchy.salesOfficer.name
                          : (typeof dealerHierarchy.territory?.salesOfficer === 'string' && dealerHierarchy.territory.salesOfficer !== 'ERP Direct' && dealerHierarchy.territory.salesOfficer !== 'Unassigned'
                            ? dealerHierarchy.territory.salesOfficer
                            : (dealerHierarchy.salesOfficer?.firstName && dealerHierarchy.salesOfficer.firstName !== 'ERP Direct' && dealerHierarchy.salesOfficer.firstName !== 'undefined'
                              ? `${dealerHierarchy.salesOfficer.firstName} ${dealerHierarchy.salesOfficer.lastName || ''}`.trim()
                              : (dealerHierarchy.hierarchy?.salesOfficer || 'ERP Direct')))
                      }</strong>
                    </div>
                  </div>
                </div>

                {/* 5-Tier Financial Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Dealer Credit Limit</div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px', marginTop: '2px' }}>
                      PKR {creditLimit.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Current Outstanding</div>
                    <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '15px', marginTop: '2px' }}>
                      PKR {currentBalance.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Available Credit</div>
                    <div style={{ fontWeight: 800, color: availableCredit > 0 ? '#16a34a' : '#dc2626', fontSize: '15px', marginTop: '2px' }}>
                      PKR {availableCredit.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Current Order Value</div>
                    <div style={{ fontWeight: 800, color: '#2563eb', fontSize: '15px', marginTop: '2px' }}>
                      PKR {totalOrderValue.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isCreditExceeded ? '#fca5a5' : '#86efac'}` }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Remaining Credit</div>
                    <div style={{ fontWeight: 800, color: remainingCredit >= 0 ? '#16a34a' : '#dc2626', fontSize: '15px', marginTop: '2px' }}>
                      PKR {remainingCredit.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Credit Limit Alert Banner */}
                {isCreditExceeded && (
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '12px 16px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #f87171',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      color: '#991b1b',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    <IconAlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <div>
                      <strong>Credit Limit Exceeded:</strong> Order total of PKR {totalOrderValue.toLocaleString()} exceeds available credit of PKR {availableCredit.toLocaleString()} by PKR {(totalOrderValue - availableCredit).toLocaleString()}.
                      Immediate invoice generation is disabled; this order will be routed to CREDIT_HOLD pending management approval.
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <CardTitle>Ordered Products</CardTitle>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Select product, warehouse batch, and applicable commercial scheme per line item.
                </div>
              </div>
              <Button id="btn-add-product-line" variant="secondary" size="sm" onClick={addItemRow}>
                <IconPlus size={16} /> Add Product Line
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflowX: 'auto', background: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr style={{ textAlign: 'left', color: '#475569', fontSize: '12px' }}>
                    <th style={{ padding: '10px 10px', width: '36px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '10px 12px', minWidth: '130px' }}>Scheme *</th>
                    <th style={{ padding: '10px 12px', minWidth: '220px' }}>Finished Product *</th>
                    <th style={{ padding: '10px 12px', minWidth: '180px' }}>Batch in WH *</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: '90px' }}>Qty *</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', minWidth: '95px' }}>Base Rate</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', minWidth: '110px' }}>Discount</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', minWidth: '105px' }}>Net Price</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', minWidth: '120px' }}>Line Total</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {formItems.map((item, idx) => {
                    const hasDiscount = Number(item.discountAmount || 0) > 0;
                    const selectedBatch = item.availableBatches?.find((b: any) => b.id === item.batchId);
                    const availBatchStock = selectedBatch ? Number(selectedBatch.availableQuantity) : null;
                    const isBatchStockExceeded = availBatchStock !== null && Number(item.quantity) > availBatchStock;

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: isBatchStockExceeded ? '#fef2f2' : undefined }}>
                        <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                          {idx + 1}
                        </td>

                        {/* Product-Specific Commercial Scheme */}
                        <td style={{ padding: '10px 12px', minWidth: '130px' }}>
                          <Select
                            id={`field-item-scheme-${idx}`}
                            placeholder="-- Select Scheme --"
                            value={item.schemeId || ''}
                            options={[
                              { value: '', label: '-- No Scheme --' },
                              ...schemeOptions,
                            ]}
                            onChange={(e: any) => updateItem(idx, 'schemeId', e?.target?.value || e)}
                            isSearchable={true}
                          />
                        </td>

                        {/* Finished Product Selector */}
                        <td style={{ padding: '10px 12px', minWidth: '220px' }}>
                          <Select
                            id={`field-item-product-${idx}`}
                            placeholder="Select Finished Product..."
                            value={item.finishedProductId || ''}
                            options={productOptions}
                            onChange={(e: any) => updateItem(idx, 'finishedProductId', e?.target?.value || e)}
                            isSearchable={true}
                          />
                        </td>

                        {/* Warehouse-Specific Batches */}
                        <td style={{ padding: '10px 12px', minWidth: '180px' }}>
                          <Select
                            id={`field-item-batch-${idx}`}
                            placeholder={item.finishedProductId ? ((item.availableBatches || []).length > 0 ? "-- Select Batch in WH --" : "No batches in selected WH") : "Select product first"}
                            value={item.batchId || ''}
                            disabled={!item.finishedProductId || (item.availableBatches || []).length === 0}
                            options={(item.availableBatches || []).map((b: any) => ({
                              value: b.id,
                              label: `${b.batchNumber} (Stock: ${b.availableQuantity})${b.isExpired ? ' [EXPIRED]' : ''}`,
                              disabled: b.isExpired,
                            }))}
                            onChange={(e: any) => updateItem(idx, 'batchId', e?.target?.value || e)}
                            isSearchable={true}
                          />
                        </td>

                        {/* Quantity with inline stock validation */}
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <input
                            id={`field-item-qty-${idx}`}
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (idx < formItems.length - 1) {
                                  const nextEl = document.getElementById(`field-item-scheme-${idx + 1}`) || document.getElementById(`field-item-product-${idx + 1}`);
                                  nextEl?.focus();
                                } else {
                                  document.getElementById('btn-add-product-line')?.focus();
                                }
                              }
                            }}
                            style={{
                              width: '75px',
                              padding: '6px 8px',
                              textAlign: 'center',
                              borderRadius: '6px',
                              border: isBatchStockExceeded ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                              fontWeight: 700,
                              fontSize: '13px',
                            }}
                          />
                          {isBatchStockExceeded && (
                            <div style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap' }}>
                              Max: {availBatchStock}
                            </div>
                          )}
                        </td>

                        {/* Base Rate */}
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontSize: '12.5px' }}>
                          {item.baseRate ? `PKR ${Number(item.baseRate).toLocaleString()}` : '—'}
                        </td>

                        {/* Discount */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {hasDiscount ? (
                            <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '11px', display: 'inline-block' }}>
                              -PKR {Number(item.discountAmount).toLocaleString()}{item.discountPercent ? ` (${item.discountPercent}%)` : ''}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                          )}
                        </td>

                        {/* Net Price */}
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: hasDiscount ? '#047857' : '#0f172a' }}>
                          {item.unitPrice ? `PKR ${Number(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </td>

                        {/* Line Total */}
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#047857', fontSize: '14px' }}>
                          PKR {Number(item.totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Remove Row */}
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={formItems.length === 1}
                            onClick={() => removeItemRow(idx)}
                            style={{ padding: '4px', opacity: formItems.length === 1 ? 0.3 : 1 }}
                            title="Remove row"
                          >
                            <IconTrash size={16} color="var(--color-danger)" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Order Summary Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                marginTop: '20px',
                padding: '16px 20px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
              }}
            >
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Gross Total</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#334155' }}>
                    PKR {totalGrossValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                {totalSchemeDiscount > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#16a34a', textTransform: 'uppercase', fontWeight: 700 }}>Scheme Savings</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#16a34a' }}>
                      -PKR {totalSchemeDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
                {totalFreeUnits > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#7e22ce', textTransform: 'uppercase', fontWeight: 700 }}>Free Products</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#7e22ce' }}>
                      +{totalFreeUnits} Free Units
                    </div>
                  </div>
                )}
              </div>

              <div style={{ fontWeight: 800, fontSize: '22px', color: '#047857', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>Net Total Payable:</span>
                <span>PKR {totalOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </FormPageTemplate>
    );
  }

  if (mode === 'detail' && selectedOrder) {
    return (
      <DetailPageTemplate
        title={`Sales Order ${selectedOrder.orderNumber}`}
        subtitle={`Dealer: ${selectedOrder.dealer?.name} | Booked by: ${selectedOrder.salesOfficer ? (selectedOrder.salesOfficer.name || `${selectedOrder.salesOfficer.firstName || ''} ${selectedOrder.salesOfficer.lastName || ''}`.trim() || 'Direct') : 'Direct'
          }`}
        breadcrumbs={[{ label: 'Sales Orders', onClick: () => setMode('list') }, { label: selectedOrder.orderNumber }]}
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setMode('list')}>
              Back to List
            </Button>
            {isOrderPendingOrApproved(selectedOrder.status) && (
              <Button
                variant="secondary"
                onClick={() => openCustomizeModal(selectedOrder)}
                style={{
                  borderColor: '#3b82f6',
                  color: '#1d4ed8',
                  background: '#eff6ff',
                  fontWeight: 600,
                }}
              >
                <IconEdit size={16} /> Apply Scheme & Customize
              </Button>
            )}
            {isOrderPending(selectedOrder.status) ? (
              <>
                <Button
                  variant="primary"
                  onClick={() => openConvertModal(selectedOrder)}
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    fontWeight: 600,
                  }}
                >
                  <IconCheck size={16} /> Approve & Convert to Invoice
                </Button>
                <Button variant="secondary" onClick={() => handleApproveOrder(selectedOrder.id)}>
                  <IconCheck size={16} /> Approve Only
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setOrderToReject(selectedOrder);
                    setIsRejectModalOpen(true);
                  }}
                >
                  Reject Order
                </Button>
              </>
            ) : isOrderApproved(selectedOrder.status) ? (
              <Button
                variant="primary"
                onClick={() => openConvertModal(selectedOrder)}
              >
                Convert to Sale & Dispatch
              </Button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <StatusBadge status={selectedOrder.status} variant="success" />
                <Button
                  variant="primary"
                  onClick={() => handleOpenInvoice(selectedOrder)}
                  style={{
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  }}
                >
                  <IconFileText size={16} /> Print / View Invoice
                </Button>
              </div>
            )}
            {selectedOrder.status !== 'CONVERTED_TO_SALE' && (
              <Button
                variant="ghost"
                onClick={() => handleDeleteOrder(selectedOrder.id, selectedOrder.orderNumber)}
                style={{ color: '#ef4444' }}
              >
                <IconTrash size={16} /> Delete Order
              </Button>
            )}
          </div>
        }
      >
        {/* Prominent Sales Officer Remarks Card */}
        {selectedOrder.notes && (
          <div
            style={{
              padding: '16px 20px',
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              borderRadius: '10px',
              border: '1.5px solid #fcd34d',
              marginBottom: '20px',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#92400e', fontSize: '14px' }}>
                <span>Sales Officer Order Remarks / Scheme Request:</span>
              </div>
              {selectedOrder.salesOfficer && (
                <span style={{ fontSize: '12px', color: '#b45309', fontWeight: 600 }}>
                  Booked by {selectedOrder.salesOfficer.name || `${selectedOrder.salesOfficer.firstName || ''} ${selectedOrder.salesOfficer.lastName || ''}`.trim()}
                </span>
              )}
            </div>
            <div style={{ color: '#78350f', fontSize: '15px', fontWeight: 700, fontStyle: 'italic', padding: '4px 0' }}>
              &ldquo;{selectedOrder.notes}&rdquo;
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
              <div style={{ fontSize: '12px', color: '#92400e' }}>
                Applied Scheme: <strong>{selectedOrder.appliedSchemeName || (selectedOrder as any).scheme?.name || 'Standard Rate List'}</strong>
              </div>
              {(selectedOrder.status === 'PENDING' || selectedOrder.status === 'APPROVED') && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => openCustomizeModal(selectedOrder)}
                  style={{
                    background: '#d97706',
                    fontSize: '12px',
                    padding: '4px 12px',
                    fontWeight: 700,
                  }}
                >
                  Select / Change Scheme
                </Button>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <CardTitle>Order Line Items</CardTitle>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Scheme: <strong>{selectedOrder.appliedSchemeName || (selectedOrder as any).scheme?.name || 'Standard'}</strong>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', background: 'var(--bg-subtle)' }}>
                    <th style={{ padding: '8px 10px' }}>Product</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Base Rate</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Scheme Discount</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Free Bags</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Final Rate</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrder.items || []).map((item, idx) => {
                    const hasDiscount = Number(item.discountAmount || 0) > 0;
                    const hasFree = Number(item.freeQuantity || 0) > 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 10px', fontWeight: 600 }}>{item.productName}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                          {item.baseRate ? `PKR ${Number(item.baseRate).toLocaleString()}` : '-'}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                          {hasDiscount ? (
                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '11px' }}>
                              -PKR {Number(item.discountAmount).toLocaleString()}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                          {hasFree ? (
                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#f3e8ff', color: '#7e22ce', fontWeight: 700, fontSize: '11px' }}>
                              +{item.freeQuantity} Free
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: hasDiscount ? '#047857' : 'inherit' }}>
                          PKR {Number(item.unitPrice).toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                          PKR {Number(item.totalPrice).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dealer Credit Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Order Value:</span>
                  <span style={{ fontWeight: 700 }}>PKR {Number(selectedOrder.totalAmount).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Current Ledger Balance:</span>
                  <span>PKR {Number(selectedOrder.dealer?.currentBalance || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Credit Limit:</span>
                  <span>PKR {Number(selectedOrder.dealer?.creditLimit || 0).toLocaleString()}</span>
                </div>

                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13px',
                  }}
                >
                  <p style={{ fontWeight: 600 }}>Mobile Sync Status</p>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Both ERP and Mobile read this exact record. Any status change here is instantly visible to the field officer.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <SalesInvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          invoice={activeInvoice}
        />
        {renderCustomizeModal()}
        {renderConvertModal()}
        {renderRejectModal()}
      </DetailPageTemplate>
    );
  }

  return (
    <ListPageTemplate
      title="Sales Orders (Dealer Booking)"
      subtitle="Unified sales order book shared seamlessly across Sales Officer Mobile App and ERP Web."
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          {onNavigateToInvoices && (
            <Button
              variant="secondary"
              onClick={onNavigateToInvoices}
              style={{
                background: '#eff6ff',
                borderColor: '#bfdbfe',
                color: '#1d4ed8',
                fontWeight: 600,
              }}
            >
              <IconFileText size={16} /> View Sales Invoices →
            </Button>
          )}
          <Button variant="primary" onClick={() => setMode('create')}>
            <IconPlus size={16} /> Book Sales Order
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
        <KpiCard title="Total Orders" value={totalOrders} subtitle="All booked orders" />
        <KpiCard title="Pending Approvals" value={pendingOrders} subtitle="Awaiting manager sign-off" />
        <KpiCard title="Approved For Dispatch" value={approvedOrders} subtitle="Ready to convert to sale" />
        <KpiCard title="Dispatched / Sold" value={convertedSales} subtitle="Stock and ledger posted" />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <Input
            placeholder="Search by order #, dealer, or sales officer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { label: 'All Statuses', value: 'ALL' },
            { label: 'PENDING', value: 'PENDING' },
            { label: 'APPROVED', value: 'APPROVED' },
            { label: 'CONVERTED_TO_SALE', value: 'CONVERTED_TO_SALE' },
            { label: 'REJECTED', value: 'REJECTED' },
          ]}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title="No Sales Orders Found"
          description="Sales orders booked via the Sales Officer Mobile App or ERP web interface will appear here."
          actionLabel="Book Sales Order"
          onAction={() => setMode('create')}
        />
      ) : (
        <DataTable columns={columns} data={filteredOrders} />
      )}

      {/* Modals rendered on List page */}
      {renderCustomizeModal()}
      {renderConvertModal()}
      {renderRejectModal()}

      {/* Modern Colorful Sales Invoice Modal */}
      <SalesInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        invoice={activeInvoice}
      />

      {/* Floating Action Dropdown Portal (Rendered above table row) */}
      {renderActionPortal()}
    </ListPageTemplate>
  );
};
