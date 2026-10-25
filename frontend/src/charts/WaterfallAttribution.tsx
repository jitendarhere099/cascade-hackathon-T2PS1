import React from 'react';
import type { AttributionItem } from '../types';
import { Info, GitFork, ArrowLeftRight } from 'lucide-react';

interface WaterfallAttributionProps {
  items: AttributionItem[];
}

export const WaterfallAttribution: React.FC<WaterfallAttributionProps> = ({ items }) => {
  const maxAbs = Math.max(
    1.5,
    ...items.map((it) => Math.abs(it.delta_logodds))
  );

  return (
    <div className="w-full bg-surface border border-rule p-3 select-none flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-2 text-[11px] font-mono tracking-wider text-ink-3 pb-1 border-b border-rule/50">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-ink">05A · EVIDENCE ATTRIBUTION</span>
            <span
              className="cursor-help text-ink-3 hover:text-ink inline-flex items-center"
              title="Leave-One-Cluster-Out delta log-odds influence: Positive values pull system belief toward Cascade; negative values pull toward Benign."
            >
              <Info className="w-3 h-3" />
            </span>
          </div>
          <span className="text-[9px] font-mono text-ink-2 bg-paper-2 border border-rule px-1.5 py-0.2">
            BENIGN ← 0.0 → CASCADE
          </span>
        </div>

        <div className="space-y-2.5 text-[10px]">
          {items.map((item, idx) => {
            const val = item.delta_logodds;
            const isPositive = val >= 0;
            const barWidthPct = (Math.abs(val) / maxAbs) * 45; // 45% max on each side

            return (
              <div key={idx} className="border-b border-rule/30 pb-2 last:border-b-0">
                <div className="flex justify-between items-baseline mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-ink-3" />
                    <span className="font-mono font-bold text-ink">{item.cluster}</span>
                  </div>
                  <span
                    className={`font-mono font-bold text-xs ${
                      isPositive ? 'text-hyp-cascade' : 'text-hyp-isolated'
                    }`}
                  >
                    {isPositive ? `+${val.toFixed(2)}` : val.toFixed(2)} Δ
                  </span>
                </div>

                {/* Centered divergence bar */}
                <div className="relative w-full h-3 bg-paper-2 border border-rule/40 overflow-hidden">
                  {/* Center zero line */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-ink z-10" />

                  {isPositive ? (
                    <div
                      className="absolute top-0 bottom-0 bg-hyp-cascade"
                      style={{
                        left: '50%',
                        width: `${barWidthPct}%`,
                      }}
                    />
                  ) : (
                    <div
                      className="absolute top-0 bottom-0 bg-hyp-isolated"
                      style={{
                        right: '50%',
                        width: `${barWidthPct}%`,
                      }}
                    />
                  )}
                </div>

                <div className="text-[9.5px] text-ink-2 font-sans italic mt-1 leading-tight">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 pt-1.5 border-t border-rule/40 flex justify-between text-[8px] font-mono text-ink-3">
        <span>← Supports Benign / Noise</span>
        <span>Supports Cascading Crisis →</span>
      </div>
    </div>
  );
};
