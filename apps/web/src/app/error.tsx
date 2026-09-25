'use client';

import React from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        padding: '48px',
        textAlign: 'center',
        maxWidth: '600px',
        margin: '60px auto',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
      }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⚠️</div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>
        Application Error
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
        {error.message || 'An unexpected error occurred in the application.'}
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: '10px 20px',
          backgroundColor: 'var(--color-primary)',
          color: '#fff',
          borderRadius: 'var(--radius-md)',
          fontWeight: 600,
        }}
      >
        Try Again
      </button>
    </div>
  );
}
