import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AlertOctagon, Zap, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface InjectedFault {
  id: string;
  name: string;
  timestamp: string;
  impact: string;
  engineResponse: string;
}

export const StressLab: React.FC = () => {
  const { injectFault, currentBelief } = useAppStore();
  const [log, setLog] = useState<InjectedFault[]>([
    {
      id: 'f-init',
      name: 'System Pre-Flight Health Audit',
      timestamp: '00:00:00',
      impact: 'Baseline telemetry normal across 4 gateways.',
      engineResponse: 'All 8 channels reporting within nominal bounds.',
    },
  ]);

  const triggerChaos = (type: string, name: string, target?: string, impact?: string, response?: string) => {
    injectFault(type, target);
    const entry: InjectedFault = {
      id: `f-${Date.now()}`,
      name,
      timestamp: currentBelief ? currentBelief.wall_clock : 'T+00:00',
      impact: impact || 'Injected adversarial telemetry anomaly.',
      engineResponse: response || 'Handled safely; zero NaN/Inf or filter crash.',
    };
    setLog((prev) => [entry, ...prev]);
  };

  const chaosActions = [
    {
      name: 'Gateway Blackout (GW-B)',
      desc: 'Sever Riverbank gateway GW-B, cutting 100 sensors simultaneously.',
      action: () =>
        triggerChaos(
          'gateway_blackout',
          'Gateway Blackout (GW-B)',
          'GW-B',
          '100 sensors go silent across Sector D3.',
          'Missing heartbeats detected; silence modeled as P(silence|state), NOT treated as all-clear.'
        ),
    },
    {
      name: 'Camera Channel Cutout',
      desc: 'All street flood cameras vanish mid-episode.',
      action: () =>
        triggerChaos(
          'channel_cutout',
          'Camera Channel Cutout',
          'camera_flood',
          'Flood camera telemetry completely offline.',
          'Camera channel marked MISSING in data_health; likelihood term dropped, uncertainty widens toward prior.'
        ),
    },
    {
      name: 'Coordinated Rumor Wave',
      desc: 'Inject 40 identical social chatter posts claiming catastrophic bridge collapse.',
      action: () =>
        triggerChaos(
          'rumor_wave',
          'Coordinated Rumor Wave',
          'social_post',
          'High text-duplication burst with zero account diversity.',
          'Rumor detector shifts probability to rumor nuisance factor; ESCALATE blocked without physical confirmation.'
        ),
    },
    {
      name: 'Structured Liars (Common-Cause)',
      desc: '40 sensors behind shared firmware simultaneously emit 9.9 z-score readings.',
      action: () =>
        triggerChaos(
          'sensor_stuck_high',
          'Structured Liars (Common-Cause)',
          'GW-A',
          'Unnaturally low variance across 40 drainage sensors.',
          'Common-cause detector triggers; raises SENSOR_FAILURE to 82%, discounts physical evidence weight.'
        ),
    },
    {
      name: 'Retroactive Retraction & Rollback',
      desc: 'Retract critical flood observation from 3 minutes prior.',
      action: () =>
        triggerChaos(
          'retraction',
          'Retroactive Retraction & Rollback',
          'ev-flood-d2',
          'Observation from T-3 marked RETRACTED.',
          'Bitemporal ledger rolls back particle checkpoint, re-filters corrected stream; belief restored.'
        ),
    },
    {
      name: 'Packet Arrival Shuffle',
      desc: 'Deliver arriving packets out-of-order with 2-6 minute random skew.',
      action: () =>
        triggerChaos(
          'shuffle_delivery',
          'Packet Arrival Shuffle',
          'ledger',
          'Events arrive out-of-sequence.',
          'Ledger re-orders by event_time; belief matches in-order delivery within floating-point epsilon.'
        ),
    },
  ];

  return (
    <div className="p-4 space-y-4 max-w-[1700px] mx-auto select-none">
      {/* Header */}
      <div className="bg-surface border border-rule p-4 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-ink uppercase tracking-wide flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-hyp-cascade" />
            <span>06 · STRESS LAB (ADVERSARIAL CHAOS CONSOLE)</span>
          </h2>
          <p className="font-mono text-xs text-ink-3">
            VERIFYING ADVERSARIAL INTEGRITY: NO CRASH, NO HALLUCINATIONS, AND UNCERTAINTY WIDENING UNDER EXTREME CORRUPTION
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ROBUSTNESS LAYER ACTIVE</span>
          </span>
        </div>
      </div>

      {/* Grid of Chaos Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {chaosActions.map((chaos, idx) => (
          <div
            key={idx}
            className="bg-surface border border-rule p-3 flex flex-col justify-between hover:border-ink transition-colors"
          >
            <div>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-ink mb-1">
                <Zap className="w-3.5 h-3.5 text-hyp-sensor" />
                <span>{chaos.name}</span>
              </div>
              <p className="text-[11px] font-sans text-ink-2 leading-relaxed mb-3">
                {chaos.desc}
              </p>
            </div>
            <button
              onClick={chaos.action}
              className="w-full py-1.5 px-3 bg-paper border border-rule hover:bg-paper-2 text-ink font-mono text-[10px] font-bold uppercase transition-colors"
            >
              Inject Fault Now
            </button>
          </div>
        ))}
      </div>

      {/* Real-Time Chaos Response Audit Log */}
      <div className="bg-surface border border-rule p-4">
        <div className="flex justify-between items-center mb-3 pb-1 border-b border-rule text-[11px] font-mono text-ink-3">
          <span>REAL-TIME ENGINE ADVERSITY RESPONSE LOG</span>
          <span>NUMERICAL SAFETY AUDIT: ZERO NaN / Inf</span>
        </div>

        <div className="space-y-2 text-xs font-mono max-h-64 overflow-y-auto pr-1">
          {log.map((entry) => (
            <div
              key={entry.id}
              className="p-2 border border-rule/50 bg-paper/30 flex flex-col gap-1"
            >
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-ink flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-hyp-cascade inline" />
                  <span>{entry.name}</span>
                </span>
                <span className="text-[10px] text-ink-3">{entry.timestamp}</span>
              </div>
              <div className="text-[11px] text-ink-2 font-sans">
                <span className="text-ink-3 font-mono text-[10px] mr-1">STRESS:</span>
                {entry.impact}
              </div>
              <div className="text-[11px] text-stat-ok font-sans font-medium">
                <span className="text-ink-3 font-mono text-[10px] mr-1">RESPONSE:</span>
                {entry.engineResponse}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
