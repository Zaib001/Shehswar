'use client';

import React, { useEffect } from 'react';
import { IconClose } from '../icons';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
}) => {
  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthMap: Record<string, string> = {
    sm: '440px',
    md: '580px',
    lg: '780px',
    xl: '980px',
    '2xl': '1120px',
    full: 'calc(100vw - 48px)',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 180ms ease forwards',
      }}
    >
      {/* Modern Blurred Glass Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      />

      {/* Third-Party Dialog Popup Card with Spring Entrance Animation */}
      <div
        className="animate-modal-pop"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: maxWidthMap[size],
          maxHeight: 'calc(100vh - 48px)',
          backgroundColor: 'var(--bg-surface, #FFFFFF)',
          border: '1px solid var(--border-default, #E2E8F0)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10000,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle, #F1F5F9)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            backgroundColor: 'var(--bg-surface-raised, #F8FAFC)',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: 'var(--text-primary, #0F172A)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </h2>
            {description && (
              <p
                style={{
                  fontSize: '12.5px',
                  color: 'var(--text-muted, #64748B)',
                  marginTop: '4px',
                  marginBottom: 0,
                  lineHeight: 1.4,
                }}
              >
                {description}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-default, #CBD5E1)',
              color: 'var(--text-muted, #64748B)',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 150ms ease',
              flexShrink: 0,
            }}
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            color: 'var(--text-secondary, #334155)',
            fontSize: '13.5px',
          }}
        >
          {children}
        </div>

        {/* Footer Actions */}
        {footer && (
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--border-subtle, #F1F5F9)',
              backgroundColor: 'var(--bg-surface-raised, #F8FAFC)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
