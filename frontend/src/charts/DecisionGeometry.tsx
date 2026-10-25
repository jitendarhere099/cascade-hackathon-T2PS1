import React, { useMemo } from 'react';
import * as d3 from 'd3';
import type { Action, CostModelConfig } from '../types';
import { Sliders, Info, Eye, ShieldCheck, BellRing, Siren } from 'lucide-react';

interface DecisionGeometryProps {
  currentP: number;
  currentAction: Action;
  costs: CostModelConfig;
  fatigue: number;
  currentDelayMin: number;
  onOpenCostModel?: () => void;
  height?: number;
}

const ACTION_COLORS: Record<Action, string> = {
  WATCH: '#4A463C',
  PREPARE: '#B7791F',
  ALERT: '#D9631C',
  ESCALATE: '#A3121F',
};

const ACTION_ICONS: Record<Action, React.ComponentType<{ className?: string }>> = {
  WATCH: Eye,
  PREPARE: ShieldCheck,
  ALERT: BellRing,
  ESCALATE: Siren,
};

export const DecisionGeometry: React.FC<DecisionGeometryProps> = ({
  currentP,
  currentAction,
  costs,
  fatigue,
  currentDelayMin,
  onOpenCostModel,
  height = 190,
}) => {
  const width = 420;
  const margin = { top: 22, right: 30, bottom: 28, left: 42 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Compute curve points for P in [0..1]
  const { curves, maxCost, currentCosts } = useMemo(() => {
    const D0 = costs.missed_cascade.D0;
    const g = costs.missed_cascade.g;
    const delayGrowth = Math.pow(1 + g, currentDelayMin);
    const missed_base = D0 * delayGrowth;

    const fat_mult = 1 + costs.fatigue.kappa * fatigue;

    const step = 0.05;
    const points: Record<Action, Array<{ p: number; cost: number }>> = {
      WATCH: [],
      PREPARE: [],
      ALERT: [],
      ESCALATE: [],
    };

    let maxC = 80;

    for (let p = 0; p <= 1.001; p += step) {
      const pClamp = Math.min(1, Math.max(0, p));
      const nonCascade = 1 - pClamp;

      // WATCH
      const cWatch = pClamp * missed_base;
      points.WATCH.push({ p: pClamp, cost: cWatch });

      // PREPARE
      const cPrep =
        pClamp * missed_base * (1 - costs.missed_cascade.prepare_reduction) +
        nonCascade * costs.false_alarms.noise_or_sensor.PREPARE * fat_mult;
      points.PREPARE.push({ p: pClamp, cost: cPrep });

      // ALERT
      const cAlert =
        pClamp * missed_base * (1 - costs.missed_cascade.alert_reduction) +
        nonCascade * costs.false_alarms.noise_or_sensor.ALERT * fat_mult;
      points.ALERT.push({ p: pClamp, cost: cAlert });

      // ESCALATE
      const cEsc =
        pClamp * missed_base * (1 - costs.missed_cascade.escalate_reduction) +
        nonCascade * costs.false_alarms.noise_or_sensor.ESCALATE * fat_mult;
      points.ESCALATE.push({ p: pClamp, cost: cEsc });

      maxC = Math.max(maxC, cWatch, cPrep, cAlert, cEsc);
    }

    // Exact cost at current P
    const pCurrent = Math.min(1, Math.max(0, currentP));
    const nonCascade = 1 - pCurrent;
    const curCosts: Record<Action, number> = {
      WATCH: pCurrent * missed_base,
      PREPARE:
        pCurrent * missed_base * (1 - costs.missed_cascade.prepare_reduction) +
        nonCascade * costs.false_alarms.noise_or_sensor.PREPARE * fat_mult,
      ALERT:
        pCurrent * missed_base * (1 - costs.missed_cascade.alert_reduction) +
        nonCascade * costs.false_alarms.noise_or_sensor.ALERT * fat_mult,
      ESCALATE:
        pCurrent * missed_base * (1 - costs.missed_cascade.escalate_reduction) +
        nonCascade * costs.false_alarms.noise_or_sensor.ESCALATE * fat_mult,
    };

    return {
      curves: points,
      maxCost: Math.min(220, maxC * 1.05),
      currentCosts: curCosts,
    };
  }, [costs, fatigue, currentDelayMin, currentP]);

  const xScale = useMemo(() => d3.scaleLinear().domain([0, 1]).range([0, innerWidth]), [innerWidth]);
  const yScale = useMemo(() => d3.scaleLinear().domain([0, maxCost]).range([innerHeight, 0]), [innerHeight, maxCost]);

  const lineGen = d3
    .line<{ p: number; cost: number }>()
    .x((d) => xScale(d.p))
    .y((d) => yScale(d.cost))
    .curve(d3.curveMonotoneX);

  return (
    <div className="w-full bg-surface border border-rule p-3 select-none flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex justify-between items-center mb-1 text-[11px] font-mono tracking-wider text-ink-3 pb-1 border-b border-rule/50">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-ink">02 · DECISION GEOMETRY</span>
            <span
              className="cursor-help text-ink-3 hover:text-ink inline-flex items-center"
              title="Expected loss curves for each response action as a function of P(CASCADE). System chooses the action with the lowest expected loss."
            >
              <Info className="w-3 h-3" />
            </span>
          </div>
          {onOpenCostModel && (
            <button
              onClick={onOpenCostModel}
              className="flex items-center gap-1 text-[10px] uppercase font-mono text-ink-2 hover:text-ink px-1.5 py-0.5 border border-rule hover:bg-paper-2 transition-colors"
              title="Edit cost model parameters (false alarm penalty, missed cascade loss, fatigue rate)"
            >
              <Sliders className="w-3 h-3 text-ink-3" />
              <span>EDIT COSTS</span>
            </button>
          )}
        </div>

        {/* SVG Curve Geometry */}
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Subtle horizontal grid lines & Y-Axis Loss Values */}
            {[0, Math.round(maxCost * 0.5), Math.round(maxCost)].map((v) => (
              <g key={v}>
                <line
                  x1={0}
                  y1={yScale(v)}
                  x2={innerWidth}
                  y2={yScale(v)}
                  stroke="#EAE5D8"
                  strokeDasharray="2 3"
                  strokeWidth={1}
                />
                <text
                  x={-6}
                  y={yScale(v) + 3}
                  textAnchor="end"
                  className="text-[8px] font-mono fill-ink-3"
                >
                  {v}
                </text>
              </g>
            ))}

            {/* Y Axis Label */}
            <text
              x={-innerHeight / 2}
              y={-28}
              transform="rotate(-90)"
              textAnchor="middle"
              className="text-[7.5px] font-mono fill-ink-3 uppercase tracking-wider"
            >
              Expected Loss
            </text>

            {/* Action curves */}
            {(['WATCH', 'PREPARE', 'ALERT', 'ESCALATE'] as Action[]).map((act) => {
              const pathData = lineGen(curves[act]) || '';
              const isRec = currentAction === act;
              return (
                <g key={act}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke={ACTION_COLORS[act]}
                    strokeWidth={isRec ? 2.5 : 1.2}
                    strokeDasharray={act === 'WATCH' ? '3 2' : act === 'ALERT' ? '4 2' : undefined}
                    strokeOpacity={isRec ? 1 : 0.65}
                  />
                </g>
              );
            })}

            {/* Vertical marker for current P(CASCADE) */}
            <line
              x1={xScale(currentP)}
              y1={0}
              x2={xScale(currentP)}
              y2={innerHeight}
              stroke="#1D1B16"
              strokeWidth={1.5}
            />

            {/* Active action cost intercept point */}
            <circle
              cx={xScale(currentP)}
              cy={yScale(currentCosts[currentAction])}
              r={5}
              fill={ACTION_COLORS[currentAction]}
              stroke="#1D1B16"
              strokeWidth={1.5}
            />

            {/* Marker label */}
            <g transform={`translate(${xScale(currentP) + (currentP > 0.65 ? -8 : 8)}, 8)`}>
              <rect
                x={currentP > 0.65 ? -110 : 0}
                y={-8}
                width={110}
                height={16}
                fill="#1D1B16"
              />
              <text
                x={currentP > 0.65 ? -55 : 55}
                y={3}
                textAnchor="middle"
                className="text-[8px] font-mono fill-paper font-bold"
              >
                {`P(CASC) ${(currentP * 100).toFixed(0)}% · L=${currentCosts[currentAction].toFixed(1)}`}
              </text>
            </g>

            {/* X Axis */}
            <line
              x1={0}
              y1={innerHeight}
              x2={innerWidth}
              y2={innerHeight}
              stroke="#1D1B16"
              strokeWidth={1}
            />
            {[0, 0.25, 0.5, 0.75, 1.0].map((pVal) => (
              <g key={pVal} transform={`translate(${xScale(pVal)}, ${innerHeight})`}>
                <line y2={3} stroke="#1D1B16" />
                <text y={14} textAnchor="middle" className="text-[8px] font-mono fill-ink-3">
                  {pVal === 0 ? '0' : pVal === 1 ? '1.0' : pVal.toFixed(2)}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Legend with action swatches and current cost values */}
      <div className="grid grid-cols-4 gap-1 mt-2 text-[9px] font-mono pt-1.5 border-t border-rule/50">
        {(['WATCH', 'PREPARE', 'ALERT', 'ESCALATE'] as Action[]).map((act) => {
          const isRec = currentAction === act;
          const costVal = currentCosts[act];
          const Icon = ACTION_ICONS[act];

          return (
            <div
              key={act}
              className={`px-1.5 py-1 border transition-colors ${
                isRec
                  ? 'border-ink bg-paper font-bold shadow-2xs'
                  : 'border-transparent text-ink-3'
              }`}
              title={`${act} expected loss: ${costVal.toFixed(2)} cost units`}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <span
                  className="w-2 h-0.5 inline-block shrink-0"
                  style={{ backgroundColor: ACTION_COLORS[act] }}
                />
                <Icon className="w-2.5 h-2.5 text-ink-2 shrink-0" />
                <span className={`truncate text-[8px] ${isRec ? 'text-ink font-bold' : 'text-ink-2'}`}>
                  {act}
                </span>
              </div>
              <div className="text-[8px] tnum text-ink-2 pl-3">
                {costVal.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
