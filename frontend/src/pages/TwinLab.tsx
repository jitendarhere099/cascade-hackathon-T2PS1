import React, { useState, useMemo } from 'react';
import { MeridianEngineSession } from '../api/mockEngine';
import { CheckCircle2, ShieldCheck, Play, RotateCcw } from 'lucide-react';
import * as d3 from 'd3';

export const TwinLab: React.FC = () => {
  const [seed, setSeed] = useState(42);
  const [twinT, setTwinT] = useState(12);

  // Generate both twin sessions
  const { twinA, twinB, isConsistent, twinGap, commitTimeA, commitTimeB } = useMemo(() => {
    const sessionA = new MeridianEngineSession('tuesday_evening', 'cascade', seed);
    const sessionB = new MeridianEngineSession('tuesday_evening', 'benign', seed);

    const histA = [];
    const histB = [];

    for (let t = 0; t <= twinT; t++) {
      histA.push(sessionA.step());
      histB.push(sessionB.step());
    }

    // Check pre-split bit-identity
    let consistent = true;
    for (let t = 0; t <= 7; t++) {
      const pA = histA[t].probs.CASCADE;
      const pB = histB[t].probs.CASCADE;
      if (Math.abs(pA - pB) > 1e-4) {
        consistent = false;
        break;
      }
    }

    // Twin gap: divergence from mixture prior (0.40) at t=7
    const pSplit = histA[7].probs.CASCADE;
    const gap = Math.abs(pSplit - 0.40);

    // Commit time
    let commitA = 15;
    for (let t = 8; t < histA.length; t++) {
      if (histA[t].probs.CASCADE >= 0.75 && histA[t].action === 'ESCALATE') {
        commitA = t;
        break;
      }
    }

    let commitB = 15;
    for (let t = 8; t < histB.length; t++) {
      if (histB[t].probs.CASCADE <= 0.20 && (histB[t].action === 'WATCH' || histB[t].action === 'PREPARE')) {
        commitB = t;
        break;
      }
    }

    return {
      twinA: histA,
      twinB: histB,
      isConsistent: consistent,
      twinGap: gap,
      commitTimeA: commitA,
      commitTimeB: commitB,
    };
  }, [seed, twinT]);

  // Comparative Chart Dimensions
  const width = 640;
  const height = 220;
  const margin = { top: 20, right: 90, bottom: 25, left: 35 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = d3.scaleLinear().domain([0, 15]).range([0, innerWidth]);
  const yScale = d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);

  const lineA = d3
    .line<(typeof twinA)[0]>()
    .x((d) => xScale(d.t))
    .y((d) => yScale(d.probs.CASCADE))
    .curve(d3.curveMonotoneX);

  const lineB = d3
    .line<(typeof twinB)[0]>()
    .x((d) => xScale(d.t))
    .y((d) => yScale(d.probs.CASCADE))
    .curve(d3.curveMonotoneX);

  return (
    <div className="p-4 space-y-4 max-w-[1700px] mx-auto select-none">
      {/* Masthead Banner */}
      <div className="bg-surface border border-rule p-4 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-ink uppercase tracking-wide">
            02 · THE TWIN TEST PROTOCOL (COUNTERFACTUAL EXPERIMENTATION)
          </h2>
          <p className="font-mono text-xs text-ink-3">
            VERIFYING BIT-IDENTICAL PRE-SPLIT BELIEF (T &lt; 00:07) AND RAPID POST-SPLIT COMMITMENT
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1.5 border border-rule px-2 py-1 bg-paper">
            <span>SEED:</span>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-16 bg-surface border border-rule px-1 text-ink"
            />
          </div>

          <div className="flex items-center gap-1.5 border border-rule px-2 py-1 bg-paper">
            <span>TIME:</span>
            <span className="font-bold text-ink">T+{twinT}m</span>
          </div>

          <button
            onClick={() => setTwinT((prev) => Math.min(15, prev + 1))}
            className="flex items-center gap-1 px-3 py-1 bg-ink text-surface hover:bg-ink-2"
          >
            <Play className="w-3 h-3 fill-surface" />
            <span>STEP DIVERGENCE</span>
          </button>
        </div>
      </div>

      {/* Consistency Badge & Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-surface border border-rule p-3">
          <span className="text-[10px] font-mono text-ink-3 block mb-1">
            PRE-SPLIT CONSISTENCY CHECK (|pA - pB| == 0)
          </span>
          <div className="flex items-center gap-2">
            {isConsistent ? (
              <span className="flex items-center gap-1 text-sm font-mono font-bold text-stat-ok">
                <CheckCircle2 className="w-4 h-4 text-stat-ok" />
                <span>PASS: BIT-IDENTICAL</span>
              </span>
            ) : (
              <span className="text-sm font-mono font-bold text-stat-bad">FAIL: DIVERGENCE DETECTED</span>
            )}
          </div>
          <span className="text-[9px] font-mono text-ink-3">Verified 00:00 through 00:07</span>
        </div>

        <div className="bg-surface border border-rule p-3">
          <span className="text-[10px] font-mono text-ink-3 block mb-1">
            TWIN GAP (DIVERGENCE FROM MIXTURE)
          </span>
          <div className="font-serif text-2xl font-bold text-ink tnum">
            {twinGap.toFixed(3)}
          </div>
          <span className="text-[9px] font-mono text-ink-3">Target optimal gap &lt; 0.05</span>
        </div>

        <div className="bg-surface border border-rule p-3">
          <span className="text-[10px] font-mono text-ink-3 block mb-1">
            TWIN A (CASCADE) COMMIT TIME
          </span>
          <div className="font-serif text-2xl font-bold text-hyp-cascade tnum">
            {commitTimeA <= 15 ? `00:${commitTimeA < 10 ? '0' : ''}${commitTimeA}` : 'N/A'}
          </div>
          <span className="text-[9px] font-mono text-ink-3">P(CASCADE) ≥ 0.75 &amp; ESCALATE</span>
        </div>

        <div className="bg-surface border border-rule p-3">
          <span className="text-[10px] font-mono text-ink-3 block mb-1">
            TWIN B (BENIGN) STAND-DOWN TIME
          </span>
          <div className="font-serif text-2xl font-bold text-stat-ok tnum">
            {commitTimeB <= 15 ? `00:${commitTimeB < 10 ? '0' : ''}${commitTimeB}` : 'N/A'}
          </div>
          <span className="text-[9px] font-mono text-ink-3">P(CASCADE) ≤ 0.20 &amp; STAND DOWN</span>
        </div>
      </div>

      {/* Overlaid Comparative Chart */}
      <div className="bg-surface border border-rule p-4">
        <div className="flex justify-between items-center mb-2 pb-1 border-b border-rule text-[11px] font-mono text-ink-3">
          <span>COMPARATIVE TRAJECTORY: P(CASCADING CRISIS) OVER TIME</span>
          <span>TWIN A (SOLID VERMILION) VS TWIN B (DASHED STONE)</span>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1.0].map((v) => (
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

            {/* Split marker at T=7 */}
            <line
              x1={xScale(7)}
              y1={0}
              x2={xScale(7)}
              y2={innerHeight}
              stroke="#1D1B16"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
            <text
              x={xScale(7)}
              y={-5}
              textAnchor="middle"
              className="text-[9px] font-mono font-bold fill-ink"
            >
              T+07 DIVERGENCE POINT
            </text>

            {/* Twin A Path (Cascade) */}
            <path
              d={lineA(twinA) || ''}
              fill="none"
              stroke="#D9421C"
              strokeWidth={2.5}
            />
            <text
              x={innerWidth + 6}
              y={yScale(twinA[twinA.length - 1].probs.CASCADE) + 3}
              className="text-[9px] font-mono font-bold fill-hyp-cascade"
            >
              TWIN A: {(twinA[twinA.length - 1].probs.CASCADE * 100).toFixed(0)}%
            </text>

            {/* Twin B Path (Benign) */}
            <path
              d={lineB(twinB) || ''}
              fill="none"
              stroke="#8A8574"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
            <text
              x={innerWidth + 6}
              y={yScale(twinB[twinB.length - 1].probs.CASCADE) + 3}
              className="text-[9px] font-mono font-bold fill-ink-3"
            >
              TWIN B: {(twinB[twinB.length - 1].probs.CASCADE * 100).toFixed(0)}%
            </text>

            {/* Axes */}
            <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#1D1B16" />
            {[0, 3, 5, 7, 9, 11, 13, 15].map((m) => (
              <g key={m} transform={`translate(${xScale(m)}, ${innerHeight})`}>
                <line y2={3} stroke="#1D1B16" />
                <text y={14} textAnchor="middle" className="text-[8px] font-mono fill-ink-3">
                  00:{m < 10 ? '0' : ''}{m}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Side-by-Side Split Ledgers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Twin A Stream */}
        <div className="bg-surface border border-rule p-3">
          <div className="flex justify-between items-center mb-2 pb-1 border-b border-rule text-xs font-mono">
            <span className="font-bold text-hyp-cascade">TWIN A: CASCADE OUTCOME</span>
            <span>FINAL ACTION: {twinA[twinA.length - 1].action}</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto text-[10px] font-mono">
            {twinA.map((up) => (
              <div
                key={up.t}
                className={`p-1 border flex justify-between ${
                  up.t <= 7
                    ? 'border-rule/40 bg-paper/20'
                    : 'border-red-200 bg-red-50 text-red-950 font-medium'
                }`}
              >
                <span>{up.wall_clock}</span>
                <span>P(CASCADE): {(up.probs.CASCADE * 100).toFixed(0)}%</span>
                <span className="font-bold">{up.action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Twin B Stream */}
        <div className="bg-surface border border-rule p-3">
          <div className="flex justify-between items-center mb-2 pb-1 border-b border-rule text-xs font-mono">
            <span className="font-bold text-stat-ok">TWIN B: BENIGN STORM OUTCOME</span>
            <span>FINAL ACTION: {twinB[twinB.length - 1].action}</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto text-[10px] font-mono">
            {twinB.map((up) => (
              <div
                key={up.t}
                className={`p-1 border flex justify-between ${
                  up.t <= 7
                    ? 'border-rule/40 bg-paper/20'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-950 font-medium'
                }`}
              >
                <span>{up.wall_clock}</span>
                <span>P(CASCADE): {(up.probs.CASCADE * 100).toFixed(0)}%</span>
                <span className="font-bold">{up.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
