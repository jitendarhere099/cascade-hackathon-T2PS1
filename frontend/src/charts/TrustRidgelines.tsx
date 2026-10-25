import React from 'react';
import * as d3 from 'd3';

interface TrustRidgelinesProps {
  trustScores: Record<string, number>;
  height?: number;
}

export const TrustRidgelines: React.FC<TrustRidgelinesProps> = ({
  trustScores,
  height = 240,
}) => {
  const width = 500;
  const margin = { top: 20, right: 30, bottom: 25, left: 110 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const channels = Object.keys(trustScores);
  const rowHeight = innerHeight / Math.max(1, channels.length);

  return (
    <div className="w-full bg-surface border border-rule p-3 select-none">
      <div className="flex justify-between items-center mb-1 text-[11px] font-mono tracking-wider text-ink-3">
        <span>04 · SOURCE TRUST POSTERIORS (BETA DISTRIBUTIONS ACROSS EPISODES)</span>
        <span>DISCOUNT FACTOR γ = 0.98</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* 0.0 to 1.0 trust axis line */}
          <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#1D1B16" />
          {[0, 0.25, 0.5, 0.75, 1.0].map((v) => (
            <g key={v} transform={`translate(${v * innerWidth}, ${innerHeight})`}>
              <line y2={3} stroke="#1D1B16" />
              <text y={14} textAnchor="middle" className="text-[8px] font-mono fill-ink-3">
                {v.toFixed(2)}
              </text>
            </g>
          ))}

          {channels.map((chan, idx) => {
            const meanTrust = trustScores[chan] || 0.5;
            const yCenter = idx * rowHeight + rowHeight / 2;

            // Generate bell curve for Beta around meanTrust
            const pts: Array<[number, number]> = [];
            const std = Math.max(0.04, (1 - meanTrust) * 0.15);

            for (let x = 0; x <= 1.001; x += 0.02) {
              const diff = (x - meanTrust) / std;
              const density = Math.exp(-0.5 * diff * diff);
              pts.push([x * innerWidth, yCenter - density * (rowHeight * 0.45)]);
            }

            const areaGen = d3
              .area<[number, number]>()
              .x((d) => d[0])
              .y0(yCenter)
              .y1((d) => d[1])
              .curve(d3.curveBasis);

            return (
              <g key={chan}>
                {/* Channel Label */}
                <text
                  x={-8}
                  y={yCenter + 3}
                  textAnchor="end"
                  className="text-[9px] font-mono fill-ink font-medium truncate"
                >
                  {chan.replace('_', ' ')}
                </text>

                {/* Base baseline */}
                <line
                  x1={0}
                  y1={yCenter}
                  x2={innerWidth}
                  y2={yCenter}
                  stroke="#EAE5D8"
                  strokeWidth={1}
                />

                {/* Density shape */}
                <path
                  d={areaGen(pts) || ''}
                  fill={meanTrust > 0.8 ? '#3F7D58' : meanTrust > 0.6 ? '#B7791F' : '#A3121F'}
                  fillOpacity={0.45}
                  stroke="#1D1B16"
                  strokeWidth={1}
                />

                {/* Mean pointer */}
                <circle
                  cx={meanTrust * innerWidth}
                  cy={yCenter}
                  r={3.5}
                  fill="#1D1B16"
                />

                {/* Numeric label */}
                <text
                  x={meanTrust * innerWidth + 6}
                  y={yCenter - 3}
                  className="text-[8px] font-mono font-bold fill-ink"
                >
                  {(meanTrust * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
