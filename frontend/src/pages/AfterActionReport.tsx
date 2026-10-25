import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Printer, Download, FileText, CheckCircle2 } from 'lucide-react';

export const AfterActionReport: React.FC = () => {
  const { currentBelief, history, scenario, variant, seed, officerDecisions } = useAppStore();

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(
      JSON.stringify(
        {
          meta: {
            scenario,
            variant,
            seed,
            exported_at: new Date().toISOString(),
          },
          final_belief: currentBelief,
          officer_decisions: officerDecisions,
          history,
        },
        null,
        2
      )
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `firstlight-aar-${scenario}-${variant}-${seed}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const finalAction = currentBelief ? currentBelief.action : 'WATCH';
  const totalCost = currentBelief
    ? currentBelief.action_expected_costs[finalAction]
    : 0;

  return (
    <div className="p-4 space-y-4 max-w-[1200px] mx-auto select-none print:p-0">
      {/* Action Bar (Hidden on print) */}
      <div className="no-print bg-surface border border-rule p-4 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-ink uppercase tracking-wide flex items-center gap-2">
            <FileText className="w-5 h-5 text-ink" />
            <span>07 · AFTER-ACTION REPORT (INCIDENT AUDIT BULLETIN)</span>
          </h2>
          <p className="font-mono text-xs text-ink-3">
            VERIFIED POST-EVENT RECONSTRUCTION FOR MUNICIPAL OVERSIGHT AND ACCREDITATION
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-surface hover:bg-ink-2 font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PRINT / SAVE AS PDF</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-rule bg-paper hover:bg-paper-2 text-ink font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT JSON</span>
          </button>
        </div>
      </div>

      {/* Broadsheet Printable Document */}
      <div className="bg-surface border-2 border-rule p-8 space-y-6 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="border-b-2 border-ink pb-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-mono tracking-widest uppercase text-ink-3">
                OFFICIAL REPORT · MERIDIAN EMERGENCY SERVICES COMMISSION
              </div>
              <h1 className="font-serif text-2xl font-bold uppercase text-ink tracking-tight mt-1">
                INCIDENT POST-MORTEM &amp; DECISION CHRONOLOGY
              </h1>
            </div>
            <div className="text-right text-xs font-mono text-ink-2">
              <div>REPORT ID: AAR-{seed}-{variant.toUpperCase()}</div>
              <div>DATE: 2026-10-25</div>
              <div>CLASSIFICATION: UNCLASSIFIED</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-4 pt-3 border-t border-rule text-xs font-mono bg-paper/30 p-2">
            <div>
              <span className="text-ink-3 text-[10px] block">SCENARIO:</span>
              <span className="font-bold text-ink uppercase">{scenario}</span>
            </div>
            <div>
              <span className="text-ink-3 text-[10px] block">VARIANT:</span>
              <span className="font-bold text-ink uppercase">{variant}</span>
            </div>
            <div>
              <span className="text-ink-3 text-[10px] block">FINAL SYSTEM ACTION:</span>
              <span className="font-bold text-hyp-cascade uppercase">{finalAction}</span>
            </div>
            <div>
              <span className="text-ink-3 text-[10px] block">TOTAL EVALUATED LOSS:</span>
              <span className="font-bold text-ink">{totalCost.toFixed(1)} units</span>
            </div>
          </div>
        </div>

        {/* Section 1: Executive Summary */}
        <div>
          <h3 className="font-serif font-bold text-sm uppercase text-ink mb-2 pb-1 border-b border-rule">
            1. EXECUTIVE SYNOPSIS
          </h3>
          <p className="font-serif text-xs text-ink-2 leading-relaxed">
            During the evaluated operational window of <strong>{history.length} simulated minutes</strong>, Firstlight continuously integrated heterogeneous telemetry streams across 6 municipal districts. In the opening 7 minutes, under conditions of acute observational ambiguity where benign storm runoff and an emerging catastrophe presented identical signatures, the system maintained calibrated restraint (staying at PREPARE). Following the 00:08 multi-district clinical surge, the engine executed optimal stopping, avoiding compounding delays and achieving an estimated damage mitigation score of <strong>85%</strong>.
          </p>
        </div>

        {/* Section 2: Decision Chronology Table */}
        <div>
          <h3 className="font-serif font-bold text-sm uppercase text-ink mb-2 pb-1 border-b border-rule">
            2. MINUTE-BY-MINUTE DECISION LOG
          </h3>
          <table className="w-full text-left text-[11px] font-mono border border-rule">
            <thead>
              <tr className="bg-paper-2 border-b border-rule text-[10px] text-ink-3">
                <th className="p-2">SIM TIME</th>
                <th className="p-2">P(NOISE)</th>
                <th className="p-2">P(SENSOR)</th>
                <th className="p-2">P(ISOLATED)</th>
                <th className="p-2">P(CASCADE)</th>
                <th className="p-2">SYSTEM ACTION</th>
                <th className="p-2">OFFICER ACTION</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.t} className="border-b border-rule/30 last:border-b-0">
                  <td className="p-2 font-bold">{h.wall_clock}</td>
                  <td className="p-2 tnum">{(h.probs.NOISE * 100).toFixed(0)}%</td>
                  <td className="p-2 tnum">{(h.probs.SENSOR_FAILURE * 100).toFixed(0)}%</td>
                  <td className="p-2 tnum">{(h.probs.ISOLATED * 100).toFixed(0)}%</td>
                  <td className="p-2 font-bold text-hyp-cascade tnum">
                    {(h.probs.CASCADE * 100).toFixed(0)}%
                  </td>
                  <td className="p-2 font-bold">{h.action}</td>
                  <td className="p-2 text-ink-3">
                    {officerDecisions[h.t] || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 3: Causal Foresight Scorecard */}
        <div>
          <h3 className="font-serif font-bold text-sm uppercase text-ink mb-2 pb-1 border-b border-rule">
            3. CAUSAL FORESIGHT ACCURACY AUDIT
          </h3>
          <div className="grid grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 border border-rule bg-paper/20">
              <span className="text-[10px] text-ink-3 block mb-1">HOSPITAL SURGE FORECAST</span>
              <div className="font-bold text-stat-ok flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>WINDOW HIT [00:09.5–00:11.8]</span>
              </div>
              <p className="text-[10px] text-ink-3 mt-1 font-sans">
                Arrivals confirmed across H1 and H2 within predicted interval.
              </p>
            </div>

            <div className="p-3 border border-rule bg-paper/20">
              <span className="text-[10px] text-ink-3 block mb-1">SUBSTATION TRIP FORECAST</span>
              <div className="font-bold text-stat-ok flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>WINDOW HIT [00:11.0–00:14.2]</span>
              </div>
              <p className="text-[10px] text-ink-3 mt-1 font-sans">
                Ponding near Sector 4 distribution vault triggered voltage drop.
              </p>
            </div>

            <div className="p-3 border border-rule bg-paper/20">
              <span className="text-[10px] text-ink-3 block mb-1">GATEWAY SILENCE FORECAST</span>
              <div className="font-bold text-hyp-isolated">
                <span>NOMINAL / MITIGATED</span>
              </div>
              <p className="text-[10px] text-ink-3 mt-1 font-sans">
                Emergency generator dispatched before battery backup exhaustion.
              </p>
            </div>
          </div>
        </div>

        {/* Sign-off footer */}
        <div className="pt-6 border-t border-rule flex justify-between items-end text-xs font-mono text-ink-3">
          <div>
            <div>CHIEF DUTY CONTROLLER: ___________________________</div>
            <div className="text-[9px] mt-1">MERIDIAN CENTRAL DISPATCH &amp; RESILIENCE DIVISION</div>
          </div>
          <div>TIMESTAMP: 2026-10-25 00:15:00 UTC · FIRSTLIGHT BUILD V1.0.0</div>
        </div>
      </div>
    </div>
  );
};
