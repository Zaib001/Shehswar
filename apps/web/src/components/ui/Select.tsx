'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronDown, IconCheck, IconClose, IconSearch } from '../icons';

export interface SelectOption {
  label: string;
  value: string;
  subtext?: string;
  badge?: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  options: SelectOption[];
  value?: string | string[];
  onChange?: (valOrEvent: any) => void;
  placeholder?: string;
  isMulti?: boolean;
  isSearchable?: boolean;
  isClearable?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  required?: boolean;
  name?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  isMulti = false,
  isSearchable = true,
  isClearable = false,
  disabled = false,
  error,
  helperText,
  required,
  name,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isTriggerHovered, setIsTriggerHovered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{
    top: number;
    left: number;
    width: number;
    placement: 'bottom' | 'top';
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuEstimatedHeight = 290;
    
    // If not enough space below and enough space above, flip to open upwards
    const openUpwards = spaceBelow < menuEstimatedHeight && rect.top > menuEstimatedHeight;

    setMenuCoords({
      top: openUpwards ? rect.top - 6 : rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 220),
      placement: openUpwards ? 'top' : 'bottom',
    });
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setSearch('');
    }
  };

  // Update floating position on open, scroll, or resize
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && isSearchable) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, isSearchable]);

  const selectedValues = Array.isArray(value) ? value : value !== undefined && value !== null && value !== '' ? [String(value)] : [];

  const filteredOptions = (options || []).filter((opt) => {
    if (!opt) return false;
    const searchStr = (search || '').trim().toLowerCase();
    if (!searchStr) return true;
    const labelStr = String(opt.label ?? '').toLowerCase();
    const valStr = String(opt.value ?? '').toLowerCase();
    const subtextStr = String(opt.subtext ?? '').toLowerCase();
    return (
      labelStr.includes(searchStr) ||
      valStr.includes(searchStr) ||
      (Boolean(opt.subtext) && subtextStr.includes(searchStr))
    );
  });

  const emitChange = (val: string | string[]) => {
    if (!onChange) return;
    const eventLike = {
      target: { value: val, name },
      currentTarget: { value: val, name },
      value: val,
      toString: () => (typeof val === 'string' ? val : val.join(', ')),
    };
    onChange(eventLike);
  };

  const handleSelect = (val: string) => {
    if (isMulti) {
      const next = selectedValues.includes(val)
        ? selectedValues.filter((v) => v !== val)
        : [...selectedValues, val];
      emitChange(next);
    } else {
      emitChange(val);
      setIsOpen(false);
      setSearch('');
    }
  };

  const handleClearSingle = (e: React.MouseEvent) => {
    e.stopPropagation();
    emitChange(isMulti ? [] : '');
  };

  const handleRemoveBadge = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    emitChange(selectedValues.filter((v) => v !== val));
  };

  const selectedOptionObj = !isMulti && selectedValues.length > 0
    ? options.find((o) => String(o.value) === String(selectedValues[0]))
    : null;

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        position: 'relative',
        width: '100%',
      }}
    >
      {label && (
        <label
          style={{
            fontSize: '12.5px',
            fontWeight: 700,
            color: error ? '#EF4444' : '#334155',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {label}
          {required && <span style={{ color: '#EF4444', fontWeight: 800 }}>*</span>}
        </label>
      )}

      {/* Select Trigger Box */}
      <div
        ref={triggerRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleToggle}
        onMouseEnter={() => setIsTriggerHovered(true)}
        onMouseLeave={() => setIsTriggerHovered(false)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleToggle();
          } else if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        style={{
          minHeight: '42px',
          padding: '4px 12px',
          backgroundColor: disabled ? '#F1F5F9' : isOpen ? '#FFFFFF' : '#F8FAFC',
          border: `1.5px solid ${
            error
              ? '#EF4444'
              : isOpen
                ? '#2563EB'
                : isTriggerHovered
                  ? '#CBD5E1'
                  : '#E2E8F0'
          }`,
          borderRadius: '10px',
          boxShadow: isOpen
            ? '0 0 0 3px rgba(37, 99, 235, 0.14)'
            : '0 1px 2px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.65 : 1,
          gap: '8px',
          transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', flex: 1, alignItems: 'center', minWidth: 0 }}>
          {selectedValues.length === 0 ? (
            <span style={{ color: '#94A3B8', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {placeholder}
            </span>
          ) : isMulti ? (
            selectedValues.map((v) => {
              const opt = options.find((o) => String(o.value) === String(v));
              return (
                <span
                  key={v}
                  style={{
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: '1px solid #BFDBFE',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    maxWidth: '100%',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt?.label || v}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveBadge(e, v)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'inherit',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Remove item"
                  >
                    <IconClose size={12} />
                  </button>
                </span>
              );
            })
          ) : (
            <span
              style={{
                fontSize: '13px',
                color: '#0F172A',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={selectedOptionObj?.label || selectedValues[0]}
            >
              {selectedOptionObj?.label || selectedValues[0]}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Optional Clear Button */}
          {isClearable && selectedValues.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClearSingle}
              style={{
                border: 'none',
                background: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
                transition: 'color 120ms ease',
              }}
              title="Clear selection"
            >
              <IconClose size={14} />
            </button>
          )}

          <span
            style={{
              color: isOpen ? '#2563EB' : '#64748B',
              display: 'flex',
              alignItems: 'center',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <IconChevronDown size={16} />
          </span>
        </div>
      </div>

      {/* PORTAL-RENDERED DROPDOWN MENU */}
      {/* Mounted directly to document.body: completely immune to any parent overflow, hover, or stacking context */}
      {mounted && isOpen && menuCoords && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="animate-modal-pop"
          style={{
            position: 'fixed',
            top: menuCoords.placement === 'top' ? undefined : `${menuCoords.top}px`,
            bottom: menuCoords.placement === 'top' ? `${window.innerHeight - menuCoords.top}px` : undefined,
            left: `${menuCoords.left}px`,
            width: `${menuCoords.width}px`,
            backgroundColor: '#FFFFFF',
            border: '1.5px solid #E2E8F0',
            borderRadius: '12px',
            boxShadow: '0 16px 38px -4px rgba(15, 23, 42, 0.22), 0 6px 14px -2px rgba(15, 23, 42, 0.1)',
            zIndex: 9999999, // Unmatched top-level stacking: Nothing in the document can ever be on top of this!
            overflow: 'hidden',
            maxHeight: '290px',
            display: 'flex',
            flexDirection: 'column',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Modern Search Bar */}
          {isSearchable && (
            <div
              style={{
                padding: '8px 10px',
                borderBottom: '1px solid #F1F5F9',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid #CBD5E1',
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <span style={{ color: '#64748B', display: 'flex', alignItems: 'center' }}>
                  <IconSearch size={14} />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search options..."
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    fontSize: '12.5px',
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    color: '#0F172A',
                    fontFamily: 'inherit',
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearch('');
                      searchInputRef.current?.focus();
                    }}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options Scrollable List */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  fontSize: '12.5px',
                  color: '#64748B',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <IconSearch size={18} style={{ opacity: 0.4 }} />
                <span>No matching options found</span>
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(String(opt.value));
                return (
                  <div
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => !opt.disabled && handleSelect(String(opt.value))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: opt.disabled ? 'not-allowed' : 'pointer',
                      opacity: opt.disabled ? 0.45 : 1,
                      backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      color: isSelected ? '#2563EB' : '#1E293B',
                      fontWeight: isSelected ? 700 : 500,
                      transition: 'all 120ms ease',
                      position: 'relative',
                      userSelect: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !opt.disabled) {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                        e.currentTarget.style.transform = 'translateX(2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !opt.disabled) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.transform = 'none';
                      }
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {opt.label}
                      </div>
                      {opt.subtext && (
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px', fontWeight: 400 }}>
                          {opt.subtext}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {opt.badge && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#F1F5F9',
                            color: '#475569',
                          }}
                        >
                          {opt.badge}
                        </span>
                      )}

                      {isSelected && (
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#2563EB',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconCheck size={13} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}

      {(error || helperText) && (
        <span
          style={{
            fontSize: '11px',
            color: error ? '#EF4444' : '#64748B',
            lineHeight: 1.3,
          }}
        >
          {error || helperText}
        </span>
      )}
    </div>
  );
};
