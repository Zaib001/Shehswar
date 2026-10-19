'use client';

import React from 'react';
import { PageHeader } from '../layout/PageHeader';
import { Button } from '../ui/Button';
import { IconCheck } from '../icons';

export interface FormFieldItem {
  label: string;
  required?: boolean;
  field: React.ReactNode;
  hint?: string;
}

export interface FormSection {
  id?: string;
  title: string;
  description?: string;
  content?: React.ReactNode;
  fields?: FormFieldItem[];
}

export interface FormPageTemplateProps {
  title: string;
  subtitle?: string;
  breadcrumbs: { label: string; href?: string; onClick?: () => void }[];
  sections?: FormSection[];
  children?: React.ReactNode;
  isSubmitting?: boolean;
  isSaving?: boolean;
  onSaveDraft?: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  onSave?: (e?: any) => void;
  onCancel?: () => void;
  submitLabel?: string;
  draftLabel?: string;
}

export const FormPageTemplate: React.FC<FormPageTemplateProps> = ({
  title,
  subtitle,
  breadcrumbs,
  sections,
  children,
  isSubmitting = false,
  isSaving = false,
  onSaveDraft,
  onSubmit,
  onSave,
  onCancel,
  submitLabel = 'Save Record',
  draftLabel = 'Save as Draft',
}) => {
  const activeSubmitting = isSubmitting || isSaving;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    } else if (onSave) {
      onSave(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        maxWidth: '1180px',
        margin: '0 auto',
        paddingBottom: '32px',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Visual Page Header */}
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
      />

      {/* Modern Form Sections */}
      {sections && sections.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {sections.map((section, idx) => (
            <div
              key={section.id || `section-${idx}`}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                overflow: 'visible',
                position: 'relative',
                zIndex: (sections.length - idx) * 10,
              }}
            >
              {/* Clean Section Header with Step Counter */}
              <div
                style={{
                  padding: '16px 22px',
                  borderBottom: '1px solid #F1F5F9',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '15px 15px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '13px',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                    flexShrink: 0,
                  }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    {section.title}
                  </h3>
                  {section.description && (
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                      {section.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Section Body */}
              <div style={{ padding: '22px' }}>
                {section.content}
                {section.fields && section.fields.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '18px',
                    }}
                  >
                    {section.fields.map((f, fIdx) => (
                      <div key={fIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 700,
                            color: '#334155',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {f.label}
                          {f.required && (
                            <span style={{ color: '#EF4444', fontWeight: 800 }}>*</span>
                          )}
                        </label>
                        {f.field}
                        {f.hint && (
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>{f.hint}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Children Content (Custom sub-components) */}
      {children}

      {/* Sticky Action Dock (Always perfectly aligned with the form and fully visible on screen) */}
      <div
        style={{
          position: 'sticky',
          bottom: '16px',
          width: '100%',
          backgroundColor: '#FFFFFF',
          border: '1.5px solid #E2E8F0',
          borderRadius: '16px',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.05)',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          zIndex: 40,
          marginTop: '16px',
          boxSizing: 'border-box',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              boxShadow: '0 0 6px #10B981',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
            Fields marked with <strong style={{ color: '#EF4444' }}>*</strong> are mandatory before saving.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onCancel}
              disabled={activeSubmitting}
            >
              Cancel
            </Button>
          )}

          {onSaveDraft && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onSaveDraft}
              disabled={activeSubmitting}
            >
              {draftLabel}
            </Button>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={activeSubmitting}
            icon={<IconCheck size={16} />}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
};
