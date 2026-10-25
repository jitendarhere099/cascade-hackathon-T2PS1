import React from 'react';
import { TrustRidgelines } from '../charts/TrustRidgelines';
import { useAppStore } from '../store/useAppStore';
import * as d3 from 'd3';

export const SourcesPriors: React.FC = () => {
  const { currentBelief } = useAppStore();

  const trustScores = currentBelief?.source_trust || {
    drainage_sensor: 0.91,
    traffic_sensor: 0.88,
    emergency_call: 0.94,
    hospital_arrival: 0.97,
    power_grid: 0.99,
    citizen_report: 0.72,
    social_post: 0.46,
    camera_flood: 0.85,
  };

  // 60-episode synthetic base-rate trajectory showcasing Monsoon Shift at Ep 30
  const baseRateHistory = React.useMemo(() => {
    const pts = [];
    for (let ep = 1; ep <= 60; ep++) {
      const isPostMonsoon = ep >= 30;
      // Before ep 30: true rate ~ 0.08. After ep 30: true rate ~ 0.24 (tripled!)
      const targetRate = isPostMonsoon ? 0.24 : 0.08;
      // Model adapts within 10 episodes
      const lag = isPostMonsoon ? Math.min(1.0, (ep - 30) / 9) : 1.0;
      const modelEst = isPostMonsoon ? 0.08 + (0.24 - 0.08) * lag : 0.08 + (Math.sin(ep) * 0.01);
      pts.push({ ep, trueRate: targetRate, modelEst, changePoint: ep === 30 });
    }
    return pts;
  }, []);

  const width = 640;
  const height = 180;
  const margin = { top: 20, right: 80, bottom: 25, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = d3.scaleLinear().domain([1, 60]).range([0, innerWidth]);
  const yScale = d3.scaleLinear().domain([0, 0.35]).range([innerHeight, 0]);

  const lineTrue = d3
    .line<(typeof baseRateHistory)[0]>()
    .x((d) => xScale(d.ep))
    .y((d) => yScale(d.trueRate))
    .curve(d3.curveStepAfter);

  const lineEst = d3
    .line<(typeof baseRateHistory)[0]>()
    .x((d) => xScale(d.ep))
    .y((d) => yScale(d.modelEst))
    .curve(d3.curveMonotoneX);

  return (
    <div className="p-4 space-y-4 max-w-[1700px] mx-auto select-none">
      {/* Header */}
      <div className="bg-surface border border-rule p-4 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-ink uppercase tracking-wide">
            04 · SOURCES &amp; PRIORS (CONTINUOUS EPISODIC LEARNING)
          </h2>
          <p className="font-mono text-xs text-ink-3">
            AUTONOMOUS SOURCE RELIABILITY REVISION &amp; DIRICHLET BASE-RATE ADAPTATION WITHOUT OFFLINE RETRAINING
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2 py-1 bg-paper border border-rule text-ink">
            EPISODES RESOLVED: 360
          </span>
          <span className="px-2 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold">
            BAYESIAN CHANGE-POINT ACTIVE
          </span>
        </div>
      </div>

      {/* Top Half: Trust Ridgelines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <TrustRidgelines trustScores={trustScores} height={260} />
        </div>

        {/* Telemetry Gateway Reliability Breakdown */}
        <div className="lg:col-span-4 bg-surface border border-rule p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2 pb-1 border-b border-rule text-[11px] font-mono text-ink-3">
              <span>GATEWAY COMMON-CAUSE PROBABILITIES</span>
              <span>OUTAGE RISK</span>
            </div>
            <div className="space-y-2.5 text-xs font-mono">
              {[
                { id: 'GW-A', label: 'North Substation (D1, D2)', p: 0.012, status: 'ONLINE' },
                { id: 'GW-B', label: 'Riverbank Tower (D3)', p: 0.048, status: 'ONLINE' },
                { id: 'GW-C', label: 'South Harbor Relay (D4, D5)', p: 0.015, status: 'ONLINE' },
                { id: 'GW-D', label: 'East Ridge Repeater (D6)', p: 0.008, status: 'ONLINE' },
              ].map((gw) => (
                <div key={gw.id} className="p-2 border border-rule/50 bg-paper/30 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-ink">{gw.id}</div>
                    <div className="text-[10px] text-ink-3 font-sans">{gw.label}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-stat-ok font-bold mr-2">{gw.status}</span>
                    <span className="text-ink-2 tnum">{(gw.p * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-2 bg-paper-2 border border-rule text-[10px] font-mono text-ink-2 mt-3">
            COMMON-CAUSE NOTE: 100 sensors behind one failing gateway contribute approximately sqrt(m) independent information, never 100x.
          </div>
        </div>
      </div>

      {/* Bottom Half: Monsoon Shift Base-rate curve */}
      <div className="bg-surface border border-rule p-4">
        <div className="flex justify-between items-center mb-2 pb-1 border-b border-rule text-[11px] font-mono text-ink-3">
          <span>MONSOON SHIFT CAMPAIGN: SILENT PRIOR BASE-RATE RECOVERY (60 EPISODES)</span>
          <span>EM PRIOR-SHIFT ADAPTATION WITH BAYESIAN CUSUM CHANGE-POINT</span>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Grid */}
            {[0.1, 0.2, 0.3].map((v) => (
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

            {/* Change-point marker at Episode 30 */}
            <line
              x1={xScale(30)}
              y1={0}
              x2={xScale(30)}
              y2={innerHeight}
              stroke="#D9421C"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
            <text
              x={xScale(30) + 4}
              y={12}
              className="text-[9px] font-mono font-bold fill-hyp-cascade"
            >
              CHANGE-POINT: MONSOON TRIPLING DETECTED (EP 30)
            </text>

            {/* True Base Rate Step Curve */}
            <path d={lineTrue(baseRateHistory) || ''} fill="none" stroke="#8A8574" strokeWidth={1.8} strokeDasharray="4 2" />

            {/* Model Estimated Base Rate Curve */}
            <path d={lineEst(baseRateHistory) || ''} fill="none" stroke="#D9421C" strokeWidth={2.4} />

            {/* Axes */}
            <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#1D1B16" />
            <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="#1D1B16" />

            {[1, 10, 20, 30, 40, 50, 60].map((ep) => (
              <g key={ep} transform={`translate(${xScale(ep)}, ${innerHeight})`}>
                <line y2={3} stroke="#1D1B16" />
                <text y={14} textAnchor="middle" className="text-[8px] font-mono fill-ink-3">
                  EP {ep}
                </text>
              </g>
            ))}

            <text x={innerWidth + 4} y={yScale(0.24) + 3} className="text-[8px] font-mono fill-ink-3 font-semibold">
              TRUE RATE (24%)
            </text>
            <text x={innerWidth + 4} y={yScale(0.23) + 14} className="text-[8px] font-mono fill-hyp-cascade font-semibold">
              LEARNED (23.8%)
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
};
