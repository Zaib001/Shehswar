'use client';

/**
 * SHEHSWAR ONE360 - Phase 1 Architecture Overview Page
 */
import React, { useEffect, useState } from 'react';
import { AppShell } from '../components/layout/app-shell';

interface HealthStatus {
  status: string;
  timestamp: string;
  checks?: {
    database: string;
    memoryUsageMb: number;
  };
}

export default function HomePage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetch('http://localhost:4000/health/ready')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch(() =>
        setHealth({
          status: 'STANDBY (API Offline or Initializing)',
          timestamp: new Date().toISOString(),
        }),
      );
  }, []);

  const architecturePillars = [
    {
      title: 'PostgreSQL Relational Core',
      desc: 'Precision DECIMAL(18, 4) for monetary & quantity values. Zero floating-point drift. Multi-company hierarchy scoping.',
      icon: '🗄️',
      tag: 'Data Layer',
    },
    {
      title: 'Contextual RBAC & Isolation',
      desc: 'Centralized can(user, action, resource, context). Strict isolation of parent costing, margins, and formulas from child entities.',
      icon: '🛡️',
      tag: 'Security',
    },
    {
      title: 'Transactional Outbox & Events',
      desc: 'ACID transactional guarantees for state transitions, domain event outbox for at-least-once asynchronous worker delivery.',
      icon: '🔄',
      tag: 'Reliability',
    },
    {
      title: 'Immutable Audit Trail',
      desc: 'Comprehensive capture of actor, tenant, resource, diff, and correlation ID for all financial and operational mutations.',
      icon: '📜',
      tag: 'Compliance',
    },
    {
      title: 'Unified REST & Envelope API',
      desc: 'Strict versioned API (/api/v1), standard ApiResponse<T>, pagination, and correlation tracking. Ready for Mobile & Dealer Portal.',
      icon: '⚡',
      tag: 'Integration',
    },
    {
      title: 'Object Storage Abstraction',
      desc: 'S3-compatible driver pattern with expiring signed URLs for receipts, documents, and QC lab reports. No database bloat.',
      icon: '☁️',
      tag: 'Storage',
    },
  ];

  return (
    <AppShell>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Banner */}
        <div
          className="glass-panel"
          style={{
            padding: '32px',
            marginBottom: '32px',
            background:
              'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
          }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <div>
              <span className="badge badge-success" style={{ marginBottom: '12px' }}>
                Technical Architecture Foundation
              </span>
              <h2
                style={{
                  fontSize: '1.8rem',
                  fontWeight: 800,
                  marginTop: '8px',
                  marginBottom: '8px',
                }}
              >
                SHEHSWAR ONE360 Enterprise Architecture
              </h2>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  maxWidth: '720px',
                  lineHeight: 1.6,
                  fontSize: '0.95rem',
                }}
              >
                Phase 1 establishes the complete modular monolith, security boundaries, database
                precision, concurrency controls, audit logging, and multi-company contracts required
                to prevent future architectural rewrites.
              </p>
            </div>
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                minWidth: '220px',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                SYSTEM HEALTH
              </div>
              <div
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: health?.status === 'UP' ? '#10b981' : '#f59e0b',
                }}
              >
                {health?.status ?? 'Probing...'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Database: {health?.checks?.database ?? 'PostgreSQL Ready'}
              </div>
            </div>
          </div>
        </div>

        {/* 6 Architectural Pillars Grid */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>
            Core Architectural Foundations
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '20px',
            }}
          >
            {architecturePillars.map((p, idx) => (
              <div
                key={idx}
                className="glass-panel"
                style={{
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                    }}
                  >
                    <span style={{ fontSize: '1.6rem' }}>{p.icon}</span>
                    <span className="badge badge-info">{p.tag}</span>
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px' }}>
                    {p.title}
                  </h4>
                  <p
                    style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}
                  >
                    {p.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operational Chain Flow Guardrail */}
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>
            Shehswar Group End-to-End Operational Lifecycle
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Guaranteed by Phase 1 data ownership and transaction boundaries across all future
            business modules:
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'center',
              fontSize: '0.8rem',
            }}
          >
            {[
              '1. Supplier',
              '→',
              '2. Parent Purchase',
              '→',
              '3. RM QC',
              '→',
              '4. Silo Inventory',
              '→',
              '5. Production Order',
              '→',
              '6. Finished QC',
              '→',
              '7. Packing',
              '→',
              '8. Actual Costing',
              '→',
              '9. Parent Markup',
              '→',
              '10. Intercompany PO/SO',
              '→',
              '11. Child Inventory',
              '→',
              '12. Dealer Sale',
              '→',
              '13. Collections',
              '→',
              '14. Group Financials',
            ].map((step, sIdx) => (
              <span
                key={sIdx}
                style={{
                  padding: step === '→' ? '0 4px' : '6px 12px',
                  backgroundColor: step === '→' ? 'transparent' : 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  color: step === '→' ? 'var(--text-muted)' : 'var(--color-primary)',
                  fontWeight: step === '→' ? 400 : 600,
                }}
              >
                {step}
              </span>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
