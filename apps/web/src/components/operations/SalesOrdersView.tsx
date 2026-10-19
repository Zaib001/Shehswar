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
} from '../icons';
import { useToast } from '../../context/toast-context';
import { ApiClient } from '../../lib/api-client';
import { SalesInvoiceModal } from './SalesInvoiceModal';
import { SalesInvoiceExportData } from '../../lib/pdf-export';

export interface SalesOrderItemRow {
  finishedProductId?: string;
  rateListId?: string;
  schemeId?: string;
  productName: string;
  packing?: string;
  quantity: number;
  baseRate?: number;
  discountPercent?: number;
  discountAmount?: number;
  freeQuantity?: number;
  unitPrice: number;
  totalPrice: number;
  commercialCondition?: string;
  originalQuantity?: number;
}

export interface SalesOrderRecord {
  id: string;
  orderNumber: string;
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
  salesOfficer?: { id: string; firstName: string; lastName: string };
  warehouseId?: string;
  totalAmount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED_TO_SALE';
  rejectionReason?: string;
  notes?: string;
  items?: SalesOrderItemRow[];
}

export interface SalesOrdersViewProps {
  onNavigateToInvoices?: () => void;
}

export const SalesOrdersView: React.FC<SalesOrdersViewProps> = ({ onNavigateToInvoices }) => {
  const { showToast } = useToast();
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
  const [convertSchemeId, setConvertSchemeId] = useState('');
  const [convertRateListId, setConvertRateListId] = useState('');
  const [convertPaymentTerm, setConvertPaymentTerm] = useState('CASH');
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

  const handleDealerChange = (dealerId: string) => {
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
      const [orderRes, dealerRes, whRes, prodRes, schemesRes, rateListsRes] = await Promise.all([
        ApiClient.get<any>('/api/v1/sales-orders').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/dealers').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/warehouses').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/master-data/finished-products').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/pricing/schemes').catch(() => ({ data: [] })),
        ApiClient.get<any>('/api/v1/pricing/rate-lists').catch(() => ({ data: [] })),
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
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time authoritative price resolution for line item
  const resolveLinePrice = async (
    idx: number,
    prodId: string,
    qty: number,
    paymentTerm?: string,
    schemeId?: string,
    rateListId?: string,
  ) => {
    if (!prodId) return;
    try {
      const res = await ApiClient.post<any>('/api/v1/pricing/resolve', {
        dealerId: formData.dealerId || undefined,
        finishedProductId: prodId,
        quantity: qty,
        paymentTerm: paymentTerm || formData.paymentTerm,
        requestedSchemeId: schemeId !== undefined ? (schemeId || undefined) : (formData.schemeId || undefined),
        rateListId: rateListId !== undefined ? (rateListId || undefined) : (formData.rateListId || undefined),
      });

      const r = res.data?.data || res.data;
      if (r) {
        setFormItems((prev) => {
          const next = [...prev];
          if (next[idx]) {
            next[idx] = {
              ...next[idx],
              baseRate: r.baseRate,
              unitPrice: r.finalUnitRate,
              discountPercent: r.discountPercent,
              discountAmount: r.discountAmount,
              freeQuantity: r.freeQuantity || 0,
              totalPrice: r.finalAmount,
              commercialCondition: r.commercialCondition || undefined,
            };
          }
          return next;
        });
      }
    } catch {
      // Keep manual price on error
    }
  };

  const recalculateAllItems = (paymentTerm: string, schemeId: string, rateListId?: string) => {
    formItems.forEach((it, idx) => {
      if (it.finishedProductId) {
        resolveLinePrice(idx, it.finishedProductId, it.quantity, paymentTerm, schemeId, rateListId);
      }
    });
  };

  // Form item updates
  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...formItems];
    const item = { ...updated[index], [field]: value } as SalesOrderItemRow;

    if (field === 'finishedProductId') {
      const prod = products.find((p) => p.id === value);
      if (prod) {
        item.productName = prod.productName;
        item.baseRate = Number(prod.defaultSellingPrice || 1200);
        item.unitPrice = Number(prod.defaultSellingPrice || 1200);
        item.totalPrice = (Number(item.quantity) || 1) * item.unitPrice;
      }
      resolveLinePrice(index, value, Number(item.quantity) || 1);
    } else if (field === 'quantity') {
      const qty = Number(value) || 1;
      item.totalPrice = qty * Number(item.unitPrice || 0);
      if (item.finishedProductId) {
        resolveLinePrice(index, item.finishedProductId, qty, undefined, item.schemeId);
      }
    } else if (field === 'schemeId') {
      item.schemeId = value;
      if (item.finishedProductId) {
        resolveLinePrice(index, item.finishedProductId, Number(item.quantity) || 1, undefined, value);
      }
    } else if (field === 'unitPrice') {
      const price = Number(value) || 0;
      item.totalPrice = (Number(item.quantity) || 1) * price;
    }

    updated[index] = item;
    setFormItems(updated);
  };

  const addItemRow = () => {
    setFormItems([
      ...formItems,
      {
        finishedProductId: '',
        productName: '',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
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
    if (formItems.some((i) => !i.productName || Number(i.quantity) <= 0)) {
      showToast({ title: 'Validation Error', message: 'All line items must have a product and quantity', type: 'error' });
      return;
    }
    if (immediateInvoice && formItems.some((i) => Number(i.unitPrice) <= 0)) {
      showToast({ title: 'Validation Error', message: 'To generate an immediate sales invoice, all items must have a resolved price', type: 'error' });
      return;
    }

    try {
      const warehouseIdToUse = formData.warehouseId || warehouses[0]?.id;
      const res = await ApiClient.post<any>('/api/v1/sales-orders', {
        ...formData,
        warehouseId: warehouseIdToUse,
        items: formItems,
      });

      const createdOrder = res.data?.data || res.data;

      if (immediateInvoice && createdOrder?.id) {
        // 1. Auto-approve
        await ApiClient.patch(`/api/v1/sales-orders/${createdOrder.id}/approve`, { approved: true });

        // 2. Convert to sale & generate invoice
        const convRes = await ApiClient.post<any>(`/api/v1/sales-orders/${createdOrder.id}/convert-to-sale`, {
          warehouseId: warehouseIdToUse,
        });

        const invoice = convRes.data?.data || convRes.data;

        showToast({
          title: 'Direct Sale Invoice Created!',
          message: 'Sales Invoice generated, inventory deducted, and dealer ledger updated.',
          type: 'success',
        });

        setMode('list');
        loadData();

        if (invoice && invoice.invoiceNumber) {
          setActiveInvoice(invoice);
          setIsInvoiceModalOpen(true);
        }

        // Navigate to Sales Invoices!
        if (onNavigateToInvoices) {
          setTimeout(() => {
            onNavigateToInvoices();
          }, 800);
        }
        return;
      }

      showToast({ title: 'Success', message: 'Sales order booked successfully', type: 'success' });
      setMode('list');
      loadData();
    } catch (err: any) {
      showToast({ title: 'Error', message: err.message || 'Failed to create sales order', type: 'error' });
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
        dealer: order.dealer,
        warehouse: warehouses.find((w) => w.id === order.warehouseId) || warehouses[0],
        salesOrder: {
          orderNumber: order.orderNumber,
          orderDate: order.orderDate,
          salesOfficer: order.salesOfficer,
        },
        items: (order.items || []).map((it) => ({
          productName: it.productName,
          packing: it.packing || 'Commercial Pack',
          quantity: it.quantity,
          rate: it.unitPrice,
          grossAmount: it.totalPrice,
          discountAmount: 0,
          taxAmount: 0,
          netAmount: it.totalPrice,
        })),
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
              dealerId: orderToCustomize.dealerId,
              finishedProductId: it.finishedProductId,
              quantity: Number(it.quantity) || 1,
              paymentTerm: paymentTermToUse,
              requestedSchemeId: schemeIdToUse || undefined,
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
    recalculateCustomizePricing(customizeItems, newSchemeId, customizeRateListId, customizePaymentTerm);
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
            dealerId: orderToCustomize.dealerId,
            finishedProductId: prodId,
            quantity: qty,
            paymentTerm: customizePaymentTerm,
            requestedSchemeId: customizeSchemeId || undefined,
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
              dealerId: targetDealerId,
              finishedProductId: it.finishedProductId,
              quantity: Number(it.quantity) || 1,
              paymentTerm: paymentTermToUse,
              requestedSchemeId: schemeIdToUse || undefined,
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

  const handleConvertSchemeChange = (newSchemeId: string) => {
    setConvertSchemeId(newSchemeId);
    recalculateConvertPricing(convertItems, newSchemeId, convertRateListId, convertPaymentTerm);
  };

  const handleConvertRateListChange = (newRateListId: string) => {
    setConvertRateListId(newRateListId);
    recalculateConvertPricing(convertItems, convertSchemeId, newRateListId, convertPaymentTerm);
  };

  const handleConvertPaymentTermChange = (newPaymentTerm: string) => {
    setConvertPaymentTerm(newPaymentTerm);
    recalculateConvertPricing(convertItems, convertSchemeId, convertRateListId, newPaymentTerm);
  };

  // Open Convert to Sale Modal with adjustable items & dynamic scheme pricing
  const openConvertModal = (order: SalesOrderRecord) => {
    setOrderToConvert(order);
    setSelectedWarehouseId(order.warehouseId || warehouses[0]?.id || '');
    const schemeToUse = order.schemeId || '';
    const rateListToUse = order.rateListId || rateLists[0]?.id || '';
    const paymentTermToUse = order.paymentTerm || 'CASH';
    setConvertSchemeId(schemeToUse);
    setConvertRateListId(rateListToUse);
    setConvertPaymentTerm(paymentTermToUse);

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
      schemeId: i.schemeId || schemeToUse,
      rateListId: i.rateListId || rateListToUse,
    }));
    setConvertItems(initialItems);
    setIsConvertModalOpen(true);

    // Auto-resolve prices if any item has 0 price or if scheme/rate list is available
    if (initialItems.some((it) => !it.unitPrice || it.unitPrice === 0) || schemeToUse || rateListToUse) {
      recalculateConvertPricing(initialItems, schemeToUse, rateListToUse, paymentTermToUse, order.dealerId);
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
          dealerId: orderToConvert.dealerId,
          finishedProductId: item.finishedProductId,
          quantity: qty,
          paymentTerm: convertPaymentTerm,
          requestedSchemeId: convertSchemeId || undefined,
          rateListId: convertRateListId || undefined,
        });
        const r = res.data?.data || res.data;
        if (r) {
          item.baseRate = r.baseRate;
          item.unitPrice = r.finalUnitRate;
          item.discountPercent = r.discountPercent;
          item.discountAmount = r.discountAmount;
          item.freeQuantity = r.freeQuantity || 0;
          item.totalPrice = r.finalAmount;
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
      // 1. Update order with selected scheme and dynamic prices
      const totalDiscount = convertItems.reduce(
        (sum, it) => sum + (Number(it.discountAmount || 0) * Number(it.quantity || 1)),
        0,
      );
      const totalFree = convertItems.reduce(
        (sum, it) => sum + Number(it.freeQuantity || 0),
        0,
      );

      await ApiClient.patch(`/api/v1/sales-orders/${orderToConvert.id}`, {
        warehouseId: selectedWarehouseId,
        schemeId: convertSchemeId || null,
        rateListId: convertRateListId || null,
        paymentTerm: convertPaymentTerm,
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
          schemeId: convertSchemeId || null,
          rateListId: convertRateListId || null,
          commercialCondition: i.commercialCondition || null,
        })),
      });

      // 2. If order is PENDING, auto-approve first before converting!
      if (orderToConvert.status === 'PENDING') {
        await ApiClient.patch(`/api/v1/sales-orders/${orderToConvert.id}/approve`, { approved: true });
      }

      // 3. Convert to Sale and generate invoice
      const res = await ApiClient.post<any>(`/api/v1/sales-orders/${orderToConvert.id}/convert-to-sale`, {
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
      (o.salesOfficer && `${o.salesOfficer.firstName} ${o.salesOfficer.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()));
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
        o.salesOfficer ? `${o.salesOfficer.firstName} ${o.salesOfficer.lastName}` : 'ERP Direct',
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
                    Booked by: <strong>{orderToCustomize.salesOfficer.firstName} {orderToCustomize.salesOfficer.lastName}</strong>
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
                ...schemes.map((s) => ({
                  label: `${s.code} - ${s.name}`,
                  value: s.id,
                })),
              ]}
            />
            <Select
              label="Commercial Rate List *"
              value={customizeRateListId}
              onChange={(e) => handleCustomizeRateListChange(e.target.value)}
              options={[
                { label: 'Master Catalogue Rates', value: '' },
                ...rateLists.map((rl) => ({
                  label: `${rl.code} - ${rl.name}`,
                  value: rl.id,
                })),
              ]}
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
              Booked by: <strong style={{ color: '#0f172a' }}>{orderToConvert.salesOfficer ? `${orderToConvert.salesOfficer.firstName} ${orderToConvert.salesOfficer.lastName}` : 'Mobile Officer'}</strong>
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
                    Booked by: <strong>{orderToConvert.salesOfficer.firstName} {orderToConvert.salesOfficer.lastName}</strong>
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

          {/* Scheme, Rate List, Payment Term, and Warehouse Selectors (Spacious 2x2 grid) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            <Select
              label="Select Scheme (Auto-Updates Prices) *"
              value={convertSchemeId}
              onChange={(e) => handleConvertSchemeChange(e.target.value)}
              options={[
                { label: 'Standard Catalogue (No Scheme)', value: '' },
                ...schemes.map((s) => ({
                  label: `${s.code} - ${s.name}`,
                  value: s.id,
                })),
              ]}
            />
            <Select
              label="Commercial Rate List *"
              value={convertRateListId}
              onChange={(e) => handleConvertRateListChange(e.target.value)}
              options={[
                { label: 'Master Catalogue Rates', value: '' },
                ...rateLists.map((rl) => ({
                  label: `${rl.code} - ${rl.name}`,
                  value: rl.id,
                })),
              ]}
            />
            <Select
              label="Payment Term *"
              value={convertPaymentTerm}
              onChange={(e) => handleConvertPaymentTermChange(e.target.value)}
              options={[
                { label: 'CASH (Immediate Settlement)', value: 'CASH' },
                { label: 'CREDIT (Standard Terms)', value: 'CREDIT' },
                { label: 'ADVANCE (Pre-Payment)', value: 'ADVANCE' },
              ]}
            />
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
              }}
            >
              <span>Dynamically fetching rate list & calculating scheme prices...</span>
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
                  <th style={{ padding: '12px 14px', minWidth: '220px', whiteSpace: 'nowrap' }}>Product</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', width: '80px', whiteSpace: 'nowrap' }}>Ordered</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', width: '90px', whiteSpace: 'nowrap' }}>Dispatch Qty</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', minWidth: '100px', whiteSpace: 'nowrap' }}>Base Rate</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '130px', whiteSpace: 'nowrap' }}>Scheme Discount</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', minWidth: '95px', whiteSpace: 'nowrap' }}>Free Bags</th>
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
    const totalOrderValue = formItems.reduce((sum, i) => sum + i.totalPrice, 0);

    return (
      <FormPageTemplate
        title="Create Direct Sale / Sales Order"
        subtitle="Book order and generate commercial sales invoice immediately or save as pending order for field review."
        breadcrumbs={[{ label: 'Sales Orders', onClick: () => setMode('list') }, { label: 'New Sale' }]}
        onCancel={() => setMode('list')}
        onSubmit={() => handleCreateOrder(generateInvoiceImmediately)}
        submitLabel={generateInvoiceImmediately ? 'Create & Generate Sales Invoice' : 'Book Sales Order'}
        draftLabel={generateInvoiceImmediately ? 'Save as Pending Order' : undefined}
        onSaveDraft={generateInvoiceImmediately ? () => handleCreateOrder(false) : undefined}
      >
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: generateInvoiceImmediately ? '#eff6ff' : 'var(--bg-subtle)',
            border: generateInvoiceImmediately ? '2px solid #3b82f6' : '1px solid var(--border-default)',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: generateInvoiceImmediately ? '0 4px 12px rgba(59, 130, 246, 0.12)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontWeight: 800,
                  color: generateInvoiceImmediately ? '#1e3a8a' : 'var(--text-primary)',
                  fontSize: '15px',
                }}
              >
               Auto-Generate Commercial Sales Invoice Immediately
              </span>
              <span
                style={{
                  backgroundColor: generateInvoiceImmediately ? '#2563eb' : '#6b7280',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                {generateInvoiceImmediately ? 'DIRECT SALE' : 'BOOKING ONLY'}
              </span>
            </div>
            <div
              style={{
                fontSize: '13px',
                color: generateInvoiceImmediately ? '#1e40af' : 'var(--text-secondary)',
                marginTop: '4px',
              }}
            >
              {generateInvoiceImmediately
                ? 'Approves order, deducts warehouse inventory, debits dealer ledger, creates numbered Sales Invoice, and moves directly to Sales Invoices!'
                : 'Saves as PENDING order visible on mobile app. Manager approval and manual conversion required later.'}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={generateInvoiceImmediately}
              onChange={(e) => setGenerateInvoiceImmediately(e.target.checked)}
              style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#2563eb' }}
            />
            <span>{generateInvoiceImmediately ? 'Invoice Active' : 'Off'}</span>
          </label>
        </div>

        <Card style={{ marginBottom: '20px' }}>
          <CardHeader>
            <CardTitle>Order & Dispatch Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>
              <div style={{ gridColumn: 'span 7' }}>
                <Select
                  label="Dealer *"
                  value={formData.dealerId}
                  onChange={(e) => handleDealerChange(e.target.value)}
                  options={[
                    { label: 'Select Dealer...', value: '' },
                    ...dealers.map((d) => ({ label: `${d.code} - ${d.name}`, value: d.id })),
                  ]}
                />
              </div>
              <div style={{ gridColumn: 'span 5' }}>
                <Select
                  label="Dispatch Warehouse *"
                  value={formData.warehouseId || warehouses[0]?.id || ''}
                  onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                  options={[
                    { label: 'Select Warehouse...', value: '' },
                    ...warehouses.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id })),
                  ]}
                />
              </div>
              <div style={{ gridColumn: 'span 4' }}>
                <Select
                  label="Commercial Rate List *"
                  value={formData.rateListId}
                  onChange={(e) => {
                    const rlId = e.target.value;
                    setFormData((prev) => ({ ...prev, rateListId: rlId }));
                    recalculateAllItems(formData.paymentTerm, formData.schemeId, rlId);
                  }}
                  options={[
                    { label: '-- Auto-Resolve Active Rate List --', value: '' },
                    ...rateLists.map((rl) => ({ label: `${rl.code} - ${rl.name} (${rl.category || 'SEASONAL'})`, value: rl.id })),
                  ]}
                />
              </div>
              <div style={{ gridColumn: 'span 5' }}>
                <Select
                  label="Commercial Pricing Scheme"
                  value={formData.schemeId}
                  onChange={(e) => {
                    const sId = e.target.value;
                    setFormData((prev) => ({ ...prev, schemeId: sId }));
                    recalculateAllItems(formData.paymentTerm, sId, formData.rateListId);
                  }}
                  options={[
                    { label: '-- Auto-Resolve Scheme from Database --', value: '' },
                    ...schemes.map((s) => ({ label: `${s.code} - ${s.name} (${s.paymentTerm})`, value: s.id })),
                  ]}
                />
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <Select
                  label="Payment Term *"
                  value={formData.paymentTerm}
                  onChange={(e) => {
                    const term = e.target.value;
                    setFormData((prev) => ({ ...prev, paymentTerm: term }));
                    recalculateAllItems(term, formData.schemeId, formData.rateListId);
                  }}
                  options={[
                    { label: 'CASH (Immediate)', value: 'CASH' },
                    { label: 'CREDIT (Standard)', value: 'CREDIT' },
                    { label: 'ADVANCE (Pre-Payment)', value: 'ADVANCE' },
                  ]}
                />
              </div>
              <div style={{ gridColumn: 'span 4' }}>
                <Input
                  label="Order Date"
                  type="date"
                  value={formData.orderDate}
                  onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                />
              </div>
              <div style={{ gridColumn: 'span 8' }}>
                <Input
                  label="Special Notes / Delivery Remarks"
                  placeholder="e.g. Requested scheme booking, transport dock instructions"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            {/* System-Resolved Market Hierarchy Panel */}
            {dealerHierarchy && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '16px 20px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #bfdbfe',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ backgroundColor: '#2563eb', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px' }}>
                      SYSTEM-RESOLVED MARKET ATTRIBUTION
                    </span>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{dealerHierarchy.dealer?.name} ({dealerHierarchy.dealer?.code})</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Operating Scope: <strong style={{ color: '#0f172a' }}>{dealerHierarchy.company?.name || 'Holding Company'}</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Tier 1: Region & BM</div>
                    <div style={{ fontWeight: 700, color: '#1e40af', marginTop: '2px' }}>{dealerHierarchy.region?.name || 'West Region'}</div>
                    <div style={{ fontSize: '12px', color: '#334155' }}>
                      BM: <strong>{dealerHierarchy.businessManager ? `${dealerHierarchy.businessManager.firstName} ${dealerHierarchy.businessManager.lastName}` : 'Unassigned'}</strong>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Tier 2: Zone & AM</div>
                    <div style={{ fontWeight: 700, color: '#047857', marginTop: '2px' }}>{dealerHierarchy.zone?.name || 'Faisalabad Zone'}</div>
                    <div style={{ fontSize: '12px', color: '#334155' }}>
                      AM: <strong>{dealerHierarchy.areaManager ? `${dealerHierarchy.areaManager.firstName} ${dealerHierarchy.areaManager.lastName}` : 'Unassigned'}</strong>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Tier 3: Territory & SO</div>
                    <div style={{ fontWeight: 700, color: '#d97706', marginTop: '2px' }}>{dealerHierarchy.territory?.name || 'Faisalabad-01'}</div>
                    <div style={{ fontSize: '12px', color: '#334155' }}>
                      Responsible SO: <strong style={{ color: '#2563eb' }}>{dealerHierarchy.salesOfficer ? `${dealerHierarchy.salesOfficer.firstName} ${dealerHierarchy.salesOfficer.lastName}` : 'ERP Direct'}</strong>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Dealer Financials</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      Balance: PKR {Number(dealerHierarchy.dealer?.currentBalance || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Credit Limit: PKR {Number(dealerHierarchy.dealer?.creditLimit || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
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
                  Product prices, discounts, and bonus quantities resolve authoritatively from the selected Scheme and Rate List.
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={addItemRow}>
                <IconPlus size={16} /> Add Product Line
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflowX: 'auto', background: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr style={{ textAlign: 'left', color: '#475569', fontSize: '12px' }}>
                    <th style={{ padding: '12px 14px', minWidth: '260px', whiteSpace: 'nowrap' }}>Finished Product</th>
                    <th style={{ padding: '12px 10px', minWidth: '160px', whiteSpace: 'nowrap' }}>Line Scheme</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', width: '85px', whiteSpace: 'nowrap' }}>Qty</th>
                    <th style={{ padding: '12px 10px', textAlign: 'right', minWidth: '105px', whiteSpace: 'nowrap' }}>Base Rate</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '125px', whiteSpace: 'nowrap' }}>Discount</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', minWidth: '95px', whiteSpace: 'nowrap' }}>Free Qty</th>
                    <th style={{ padding: '12px 10px', textAlign: 'right', minWidth: '115px', whiteSpace: 'nowrap' }}>Net Price</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', minWidth: '130px', whiteSpace: 'nowrap' }}>Line Total</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', width: '45px', whiteSpace: 'nowrap' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {formItems.map((item, idx) => {
                    const hasDiscount = Number(item.discountAmount || 0) > 0;
                    const hasFree = Number(item.freeQuantity || 0) > 0;

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <select
                            value={item.finishedProductId || ''}
                            onChange={(e) => updateItem(idx, 'finishedProductId', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#0f172a',
                              backgroundColor: '#fff',
                            }}
                          >
                            <option value="">Select Product...</option>
                            {products.map((p) => {
                              const stockStr = p.stockOnHand !== undefined && p.stockOnHand !== null ? ` (Stock: ${p.stockOnHand})` : '';
                              const codeStr = p.productCode ? `${p.productCode} - ` : '';
                              return (
                                <option key={p.id} value={p.id}>
                                  {codeStr}{p.productName}{stockStr}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <select
                            value={item.schemeId || ''}
                            onChange={(e) => updateItem(idx, 'schemeId', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12px',
                              backgroundColor: '#fff',
                            }}
                          >
                            <option value="">Order Default</option>
                            {schemes.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.code} - {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                            style={{
                              width: '70px',
                              padding: '6px 8px',
                              textAlign: 'center',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontWeight: 700,
                              fontSize: '13px',
                            }}
                          />
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#64748b' }}>
                          {item.baseRate ? `PKR ${Number(item.baseRate).toLocaleString()}` : '-'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {hasDiscount ? (
                            <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '11px', display: 'inline-block' }}>
                              -PKR {Number(item.discountAmount).toLocaleString()}{item.discountPercent ? ` (${item.discountPercent}%)` : ''}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          {hasFree ? (
                            <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#f3e8ff', color: '#7e22ce', fontWeight: 700, fontSize: '11px', display: 'inline-block' }}>
                              +{item.freeQuantity} Free
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                            style={{
                              width: '95px',
                              padding: '6px 8px',
                              textAlign: 'right',
                              borderRadius: '6px',
                              border: hasDiscount ? '2px solid #10b981' : '1px solid #cbd5e1',
                              fontWeight: 700,
                              fontSize: '13px',
                              color: hasDiscount ? '#047857' : '#0f172a',
                            }}
                          />
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#047857', fontSize: '14px' }}>
                          PKR {item.totalPrice.toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItemRow(idx)}
                            style={{ padding: '4px' }}
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

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '20px', color: '#047857', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Order Value:</span>
                <span>PKR {totalOrderValue.toLocaleString()}</span>
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
        subtitle={`Dealer: ${selectedOrder.dealer?.name} | Booked by: ${
          selectedOrder.salesOfficer ? `${selectedOrder.salesOfficer.firstName} ${selectedOrder.salesOfficer.lastName}` : 'Direct'
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
                  Booked by {selectedOrder.salesOfficer.firstName} {selectedOrder.salesOfficer.lastName}
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
