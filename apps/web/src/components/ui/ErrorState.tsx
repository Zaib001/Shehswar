'use client';

import React, { useState } from 'react';
import { Button } from './Button';
import { IconAlertTriangle, IconRefresh } from '../icons';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  errorDetails?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while processing your request. Please try again or contact system administration.',
  errorDetails,
  onRetry,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-2xl) var(--space-lg)',
        textAlign: 'center',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: 'var(--radius-xl)',
        maxWidth: '520px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          color: 'var(--danger-500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-md)',
        }}
      >
        <IconAlertTriangle size={28} />
      </div>

      <h3
        style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-secondary)',
          maxWidth: '400px',
          margin: '8px 0 var(--space-lg) 0',
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>

      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          startIcon={<IconRefresh size={14} />}
        >
          Retry Operation
        </Button>
      )}

      {errorDetails && (
        <div style={{ marginTop: 'var(--space-md)', width: '100%' }}>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 'var(--font-size-2xs)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {showDetails ? 'Hide technical details' : 'Show technical details'}
          </button>
          {showDetails && (
            <pre
              style={{
                marginTop: '8px',
                padding: '8px',
                backgroundColor: 'var(--bg-canvas)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-2xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--danger-500)',
                textAlign: 'left',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                maxHeight: '120px',
              }}
            >
              {errorDetails}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
