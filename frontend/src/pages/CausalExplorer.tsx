import React, { useState } from 'react';
import { CausalDAG } from '../charts/CausalDAG';
import { useAppStore } from '../store/useAppStore';
import { RotateCcw } from 'lucide-react';

export const CausalExplorer: React.FC = () => {
  const { currentBelief } = useAppStore();

  const [interventions, setInterventions] = useState<Record<string, boolean>>({});
  const [cutEdges, setCutEdges] = useState<string[]>([]);
  const [altHypothesis, setAltHypothesis] = useState<'CASCADE' | 'FLU_CLUSTER' | 'GATEWAY_OUTAGE'>('CASCADE');

  const activeNodes: Record<string, number> = {
    HEAVY_RAIN: 0,
    DRAINAGE_OVERLOAD: 3,
    TRAFFIC_COLLAPSE: 5,
    ...(currentBelief && currentBelief.t >= 7 ? { EMERGENCY_CALL_SURGE: 7 } : {}),
    ...(currentBelief && currentBelief.t >= 9 && currentBelief.probs.CASCADE > 0.4 ? { HOSPITAL_SURGE: 9, POWER_SUBSTATION_TRIP: 10 } : {}),
    ...Object.fromEntries(Object.keys(interventions).filter((k) => interventions[k]).map((k) => [k, 1])),
  };

  const handleToggleIntervention = (node: string) => {
    setInterventions((prev) => ({
      ...prev,
      [node]: !prev[node],
    }));
  };

  const handleToggleCutEdge = (edgeId: string) => {
    setCutEdges((prev) =>
      prev.includes(edgeId) ? prev.filter((id) => id !== edgeId) : [...prev, edgeId]
    );
  };

  const resetGraph = () => {
    setInterventions({});
    setCutEdges([]);
  };

  return (
    <div className="p-4 space-y-4 max-w-[1700px] mx-auto select-none">
      {/* Header */}
      <div className="bg-surface border border-rule p-4 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-ink uppercase tracking-wide">
            03 · CAUSAL EXPLORER &amp; STRUCTURAL INTERVENTION MATRIX
          </h2>
          <p className="font-mono text-xs text-ink-3">
            EVALUATING CAUSAL DISCRIMINATION, PEARL'S do()-CALCULUS, AND EDGE REMOVAL EFFECTS
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={resetGraph}
            className="flex items-center gap-1.5 px-3 py-1 border border-rule hover:bg-paper-2 text-ink-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET GRAPH</span>
          </button>
        </div>
      </div>

      {/* Main DAG Graph Component */}
      <CausalDAG
        activeNodes={activeNodes}
        interventions={interventions}
        onToggleIntervention={handleToggleIntervention}
        cutEdges={cutEdges}
        onToggleCutEdge={handleToggleCutEdge}
      />

      {/* Alternative Hypotheses Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cascade Branch */}
        <div
          onClick={() => setAltHypothesis('CASCADE')}
          className={`bg-surface border p-4 cursor-pointer transition-all ${
            altHypothesis === 'CASCADE' ? 'border-hyp-cascade shadow-sm' : 'border-rule'
          }`}
        >
          <div className="flex justify-between items-center mb-2 pb-1 border-b border-rule text-xs font-mono">
            <span className="font-bold text-hyp-cascade">HYPOTHESIS A: FULL CASCADE</span>
            <span>P ~ 45%</span>
          </div>
          <p className="font-serif text-xs text-ink mb-2">
            Rain → Drainage Saturation → Arterial Flood → Substation Trip → Hospital Surge.
          </p>
          <div className="text-[10px] font-mono text-ink-3 space-y-1">
            <div>✓ Explains traffic deceleration</div>
            <div>✓ Explains 911 dispatch saturation</div>
            <div>✓ Predicts power substation trip (+3m)</div>
          </div>
        </div>

        {/* Flu Cluster Mimic */}
        <div
          onClick={() => setAltHypothesis('FLU_CLUSTER')}
          className={`bg-surface border p-4 cursor-pointer transition-all ${
            altHypothesis === 'FLU_CLUSTER' ? 'border-hyp-isolated shadow-sm' : 'border-rule'
          }`}
        >
          <div className="flex justify-between items-center mb-2 pb-1 border-b border-rule text-xs font-mono">
            <span className="font-bold text-hyp-isolated">HYPOTHESIS B: FLU CLUSTER MIMIC</span>
            <span>P ~ 15%</span>
          </div>
          <p className="font-serif text-xs text-ink mb-2">
            Independent biological cluster at H1 &amp; H2 without infrastructure precursors.
          </p>
          <div className="text-[10px] font-mono text-ink-3 space-y-1">
            <div>✓ Explains hospital triage surge</div>
            <div>✗ Predicts ZERO traffic collapse</div>
            <div>✗ Predicts ZERO power substation trip</div>
          </div>
        </div>

        {/* Gateway Outage Mimic */}
        <div
          onClick={() => setAltHypothesis('GATEWAY_OUTAGE')}
          className={`bg-surface border p-4 cursor-pointer transition-all ${
            altHypothesis === 'GATEWAY_OUTAGE' ? 'border-hyp-sensor shadow-sm' : 'border-rule'
          }`}
        >
          <div className="flex justify-between items-center mb-2 pb-1 border-b border-rule text-xs font-mono">
            <span className="font-bold text-hyp-sensor">HYPOTHESIS C: TELECOM MASKING</span>
            <span>P ~ 12%</span>
          </div>
          <p className="font-serif text-xs text-ink mb-2">
            Gateway GW-B drops abruptly, masking 100 sensors and mimicking "everything quiet".
          </p>
          <div className="text-[10px] font-mono text-ink-3 space-y-1">
            <div>✓ Explains sudden drop in Sector D3 telemetry</div>
            <div>✗ Heartbeat loss indicates silence, not resolution</div>
            <div>✗ Physical corroboration required before stand-down</div>
          </div>
        </div>
      </div>
    </div>
  );
};
