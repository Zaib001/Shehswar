'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { IconSearch, IconChevronDown, IconClose, IconCheck, IconPlus } from '../icons';

export interface ComboboxOption {
  value: string;
  label: string;
  subtext?: string;
  badge?: string;
  searchTerms?: string;
  disabled?: boolean;
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
  className = '',
  style,
}) => {
  const effectiveNextId = nextFocusId || nextFieldId;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Find currently selected option
  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)),
    [options, value]
  );

  // Sync input text with selected value when closed or value changes externally
  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedOption ? selectedOption.label : '');
    }
  }, [value, selectedOption, isOpen]);

  // Filter options based on typed query
  const filteredOptions = useMemo(() => {
    if (!query || (selectedOption && query === selectedOption.label && !isOpen)) {
      return options;
    }
    const q = query.toLowerCase().trim();
    return options.filter((opt) => {
      const labelMatch = (opt.label || '').toLowerCase().includes(q);
      const subtextMatch = (opt.subtext || '').toLowerCase().includes(q);
      const valMatch = (opt.value || '').toLowerCase().includes(q);
      const badgeMatch = (opt.badge || '').toLowerCase().includes(q);
      const searchTermsMatch = (opt.searchTerms || '').toLowerCase().includes(q);
      return labelMatch || subtextMatch || valMatch || badgeMatch || searchTermsMatch;
    });
  }, [options, query, selectedOption, isOpen]);

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
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
        setQuery(selectedOption ? selectedOption.label : '');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [selectedOption]);

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
      // If menu is open and an item is selected or highlighted, close gracefully
      if (isOpen) {
        setIsOpen(false);
        setQuery(selectedOption ? selectedOption.label : '');
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
            left: '10px',
            color: isFocused ? '#2563EB' : 'var(--text-muted, #94A3B8)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <IconSearch size={15} />
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
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            height: '38px',
            paddingLeft: '34px',
            paddingRight: value ? '54px' : '32px',
            fontSize: '13px',
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
            borderRadius: '7px',
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
            right: '8px',
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
              <IconClose size={13} />
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
            <IconChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Dropdown Results List */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '100%',
            width: 'max-content',
            maxWidth: 'min(480px, 92vw)',
            zIndex: 9999,
            backgroundColor: 'var(--bg-surface, #FFFFFF)',
            border: '1px solid var(--border-default, #E2E8F0)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
            maxHeight: '260px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
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
                    onMouseEnter={() => setHighlightedIndex(idx)}
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
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {opt.label}
                        </span>
                        {isSelected && <IconCheck size={14} style={{ color: '#2563EB', flexShrink: 0 }} />}
                      </div>
                      {opt.subtext && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted, #64748B)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {opt.subtext}
                        </span>
                      )}
                    </div>

                    {opt.badge && (
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
                        {opt.badge}
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
                <span>{addNewLabel ? addNewLabel.replace(/^\+\s*/, '') : 'Add New'}</span>
              </li>
            )}
          </ul>
        </div>
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
