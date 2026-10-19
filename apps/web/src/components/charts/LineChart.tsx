'use client';

import React, { useState } from 'react';

export interface LineDataPoint {
  label: string;
  value: number;
  formattedValue?: string;
}

export interface LineChartProps {
  data: LineDataPoint[];
  title?: string;
  height?: number;
  lineColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  unit?: string;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  height = 240,
  lineColor = 'var(--color-primary)',
  gradientFrom = 'rgba(13, 148, 136, 0.35)',
  gradientTo = 'rgba(13, 148, 136, 0.0)',
  unit = '',
}) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

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

  const svgWidth = 600;
  const svgHeight = height;
  const paddingTop = 20;
  const paddingBottom = 36;
  const paddingLeft = 44;
  const paddingRight = 20;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 10);
  const valRange = maxVal - minVal || 1;

  // Calculate coordinates
  const points = data.map((d, i) => {
    const x = paddingLeft + (i / (data.length - 1 || 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.value - minVal) / valRange) * chartHeight;
    return { x, y, ...d };
  });

  // Build SVG path
  const linePath = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const firstPoint = points[0] || { x: paddingLeft, y: paddingTop + chartHeight };
  const lastPoint = points[points.length - 1] || firstPoint;

  // Build Area path
  const areaPath = `
    ${linePath}
    L ${lastPoint.x} ${paddingTop + chartHeight}
    L ${firstPoint.x} ${paddingTop + chartHeight}
    Z
  `;

  const gradientId = `line-chart-grad-${Math.random().toString(36).substring(2, 7)}`;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
        </div>
      )}

      <div style={{ width: '100%', position: 'relative' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradientFrom} />
              <stop offset="100%" stopColor={gradientTo} />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = paddingTop + chartHeight * (1 - ratio);
            const gridVal = Math.round(minVal + valRange * ratio);
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

          {/* Gradient Area */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {points.map((p, idx) => {
            const isHovered = activeIdx === idx;
            return (
              <g
                key={`point-${idx}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Hit area */}
                <circle cx={p.x} cy={p.y} r="14" fill="transparent" />

                {/* Visible Point */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : 4}
                  fill="var(--bg-surface-raised)"
                  stroke={lineColor}
                  strokeWidth="2.5"
                  style={{ transition: 'all var(--transition-fast)' }}
                />

                {/* X-axis label */}
                <text
                  x={p.x}
                  y={svgHeight - 12}
                  fill={isHovered ? 'var(--color-primary)' : 'var(--text-muted)'}
                  fontSize="11"
                  textAnchor="middle"
                  fontWeight={isHovered ? '600' : '400'}
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {activeIdx !== null && points[activeIdx] && (
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
              {points[activeIdx]?.label}
            </div>
            <div style={{ color: lineColor, marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {points[activeIdx]?.formattedValue || points[activeIdx]?.value} {unit}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
