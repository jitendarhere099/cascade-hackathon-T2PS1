import React from 'react';
import type { ForecastItem } from '../types';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Eye,
  GitBranch,
  CloudRain,
  Car,
  Hospital,
  Zap,
  Radio,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

interface ForesightRangeBarsProps {
  currentT: number;
  forecasts: ForecastItem[];
  nextBestObservation: string;
}

// Function to choose contextual icon based on event node name
function getEventIcon(nodeName: string): React.ComponentType<{ className?: string }> {
  const upper = nodeName.toUpperCase();
  if (upper.includes('RAIN') || upper.includes('FLOOD') || upper.includes('DRAIN') || upper.includes('WATER')) {
    return CloudRain;
  }
  if (upper.includes('ROAD') || upper.includes('TRAFFIC') || upper.includes('CONGEST') || upper.includes('TRANSIT')) {
    return Car;
  }
  if (upper.includes('HOSP') || upper.includes('AMBULANCE') || upper.includes('SURGE') || upper.includes('BED') || upper.includes('CASUALTY')) {
    return Hospital;
  }
  if (upper.includes('POWER') || upper.includes('GRID') || upper.includes('SUBSTATION') || upper.includes('BLACKOUT')) {
    return Zap;
  }
  if (upper.includes('COMM') || upper.includes('GATEWAY') || upper.includes('CELL') || upper.includes('TELEMETRY') || upper.includes('TOWER')) {
    return Radio;
  }
  return AlertCircle;
}

export const ForesightRangeBars: React.FC<ForesightRangeBarsProps> = ({
  currentT,
  forecasts,
  nextBestObservation,
}) => {
  const minTime = currentT;
  const maxTime = currentT + 10;
  const timeSpan = maxTime - minTime;

  const getPositionPercent = (t: number) => {
    return Math.max(0, Math.min(100, ((t - minTime) / timeSpan) * 100));
  };

  return (
    <div className="w-full bg-surface border border-rule p-3 select-none flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-2 text-[11px] font-mono tracking-wider text-ink-3 pb-1 border-b border-rule/50">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-hyp-isolated" />
            <span className="font-bold text-ink">03 · CAUSAL FORESIGHT</span>
            <span className="text-[10px] text-ink-3 hidden sm:inline">(PREDICTED EVENTS)</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <Clock className="w-3 h-3 text-ink-3" />
            <span className="px-1.5 py-0.2 bg-paper-2 border border-rule text-ink-2">
              WINDOW: T+{currentT} — T+{maxTime}
            </span>
          </div>
        </div>

        {/* Global Time Axis Bar */}
        <div className="relative w-full h-5 border-b border-rule mb-3 flex items-center bg-paper/40">
          {[0, 2, 4, 6, 8, 10].map((dt) => {
            const pct = (dt / 10) * 100;
            return (
              <div
                key={dt}
                className="absolute text-[8px] font-mono text-ink-3 transform -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                <div className="w-[1px] h-1.5 bg-rule mb-0.5 mx-auto" />
                <span>+{dt}m</span>
              </div>
            );
          })}
        </div>

        {/* Forecast Rows */}
        <div className="space-y-2.5">
          {forecasts.map((item, idx) => {
            const leftPct = getPositionPercent(item.window_start);
            const rightPct = getPositionPercent(item.window_end);
            const barWidth = Math.max(8, rightPct - leftPct);
            const EventIcon = getEventIcon(item.node);
            const pathParts = item.causal_path ? item.causal_path.split('->').map((p) => p.trim()) : [item.node];

            return (
              <div
                key={idx}
                className="border border-rule/70 p-2.5 bg-paper/40 hover:bg-paper/70 transition-colors"
              >
                {/* Primary Heading with Event Icon & Prominent Probability */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center justify-center w-6 h-6 bg-paper-2 border border-rule rounded-xs shrink-0">
                      <EventIcon className="w-3.5 h-3.5 text-hyp-isolated" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-serif font-bold text-ink text-sm tracking-wide leading-tight break-words">
                        {item.node}
                      </div>
                      {/* Clock Window Label */}
                      <div className="flex items-center gap-1 text-[9px] font-mono text-ink-3 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        <span>Expected: T+{item.window_start}m → T+{item.window_end}m</span>
                      </div>
                    </div>
                  </div>

                  {/* Probability & Status Indicator */}
                  <div className="flex flex-col items-end shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-ink">
                        {(item.prob * 100).toFixed(0)}%
                      </span>
                      {item.status && item.status !== 'PENDING' && (
                        <span
                          className={`font-mono text-[8px] px-1.5 py-0.2 font-bold uppercase border ${
                            item.status === 'HIT'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                              : 'bg-amber-100 text-amber-900 border-amber-400'
                          }`}
                        >
                          {item.status}
                        </span>
                      )}
                    </div>
                    {/* Small visual probability bar */}
                    <div className="w-16 h-1.5 bg-paper-2 border border-rule/60 mt-1 overflow-hidden">
                      <div
                        className="h-full bg-hyp-isolated transition-all"
                        style={{ width: `${Math.round(item.prob * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Range Bar Graphic */}
                <div className="relative w-full h-3.5 bg-paper-2 border border-rule/60 my-1.5 overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 bg-hyp-isolated/25 border-l-2 border-r-2 border-hyp-isolated"
                    style={{
                      left: `${leftPct}%`,
                      width: `${barWidth}%`,
                    }}
                  >
                    <div className="text-[7.5px] font-mono text-ink font-semibold px-1 leading-3.5 truncate">
                      T+{item.window_start}–{item.window_end}m
                    </div>
                  </div>
                </div>

                {/* Causal Path Sequence of readable nodes connected by arrows (clean wrapping) */}
                <div className="my-1.5 pt-1.5 border-t border-rule/40">
                  <div className="text-[8px] font-mono uppercase tracking-wider text-ink-3 mb-1 flex items-center gap-1">
                    <GitBranch className="w-2.5 h-2.5" />
                    <span>CAUSAL GRAPH PATHWAY:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {pathParts.map((part, pIdx) => (
                      <React.Fragment key={pIdx}>
                        <span
                          className={`px-1.5 py-0.5 text-[8.5px] font-mono border ${
                            pIdx === pathParts.length - 1
                              ? 'bg-hyp-isolated/15 text-hyp-isolated border-hyp-isolated font-bold'
                              : 'bg-paper-2 text-ink-2 border-rule'
                          }`}
                        >
                          {part}
                        </span>
                        {pIdx < pathParts.length - 1 && (
                          <span className="text-ink-3 text-[9px] font-mono">→</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Plain-Language Rationale / Explanation */}
                <div className="text-[9.5px] text-ink-2 font-sans italic leading-relaxed bg-paper/60 p-1.5 border border-rule/30 mt-1">
                  "{item.rationale}"
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Watch For Banner (Max Info Gain) */}
      <div className="mt-3 p-2.5 bg-paper-2 border border-rule text-[10px]">
        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-ink font-bold mb-1">
          <Eye className="w-3.5 h-3.5 text-hyp-isolated" />
          <span>WATCH FOR (MAX VALUE OF INFORMATION):</span>
        </div>
        <div className="text-ink font-medium font-sans pl-5 leading-snug">
          {nextBestObservation}
        </div>
      </div>
    </div>
  );
};
