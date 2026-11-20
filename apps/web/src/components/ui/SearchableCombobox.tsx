'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IconSearch, IconChevronDown, IconClose, IconCheck, IconPlus } from '../icons';

export interface ComboboxOption {
  value: string;
  label: string | any;
  subtext?: string | any;
  badge?: string | any;
  searchTerms?: string;
  disabled?: boolean;
}

function safeFormatValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    return val.name || val.label || val.title || val.code || '';
  }
  return String(val);
}

export interface SearchableComboboxProps {
  id?: string;
  name?: string;
  label?: string;
  required?: boolean;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string, option?: ComboboxOption) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  autoFocus?: boolean;
  tabIndex?: number;
  nextFieldId?: string;
  nextFocusId?: string;
  onSelectNext?: () => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  compact?: boolean;
  usePortal?: boolean;
  openOnHover?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  id,
  name,
  label,
  required = false,
  options = [],
  value,
  onChange,
  placeholder = 'Type to search...',
  disabled = false,
  error,
  helperText,
  autoFocus = false,
  tabIndex,
  nextFieldId,
  nextFocusId,
  onSelectNext,
  onAddNew,
  addNewLabel,
  compact = false,
  usePortal = true,
  openOnHover = true,
  className = '',
  style,
}) => {
  const effectiveNextId = nextFocusId || nextFieldId;
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const isKeyboardNav = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [menuCoords, setMenuCoords] = useState<{
    top: number;
    left: number;
    width: number;
    placement: 'bottom' | 'top';
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Find currently selected option
  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)),
    [options, value]
  );

  // Sync input text with selected value when closed or value changes externally
  useEffect(() => {
    if (!isOpen) {
      if (!value) {
        setQuery('');
      } else {
        setQuery(selectedOption ? safeFormatValue(selectedOption.label) : '');
      }
    }
  }, [value, selectedOption, isOpen]);

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuEstimatedHeight = 280;
    const openUpwards = spaceBelow < menuEstimatedHeight && rect.top > menuEstimatedHeight;

    let left = rect.left;
    const minWidth = Math.max(rect.width, 240);
    if (left + minWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - 12 - minWidth);
    }

    setMenuCoords({
      top: openUpwards ? rect.top - 4 : rect.bottom + 4,
      left,
      width: minWidth,
      placement: openUpwards ? 'top' : 'bottom',
    });
  }, []);

  useEffect(() => {
    if (!isOpen || !usePortal) return;
    updatePosition();

    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, usePortal, updatePosition]);

  // Filter options based on typed query
  const filteredOptions = useMemo(() => {
    const selectedLabel = selectedOption ? safeFormatValue(selectedOption.label) : '';
    if (!query || (selectedOption && query === selectedLabel)) {
      return options;
    }
    const q = query.toLowerCase().trim();
    return options.filter((opt) => {
      const labelMatch = safeFormatValue(opt.label).toLowerCase().includes(q);
      const subtextMatch = safeFormatValue(opt.subtext).toLowerCase().includes(q);
      const valMatch = safeFormatValue(opt.value).toLowerCase().includes(q);
      const badgeMatch = safeFormatValue(opt.badge).toLowerCase().includes(q);
      const searchTermsMatch = safeFormatValue(opt.searchTerms).toLowerCase().includes(q);
      return labelMatch || subtextMatch || valMatch || badgeMatch || searchTermsMatch;
    });
  }, [options, query, selectedOption]);

  // Total items including inline Add button (if provided)
  const totalItems = filteredOptions.length + (onAddNew ? 1 : 0);

  // Reset highlighted index when filtered options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Outside click handler
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setIsFocused(false);
        setQuery(selectedOption ? safeFormatValue(selectedOption.label) : '');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, selectedOption]);

  const advanceFocus = useCallback(() => {
    if (effectiveNextId) {
      setTimeout(() => {
        const nextEl = document.getElementById(effectiveNextId) as HTMLElement | null;
        if (nextEl) {
          nextEl.focus();
          if (nextEl instanceof HTMLInputElement) {
            nextEl.select();
          }
        }
      }, 30);
    }
    if (onSelectNext) {
      onSelectNext();
    }
  }, [effectiveNextId, onSelectNext]);

  const selectOption = useCallback(
    (opt: ComboboxOption) => {
      onChange(opt.value, opt);
      setQuery(opt.label);
      setIsOpen(false);
      advanceFocus();
    },
    [onChange, advanceFocus]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      isKeyboardNav.current = true;
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => (prev + 1 < totalItems ? prev + 1 : 0));
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      isKeyboardNav.current = true;
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(totalItems > 0 ? totalItems - 1 : 0);
      } else {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
      }
      return;
    }

    if (e.key === 'Enter') {
      // Prevent form submit
      e.preventDefault();
      if (isOpen) {
        if (highlightedIndex < filteredOptions.length) {
          const targetOpt = filteredOptions[highlightedIndex];
          if (targetOpt && !targetOpt.disabled) {
            selectOption(targetOpt);
          }
        } else if (onAddNew && highlightedIndex === filteredOptions.length) {
          setIsOpen(false);
          onAddNew();
        }
      } else {
        // If closed, open dropdown on enter, or if already valid, advance focus
        if (value) {
          advanceFocus();
        } else {
          setIsOpen(true);
        }
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setQuery(selectedOption ? selectedOption.label : '');
      return;
    }

    if (e.key === 'Tab') {
      if (isOpen) {
        if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
          const opt = filteredOptions[highlightedIndex];
          onChange(opt.value, opt);
          setQuery(safeFormatValue(opt.label));
          setIsOpen(false);
        } else {
          setIsOpen(false);
          setQuery(selectedOption ? safeFormatValue(selectedOption.label) : '');
        }
      }
      // Let tab event propagate to move naturally to next element
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    setIsOpen(true);
    updatePosition();
    // Auto-select text on focus so user can type to immediately replace search query
    inputRef.current?.select();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', undefined);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const dropdownList = (
    <div
      ref={dropdownRef}
      onMouseDown={(e) => {
        // Prevent input blur before click event fires
        e.preventDefault();
      }}
      onMouseMove={() => { isKeyboardNav.current = false; }}
      style={
        usePortal && menuCoords
          ? {
              position: 'fixed',
              top: menuCoords.placement === 'top' ? undefined : `${menuCoords.top}px`,
              bottom: menuCoords.placement === 'top' ? `${window.innerHeight - menuCoords.top}px` : undefined,
              left: `${menuCoords.left}px`,
              width: `${menuCoords.width}px`,
              minWidth: '240px',
              maxWidth: 'min(620px, 95vw)',
              zIndex: 9999999,
              backgroundColor: 'var(--bg-surface, #FFFFFF)',
              border: '1.5px solid var(--border-default, #CBD5E1)',
              borderRadius: '8px',
              boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.22), 0 4px 10px -2px rgba(15, 23, 42, 0.1)',
              maxHeight: '280px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }
          : {
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              minWidth: 'max(100%, 360px)',
              width: 'max-content',
              maxWidth: 'min(600px, 94vw)',
              zIndex: 9999,
              backgroundColor: 'var(--bg-surface, #FFFFFF)',
              border: '1px solid var(--border-default, #E2E8F0)',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
              maxHeight: '280px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }
      }
    >
      <ul
        ref={listRef}
        role="listbox"
        style={{
          margin: 0,
          padding: '4px 0',
          listStyle: 'none',
          width: '100%',
        }}
      >
        {filteredOptions.length === 0 ? (
          <li
            style={{
              padding: '12px 14px',
              fontSize: '12.5px',
              color: 'var(--text-muted, #94A3B8)',
              textAlign: 'center',
              fontStyle: 'italic',
            }}
          >
            No matching options found for "{query}"
          </li>
        ) : (
          filteredOptions.map((opt, idx) => {
            const isSelected = String(opt.value) === String(value);
            const isHighlighted = idx === highlightedIndex;

            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  if (!opt.disabled) {
                    selectOption(opt);
                  }
                }}
                onMouseEnter={() => {
                  if (!isKeyboardNav.current) {
                    setHighlightedIndex(idx);
                  }
                }}
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  backgroundColor: isHighlighted
                    ? 'rgba(37, 99, 235, 0.08)'
                    : isSelected
                      ? 'rgba(37, 99, 235, 0.04)'
                      : 'transparent',
                  color: opt.disabled
                    ? 'var(--text-muted, #94A3B8)'
                    : isSelected
                      ? '#1D4ED8'
                      : 'var(--text-primary, #0F172A)',
                  fontSize: '13px',
                  fontWeight: isSelected ? 600 : 500,
                  transition: 'background-color 100ms ease',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        lineHeight: 1.35,
                      }}
                    >
                      {safeFormatValue(opt.label)}
                    </span>
                    {isSelected && <IconCheck size={14} style={{ color: '#2563EB', flexShrink: 0 }} />}
                  </div>
                  {Boolean(opt.subtext) && Boolean(safeFormatValue(opt.subtext)) && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted, #64748B)',
                        whiteSpace: 'pre-line',
                        wordBreak: 'break-word',
                        lineHeight: 1.35,
                      }}
                    >
                      {safeFormatValue(opt.subtext)}
                    </span>
                  )}
                </div>

                {Boolean(opt.badge) && Boolean(safeFormatValue(opt.badge)) && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(37, 99, 235, 0.08)',
                      color: '#2563EB',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {safeFormatValue(opt.badge)}
                  </span>
                )}
              </li>
            );
          })
        )}

        {/* Inline Add New Master Data Option */}
        {onAddNew && (
          <li
            role="option"
            onClick={() => {
              setIsOpen(false);
              onAddNew();
            }}
            onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
            style={{
              borderTop: '1px solid var(--border-subtle, #E2E8F0)',
              padding: '9px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              backgroundColor:
                highlightedIndex === filteredOptions.length
                  ? 'rgba(16, 185, 129, 0.12)'
                  : 'rgba(240, 253, 244, 0.7)',
              color: '#059669',
              fontSize: '12.5px',
              fontWeight: 600,
              transition: 'background-color 100ms ease',
            }}
          >
            <IconPlus size={14} />
            <span>{addNewLabel ? addNewLabel.replace(/^[+\s]+/, '') : 'Add New'}</span>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`searchable-combobox-container ${className}`}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        width: '100%',
        ...style,
      }}
    >
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary, #475569)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {label}
          {required && <span style={{ color: '#EF4444' }}>*</span>}
        </label>
      )}

      {/* Input / Control Trigger */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: compact ? '8px' : '10px',
            color: isFocused ? '#2563EB' : 'var(--text-muted, #94A3B8)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <IconSearch size={compact ? 13 : 15} />
        </span>

        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          autoComplete="off"
          autoFocus={autoFocus}
          tabIndex={tabIndex}
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onMouseEnter={() => {
            if (openOnHover && !disabled && !isOpen) {
              setIsOpen(true);
              updatePosition();
            }
          }}
          onClick={() => {
            if (!disabled && !isOpen) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            height: compact ? '34px' : '38px',
            paddingLeft: compact ? '28px' : '34px',
            paddingRight: value ? (compact ? '46px' : '54px') : (compact ? '26px' : '32px'),
            fontSize: compact ? '12.5px' : '13px',
            fontWeight: 500,
            color: 'var(--text-primary, #0F172A)',
            backgroundColor: disabled ? 'var(--bg-canvas, #F1F5F9)' : 'var(--bg-surface, #FFFFFF)',
            border: `1.5px solid ${
              error
                ? '#EF4444'
                : isFocused
                  ? '#2563EB'
                  : 'var(--border-default, #CBD5E1)'
            }`,
            borderRadius: compact ? '6px' : '7px',
            outline: 'none',
            boxShadow: isFocused ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />

        {/* Right action buttons: Clear + Chevron */}
        <div
          style={{
            position: 'absolute',
            right: compact ? '6px' : '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {Boolean(value) && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              tabIndex={-1}
              title="Clear selection"
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--text-muted, #94A3B8)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
              }}
            >
              <IconClose size={compact ? 12 : 13} />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              if (!disabled) {
                if (isOpen) {
                  setIsOpen(false);
                } else {
                  inputRef.current?.focus();
                  setIsOpen(true);
                }
              }
            }}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--text-muted, #94A3B8)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms ease',
            }}
          >
            <IconChevronDown size={compact ? 13 : 14} />
          </button>
        </div>
      </div>

      {/* Dropdown Results List */}
      {mounted && isOpen && (
        usePortal && menuCoords && typeof document !== 'undefined'
          ? createPortal(dropdownList, document.body)
          : dropdownList
      )}

      {/* Error / Helper text */}
      {error ? (
        <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 500 }}>{error}</span>
      ) : helperText ? (
        <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748B)' }}>{helperText}</span>
      ) : null}
    </div>
  );
};
