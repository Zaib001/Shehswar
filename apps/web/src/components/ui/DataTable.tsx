'use client';

import React, { useState, useMemo } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Checkbox } from './Checkbox';
import { TableSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import {
  IconSearch,
  IconFilter,
  IconDownload,
} from '../icons';

export interface ColumnDef<T> {
  key?: string;
  id?: string;
  header?: string;
  label?: string;
  accessorKey?: keyof T | string;
  cell?: (props: any, index?: number) => React.ReactNode;
  render?: (row: T, index?: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  priority?: 'high' | 'medium' | 'low';
}

export function getColKey<T>(col: ColumnDef<T>, idx: number = 0): string {
  return String(col.key || col.id || col.accessorKey || `col-${idx}`);
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor?: (item: T) => string;
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchField?: (item: T) => string;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  bulkActions?: React.ReactNode;
  actionButtons?: React.ReactNode;
  onExport?: () => void;
  pageSize?: number;
  pagination?: {
    pageSize?: number;
  };
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onRowClick?: (item: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor = (item: any) => item.id || item.code || item.name || JSON.stringify(item),
  title,
  subtitle,
  isLoading = false,
  error,
  onRetry,
  searchable = true,
  searchPlaceholder = 'Search records...',
  searchField,
  selectable = true,
  selectedIds = [],
  onSelectionChange,
  bulkActions,
  actionButtons,
  onExport,
  pageSize: propPageSize = 10,
  pagination,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no records matching your current filter criteria.',
  emptyActionLabel,
  onEmptyAction,
  onRowClick,
}: DataTableProps<T>) {
  const pageSize = pagination?.pageSize ?? propPageSize;
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns.map((c, idx) => getColKey(c, idx)));
  const [showColMenu, setShowColMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Filter Data
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();

    return data.filter((item) => {
      if (searchField) {
        return searchField(item).toLowerCase().includes(term);
      }
      return Object.values(item).some(
        (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(term),
      );
    });
  }, [data, searchTerm, searchField]);

  // Sort Data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [filteredData, sortKey, sortDirection]);

  // Pagination Slice
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Active Visible Columns
  const activeColumns = useMemo(() => {
    return columns.filter((c, idx) => visibleColumns.includes(getColKey(c, idx)));
  }, [columns, visibleColumns]);

  // Sorting Handler
  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Selection Handlers
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      const allIds = paginatedData.map(keyExtractor);
      const union = Array.from(new Set([...selectedIds, ...allIds]));
      onSelectionChange(union);
    } else {
      const pageIds = paginatedData.map(keyExtractor);
      onSelectionChange(selectedIds.filter((id) => !pageIds.includes(id)));
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    }
  };

  const isAllSelected =
    paginatedData.length > 0 &&
    paginatedData.every((item) => selectedIds.includes(keyExtractor(item)));

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface, #FFFFFF)',
        border: '1px solid var(--border-default, #E2E8F0)',
        borderRadius: '14px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}
    >
      {/* Modern SaaS Toolbar & Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle, #F1F5F9)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: 'var(--bg-surface, #FFFFFF)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Title & Subtitle */}
          {(title || subtitle) && (
            <div>
              {title && (
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--text-primary, #0F172A)',
                    margin: 0,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p
                  style={{
                    fontSize: '12.5px',
                    color: 'var(--text-muted, #64748B)',
                    margin: '3px 0 0 0',
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
            {onExport && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onExport}
                startIcon={<IconDownload size={14} />}
              >
                Export
              </Button>
            )}

            {/* Column Visibility Menu */}
            <div style={{ position: 'relative' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowColMenu(!showColMenu)}
                startIcon={<IconFilter size={14} />}
              >
                Columns
              </Button>

              {showColMenu && (
                <div
                  className="animate-modal-pop"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    backgroundColor: 'var(--bg-surface, #FFFFFF)',
                    border: '1px solid var(--border-default, #E2E8F0)',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                    padding: '8px',
                    zIndex: 200,
                    minWidth: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-muted, #64748B)',
                      padding: '4px 8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Toggle Columns
                  </span>
                  {columns.map((c, idx) => {
                    const cKey = getColKey(c, idx);
                    return (
                      <label
                        key={cKey}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '12.5px',
                          color: 'var(--text-primary, #0F172A)',
                          padding: '6px 8px',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          transition: 'background 120ms ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns.includes(cKey)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setVisibleColumns([...visibleColumns, cKey]);
                            } else {
                              if (visibleColumns.length > 1) {
                                setVisibleColumns(visibleColumns.filter((k) => k !== cKey));
                              }
                            }
                          }}
                        />
                        <span>{c.header || c.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* View Switcher Toggle */}
            <div
              style={{
                display: 'inline-flex',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-canvas, #F1F5F9)',
                padding: '2px',
                border: '1px solid var(--border-default, #E2E8F0)',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  border: 'none',
                  background: viewMode === 'table' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'table' ? '#2563EB' : '#64748B',
                  boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                style={{
                  border: 'none',
                  background: viewMode === 'cards' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'cards' ? '#2563EB' : '#64748B',
                  boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                Cards
              </button>
            </div>

            {actionButtons}
          </div>
        </div>

        {/* Search & Bulk Actions Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {searchable && (
            <div style={{ maxWidth: '340px', width: '100%' }}>
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                isClearable
                onClear={() => setSearchTerm('')}
                startIcon={<IconSearch size={15} />}
              />
            </div>
          )}

          {/* Bulk Selection Notification Bar */}
          {selectedIds.length > 0 && (
            <div
              className="animate-modal-pop"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                color: '#1D4ED8',
              }}
            >
              <span style={{ fontWeight: 700 }}>
                {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected
              </span>
              {bulkActions}
              {onSelectionChange && (
                <button
                  type="button"
                  onClick={() => onSelectionChange([])}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textDecoration: 'underline',
                    padding: 0,
                    fontWeight: 500,
                  }}
                >
                  Deselect all
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div style={{ padding: '24px' }}>
          <TableSkeleton rows={pageSize > 5 ? 5 : pageSize} columns={activeColumns.length} />
        </div>
      ) : error ? (
        <div style={{ padding: '32px' }}>
          <ErrorState message={error} onRetry={onRetry} />
        </div>
      ) : sortedData.length === 0 ? (
        <div style={{ padding: '32px' }}>
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            actionLabel={emptyActionLabel}
            onAction={onEmptyAction}
          />
        </div>
      ) : viewMode === 'table' ? (
        /* Full Desktop / Tablet Responsive Table */
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13.5px',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--bg-surface-raised, #F8FAFC)',
                  borderBottom: '1px solid var(--border-default, #E2E8F0)',
                }}
              >
                {selectable && (
                  <th
                    style={{
                      width: '42px',
                      padding: '12px 16px',
                    }}
                  >
                    <Checkbox
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      aria-label="Select all rows"
                    />
                  </th>
                )}
                {activeColumns.map((col, idx) => {
                  const colKey = getColKey(col, idx);
                  const isSorted = sortKey === colKey;
                  return (
                    <th
                      key={colKey}
                      onClick={() => col.sortable !== false && handleSort(colKey)}
                      style={{
                        padding: '12px 16px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: isSorted ? '#2563EB' : 'var(--text-secondary, #475569)',
                        cursor: col.sortable !== false ? 'pointer' : 'default',
                        userSelect: 'none',
                        width: col.width,
                        textAlign: col.align || 'left',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.02em',
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          justifyContent:
                            col.align === 'right'
                              ? 'flex-end'
                              : col.align === 'center'
                                ? 'center'
                                : 'flex-start',
                          width: '100%',
                        }}
                      >
                        <span>{col.header || col.label}</span>
                        {col.sortable !== false && (
                          <span
                            style={{
                              fontSize: '10px',
                              opacity: isSorted ? 1 : 0.3,
                              transform:
                                isSorted && sortDirection === 'desc'
                                  ? 'rotate(180deg)'
                                  : 'none',
                              transition: 'transform 150ms ease',
                            }}
                          >
                            ▲
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item, rowIdx) => {
                const id = keyExtractor(item);
                const isSelected = selectedIds.includes(id);

                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick?.(item)}
                    className="modern-table-row"
                    style={{
                      backgroundColor: isSelected
                        ? 'rgba(37, 99, 235, 0.06)'
                        : rowIdx % 2 === 1
                          ? 'var(--bg-canvas, #FAFAFA)'
                          : 'transparent',
                      borderBottom: '1px solid var(--border-subtle, #F1F5F9)',
                      cursor: onRowClick ? 'pointer' : 'default',
                      height: '46px',
                    }}
                  >
                    {selectable && (
                      <td
                        style={{ padding: '12px 16px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(id, e.target.checked)}
                          aria-label={`Select row ${id}`}
                        />
                      </td>
                    )}
                    {activeColumns.map((col, cIdx) => (
                      <td
                        key={getColKey(col, cIdx)}
                        style={{
                          padding: '10px 16px',
                          color: 'var(--text-primary, #0F172A)',
                          textAlign: col.align || 'left',
                          fontSize: '13px',
                          maxWidth: col.width || '280px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          verticalAlign: 'middle',
                        }}
                      >
                        {(() => {
                          if (col.render) {
                            return (col.render as any)(item, rowIdx);
                          }
                          if (col.cell) {
                            const cellArg = { row: { original: item }, original: item, ...item };
                            try {
                              const res = (col.cell as any)(cellArg, rowIdx);
                              if (res !== undefined) return res;
                            } catch {}
                            return (col.cell as any)(item, rowIdx);
                          }
                          const key = col.accessorKey || col.key || col.id;
                          return key ? item[key] : null;
                        })()}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card-based Mobile / Touch View */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gridAutoRows: '1fr',
            gap: '14px',
            padding: '16px',
          }}
        >
          {paginatedData.map((item, idx) => {
            const id = keyExtractor(item);
            const isSelected = selectedIds.includes(id);

            return (
              <div
                key={id}
                onClick={() => onRowClick?.(item)}
                className="modern-hover-card"
                style={{
                  backgroundColor: isSelected
                    ? 'rgba(37, 99, 235, 0.06)'
                    : 'var(--bg-surface, #FFFFFF)',
                  border: `1px solid ${
                    isSelected ? '#2563EB' : 'var(--border-default, #E2E8F0)'
                  }`,
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: onRowClick ? 'pointer' : 'default',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
              >
                {selectable && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '4px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={(e) => handleSelectRow(id, e.target.checked)}
                      label={`Record #${idx + 1}`}
                    />
                  </div>
                )}
                {activeColumns.map((col, cIdx) => (
                  <div
                    key={getColKey(col, cIdx)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 0',
                      borderBottom: '1px solid var(--border-subtle, #F1F5F9)',
                      fontSize: '12.5px',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted, #64748B)' }}>{col.header || col.label}:</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: 'var(--text-primary, #0F172A)',
                      }}
                    >
                      {(() => {
                        if (col.render) {
                          return (col.render as any)(item, idx);
                        }
                        if (col.cell) {
                          const cellArg = { row: { original: item }, original: item, ...item };
                          try {
                            const res = (col.cell as any)(cellArg, idx);
                            if (res !== undefined) return res;
                          } catch {}
                          return (col.cell as any)(item, idx);
                        }
                        const key = col.accessorKey || col.key || col.id;
                        return key ? item[key] : null;
                      })()}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {!isLoading && !error && sortedData.length > 0 && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle, #F1F5F9)',
            backgroundColor: 'var(--bg-surface-raised, #F8FAFC)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '12.5px',
            color: 'var(--text-muted, #64748B)',
          }}
        >
          <div>
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong>{Math.min(currentPage * pageSize, sortedData.length)}</strong> of{' '}
            <strong>{sortedData.length}</strong> records
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>

            {/* Visual Page Pills */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '6px',
                      border: isActive ? '1px solid #2563EB' : '1px solid var(--border-default, #CBD5E1)',
                      background: isActive ? '#2563EB' : '#FFFFFF',
                      color: isActive ? '#FFFFFF' : 'var(--text-primary, #0F172A)',
                      fontSize: '12px',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 120ms ease',
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && (
                <span style={{ padding: '0 4px', color: '#94A3B8' }}>...</span>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
