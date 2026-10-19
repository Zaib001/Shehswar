'use client';

import React from 'react';
import { IconCheck, IconClose } from '../icons';

export interface WorkflowStep {
  id: string;
  label: string;
  actor?: string;
  timestamp?: string;
  status: 'completed' | 'current' | 'pending' | 'rejected';
}

export interface WorkflowTrackerProps {
  steps: WorkflowStep[];
  orientation?: 'horizontal' | 'vertical';
}

export const WorkflowTracker: React.FC<WorkflowTrackerProps> = ({
  steps,
  orientation = 'horizontal',
}) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        alignItems: isHorizontal ? 'flex-start' : 'stretch',
        width: '100%',
        padding: 'var(--space-md) 0',
        gap: isHorizontal ? '0' : 'var(--space-md)',
        overflowX: isHorizontal ? 'auto' : 'visible',
      }}
    >
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;

        const getIndicator = () => {
          switch (step.status) {
            case 'completed':
              return (
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--success-500)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    boxShadow: '0 0 0 4px var(--bg-surface)',
                  }}
                >
                  <IconCheck size={16} />
                </div>
              );
            case 'rejected':
              return (
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--danger-500)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    boxShadow: '0 0 0 4px var(--bg-surface)',
                  }}
                >
                  <IconClose size={16} />
                </div>
              );
            case 'current':
              return (
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: 'var(--font-size-xs)',
                    zIndex: 2,
                    boxShadow: '0 0 0 4px var(--color-primary-glow)',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }}
                >
                  {idx + 1}
                </div>
              );
            default:
              return (
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-canvas)',
                    border: '2px solid var(--border-default)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 500,
                    fontSize: 'var(--font-size-xs)',
                    zIndex: 2,
                    boxShadow: '0 0 0 4px var(--bg-surface)',
                  }}
                >
                  {idx + 1}
                </div>
              );
          }
        };

        return (
          <div
            key={step.id}
            style={{
              display: 'flex',
              flex: isHorizontal ? 1 : 'none',
              flexDirection: isHorizontal ? 'column' : 'row',
              alignItems: isHorizontal ? 'center' : 'flex-start',
              position: 'relative',
              textAlign: isHorizontal ? 'center' : 'left',
              gap: isHorizontal ? '8px' : '16px',
            }}
          >
            {/* Step Circle & Connector */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                width: isHorizontal ? '100%' : '28px',
              }}
            >
              {getIndicator()}

              {/* Connecting Line */}
              {!isLast && isHorizontal && (
                <div
                  style={{
                    position: 'absolute',
                    top: '14px',
                    left: '50%',
                    right: '-50%',
                    height: '2px',
                    backgroundColor:
                      step.status === 'completed'
                        ? 'var(--success-500)'
                        : 'var(--border-default)',
                    zIndex: 1,
                  }}
                />
              )}
            </div>

            {/* Step Label Info */}
            <div style={{ minWidth: isHorizontal ? '120px' : 'auto' }}>
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight:
                    step.status === 'current'
                      ? 'var(--font-weight-semibold)'
                      : 'var(--font-weight-medium)',
                  color:
                    step.status === 'current'
                      ? 'var(--color-primary)'
                      : step.status === 'completed'
                        ? 'var(--text-primary)'
                        : 'var(--text-secondary)',
                }}
              >
                {step.label}
              </div>
              {step.actor && (
                <div
                  style={{
                    fontSize: 'var(--font-size-2xs)',
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                  }}
                >
                  {step.actor}
                </div>
              )}
              {step.timestamp && (
                <div
                  style={{
                    fontSize: 'var(--font-size-2xs)',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {step.timestamp}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
