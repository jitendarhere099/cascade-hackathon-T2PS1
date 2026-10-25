import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { X, RotateCcw } from 'lucide-react';
import { DEFAULT_COSTS } from '../api/mockEngine';

export const CostModelModal: React.FC = () => {
  const { isCostModalOpen, setCostModalOpen, costs, updateCosts } = useAppStore();

  if (!isCostModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[1px] select-none p-4">
      <div className="w-full max-w-xl bg-surface border border-rule shadow-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-rule pb-2 mb-4">
          <div>
            <h2 className="font-serif font-bold text-base text-ink uppercase tracking-wide">
              MUNICIPAL LOSS MODEL &amp; DECISION PARAMETERS
            </h2>
            <p className="text-[10px] font-mono text-ink-3">
              LIVE-EDITABLE LOSS FUNCTION L(action, hypothesis, delay, fatigue)
            </p>
          </div>
          <button
            onClick={() => setCostModalOpen(false)}
            className="text-ink-3 hover:text-ink"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs font-mono">
          {/* Missed Cascade Section */}
          <div className="border border-rule/60 p-3 bg-paper/30">
            <div className="font-bold text-ink mb-2 text-[11px]">
              01 · MISSED CASCADE DAMAGE FUNCTION: D0 × (1 + g)^t
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-ink-3 block mb-1">
                  BASE DAMAGE D0 (COST UNITS):
                </label>
                <input
                  type="number"
                  value={costs.missed_cascade.D0}
                  onChange={(e) =>
                    updateCosts({
                      missed_cascade: {
                        ...costs.missed_cascade,
                        D0: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-rule px-2 py-1 bg-surface font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-ink-3 block mb-1">
                  GROWTH RATE g (PER MINUTE):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={costs.missed_cascade.g}
                  onChange={(e) =>
                    updateCosts({
                      missed_cascade: {
                        ...costs.missed_cascade,
                        g: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-rule px-2 py-1 bg-surface font-mono"
                />
              </div>
            </div>
          </div>

          {/* False Alarms Section */}
          <div className="border border-rule/60 p-3 bg-paper/30">
            <div className="font-bold text-ink mb-2 text-[11px]">
              02 · FALSE ALARM PENALTIES (BENIGN STREAM DISRUPTION)
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-ink-3 block mb-1">
                  PREPARE COST:
                </label>
                <input
                  type="number"
                  value={costs.false_alarms.noise_or_sensor.PREPARE}
                  onChange={(e) =>
                    updateCosts({
                      false_alarms: {
                        ...costs.false_alarms,
                        noise_or_sensor: {
                          ...costs.false_alarms.noise_or_sensor,
                          PREPARE: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full border border-rule px-2 py-1 bg-surface font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-ink-3 block mb-1">
                  ALERT COST:
                </label>
                <input
                  type="number"
                  value={costs.false_alarms.noise_or_sensor.ALERT}
                  onChange={(e) =>
                    updateCosts({
                      false_alarms: {
                        ...costs.false_alarms,
                        noise_or_sensor: {
                          ...costs.false_alarms.noise_or_sensor,
                          ALERT: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full border border-rule px-2 py-1 bg-surface font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-ink-3 block mb-1">
                  ESCALATE COST:
                </label>
                <input
                  type="number"
                  value={costs.false_alarms.noise_or_sensor.ESCALATE}
                  onChange={(e) =>
                    updateCosts({
                      false_alarms: {
                        ...costs.false_alarms,
                        noise_or_sensor: {
                          ...costs.false_alarms.noise_or_sensor,
                          ESCALATE: Number(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full border border-rule px-2 py-1 bg-surface font-mono"
                />
              </div>
            </div>
          </div>

          {/* Cry-wolf Fatigue & Hysteresis */}
          <div className="border border-rule/60 p-3 bg-paper/30">
            <div className="font-bold text-ink mb-2 text-[11px]">
              03 · CRY-WOLF FATIGUE &amp; HYSTERESIS STABILITY
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-ink-3 block mb-1">
                  FATIGUE MULTIPLIER κ:
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={costs.fatigue.kappa}
                  onChange={(e) =>
                    updateCosts({
                      fatigue: {
                        ...costs.fatigue,
                        kappa: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-rule px-2 py-1 bg-surface font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-ink-3 block mb-1">
                  MIN DWELL TIME (MINUTES):
                </label>
                <input
                  type="number"
                  value={costs.hysteresis.dwell_raise}
                  onChange={(e) =>
                    updateCosts({
                      hysteresis: {
                        ...costs.hysteresis,
                        dwell_raise: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-rule px-2 py-1 bg-surface font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-5 pt-3 border-t border-rule">
          <button
            onClick={() => updateCosts(DEFAULT_COSTS)}
            className="flex items-center gap-1.5 px-3 py-1 border border-rule text-ink-2 hover:bg-paper-2 font-mono text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET DEFAULTS</span>
          </button>
          <button
            onClick={() => setCostModalOpen(false)}
            className="px-4 py-1.5 bg-ink text-surface font-mono text-xs hover:bg-ink-2 transition-colors"
          >
            APPLY &amp; CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
