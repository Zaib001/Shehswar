'use client';

import React, { useState } from 'react';

export interface BarDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  formattedValue?: string;
}

export interface BarChartProps {
  data: BarDataPoint[];
  title?: string;
  height?: number;
  barColor?: string;
  secondaryColor?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  unit?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  height = 240,
  barColor = 'var(--color-primary)',
  secondaryColor = 'var(--accent-500)',
  primaryLabel = 'Primary',
  secondaryLabel = 'Secondary',
  unit = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height: `${height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: 'var(--font-size-xs)',
        }}
      >
        No chart data available
      </div>
    );
  }

  const hasSecondary = data.some((d) => d.secondaryValue !== undefined);
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.value, d.secondaryValue ?? 0)),
    1,
  );

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = height;
  const paddingBottom = 36;
  const paddingTop = 20;
  const paddingLeft = 44;
  const paddingRight = 16;

  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const chartWidth = svgWidth - paddingLeft - paddingRight;

  const groupWidth = chartWidth / data.length;
  const barWidth = hasSecondary ? groupWidth * 0.35 : groupWidth * 0.55;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      {/* Title & Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-2xs)' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                backgroundColor: barColor,
              }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>{primaryLabel}</span>
          </div>
          {hasSecondary && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-2xs)' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: secondaryColor,
                }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>{secondaryLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ width: '100%', position: 'relative' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        >
          {/* Horizontal Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = paddingTop + chartHeight * (1 - ratio);
            const gridVal = Math.round(maxValue * ratio);
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="var(--border-subtle)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  fill="var(--text-muted)"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                >
                  {gridVal}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((item, idx) => {
            const isHovered = hoveredIdx === idx;
            const primaryBarHeight = (item.value / maxValue) * chartHeight;
            const groupX = paddingLeft + idx * groupWidth;

            const primaryX = hasSecondary
              ? groupX + groupWidth * 0.12
              : groupX + (groupWidth - barWidth) / 2;

            const primaryY = paddingTop + chartHeight - primaryBarHeight;

            let secondaryX = 0;
            let secondaryY = 0;
            let secBarHeight = 0;

            if (hasSecondary && item.secondaryValue !== undefined) {
              secBarHeight = (item.secondaryValue / maxValue) * chartHeight;
              secondaryX = primaryX + barWidth + 4;
              secondaryY = paddingTop + chartHeight - secBarHeight;
            }

            return (
              <g
                key={`bar-group-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Hover Background Column */}
                <rect
                  x={groupX + 2}
                  y={paddingTop}
                  width={groupWidth - 4}
                  height={chartHeight}
                  fill={isHovered ? 'var(--bg-hover)' : 'transparent'}
                  rx="4"
                  style={{ transition: 'fill var(--transition-fast)' }}
                />

                {/* Primary Bar */}
                <rect
                  x={primaryX}
                  y={primaryY}
                  width={barWidth}
                  height={primaryBarHeight}
                  fill={barColor}
                  rx="3"
                  opacity={hoveredIdx !== null && !isHovered ? 0.6 : 1}
                  style={{ transition: 'all var(--transition-fast)' }}
                />

                {/* Secondary Bar */}
                {hasSecondary && (
                  <rect
                    x={secondaryX}
                    y={secondaryY}
                    width={barWidth}
                    height={secBarHeight}
                    fill={secondaryColor}
                    rx="3"
                    opacity={hoveredIdx !== null && !isHovered ? 0.6 : 1}
                    style={{ transition: 'all var(--transition-fast)' }}
                  />
                )}

                {/* X Axis Label */}
                <text
                  x={groupX + groupWidth / 2}
                  y={svgHeight - 12}
                  fill={isHovered ? 'var(--color-primary)' : 'var(--text-muted)'}
                  fontSize="11"
                  textAnchor="middle"
                  fontWeight={isHovered ? '600' : '400'}
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div
            className="animate-scale-in"
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-md)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 10px',
              fontSize: 'var(--font-size-xs)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {data[hoveredIdx]?.label}
            </div>
            <div style={{ color: barColor, marginTop: '2px' }}>
              {primaryLabel}: {data[hoveredIdx]?.formattedValue || data[hoveredIdx]?.value} {unit}
            </div>
            {hasSecondary && data[hoveredIdx]?.secondaryValue !== undefined && (
              <div style={{ color: secondaryColor, marginTop: '2px' }}>
                {secondaryLabel}: {data[hoveredIdx]?.secondaryValue} {unit}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
