'use client';

import React, { useState } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  formattedValue?: string;
}

export interface DonutChartProps {
  data: DonutSegment[];
  title?: string;
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  title,
  size = 200,
  thickness = 24,
  centerLabel,
  centerValue,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', width: '100%' }}>
      {title && (
        <h4
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {title}
        </h4>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-lg)',
          flexWrap: 'wrap',
        }}
      >
        {/* Donut SVG */}
        <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
          >
            {/* Background ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="var(--bg-canvas)"
              strokeWidth={thickness}
            />

            {/* Segments */}
            {data.map((segment, idx) => {
              const percent = segment.value / total;
              const strokeDasharray = `${circumference * percent} ${circumference * (1 - percent)}`;
              const strokeDashoffset = -circumference * accumulatedPercent;
              accumulatedPercent += percent;

              const isHovered = hoveredIdx === idx;

              return (
                <circle
                  key={`segment-${idx}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={segment.color}
                  strokeWidth={isHovered ? thickness + 4 : thickness}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  style={{
                    transition: 'all var(--transition-fast)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
          </svg>

          {/* Center text */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}
            >
              {hoveredIdx !== null && data[hoveredIdx]
                ? data[hoveredIdx]?.value
                : centerValue ?? total}
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-2xs)',
                color: 'var(--text-muted)',
                marginTop: '2px',
                maxWidth: '70px',
              }}
            >
              {hoveredIdx !== null && data[hoveredIdx]
                ? data[hoveredIdx]?.label
                : centerLabel ?? 'Total'}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '160px' }}>
          {data.map((item, idx) => {
            const isHovered = hoveredIdx === idx;
            const percentage = ((item.value / total) * 100).toFixed(1);

            return (
              <div
                key={`legend-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isHovered ? 'var(--bg-hover)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-xs)',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '2px',
                      backgroundColor: item.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      color: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isHovered ? 600 : 400,
                    }}
                  >
                    {item.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {percentage}%
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {item.formattedValue || item.value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
