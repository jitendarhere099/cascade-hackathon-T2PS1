import React from 'react';
import * as d3 from 'd3';

interface ReliabilityDiagramProps {
  ece?: number;
  brier?: number;
  height?: number;
}

export const ReliabilityDiagram: React.FC<ReliabilityDiagramProps> = ({
  ece = 0.041,
  brier = 0.052,
  height = 200,
}) => {
  const width = 360;
  const margin = { top: 20, right: 25, bottom: 25, left: 35 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // 10 calibration bins: [predicted, observed, sample_count]
  const bins = [
    { p: 0.05, obs: 0.04, count: 820 },
    { p: 0.15, obs: 0.14, count: 540 },
    { p: 0.25, obs: 0.26, count: 410 },
    { p: 0.35, obs: 0.33, count: 320 },
    { p: 0.45, obs: 0.44, count: 280 },
    { p: 0.55, obs: 0.57, count: 260 },
    { p: 0.65, obs: 0.63, count: 290 },
    { p: 0.75, obs: 0.76, count: 350 },
    { p: 0.85, obs: 0.86, count: 420 },
    { p: 0.95, obs: 0.94, count: 710 },
  ];

  const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);
  const yScale = d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);

  return (
    <div className="w-full bg-surface border border-rule p-3 select-none">
      <div className="flex justify-between items-center mb-1 text-[11px] font-mono tracking-wider text-ink-3">
        <span>05 · CALIBRATION RELIABILITY DIAGRAM (HELD-OUT EVAL)</span>
        <span className="text-hyp-isolated font-bold">
          ECE = {(ece * 100).toFixed(1)}% | BRIER = {brier.toFixed(3)}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* 45-degree ideal calibration line */}
          <line
            x1={0}
            y1={innerHeight}
            x2={innerWidth}
            y2={0}
            stroke="#D5CEBD"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((v) => (
            <line
              key={v}
              x1={0}
              y1={yScale(v)}
              x2={innerWidth}
              y2={yScale(v)}
              stroke="#EAE5D8"
              strokeDasharray="2 3"
            />
          ))}

          {/* Calibration Bars */}
          {bins.map((b, i) => {
            const barW = (innerWidth / 10) * 0.7;
            const x = xScale(b.p) - barW / 2;
            const barH = innerHeight - yScale(b.obs);
            const isAccurate = Math.abs(b.p - b.obs) <= 0.03;

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={yScale(b.obs)}
                  width={barW}
                  height={barH}
                  fill={isAccurate ? '#1F6F8B' : '#B7791F'}
                  fillOpacity={0.7}
                  stroke="#1D1B16"
                  strokeWidth={0.75}
                />
                <circle
                  cx={xScale(b.p)}
                  cy={yScale(b.obs)}
                  r={3}
                  fill="#D9421C"
                  stroke="#1D1B16"
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {/* Axes */}
          <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#1D1B16" />
          <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="#1D1B16" />

          {/* Labels */}
          <text
            x={innerWidth / 2}
            y={innerHeight + 20}
            textAnchor="middle"
            className="text-[8px] font-mono fill-ink-3"
          >
            PREDICTED PROBABILITY
          </text>
          <text
            x={-innerHeight / 2}
            y={-22}
            textAnchor="middle"
            transform="rotate(-90)"
            className="text-[8px] font-mono fill-ink-3"
          >
            EMPIRICAL FREQUENCY
          </text>
        </g>
      </svg>
    </div>
  );
};
