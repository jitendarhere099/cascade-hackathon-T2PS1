import React, { useState } from 'react';
import { SCENARIO_LIST } from '../api/mockEngine';
import type { NavTab } from '../store/useAppStore';
import { useAppStore } from '../store/useAppStore';
import { Search, X } from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    setActiveTab,
    setScenario,
    setVariant,
    injectFault,
  } = useAppStore();

  const [query, setQuery] = useState('');

  if (!isCommandPaletteOpen) return null;

  const actions = [
    { label: 'View: 01 · Command Room', action: () => setActiveTab('command') },
    { label: 'View: 02 · Twin Lab', action: () => setActiveTab('twins') },
    { label: 'View: 03 · Causal Explorer', action: () => setActiveTab('causal') },
    { label: 'View: 04 · Sources & Priors', action: () => setActiveTab('sources') },
    { label: 'View: 05 · Scoreboard', action: () => setActiveTab('scoreboard') },
    { label: 'View: 06 · Stress Lab', action: () => setActiveTab('stress') },
    { label: 'View: 07 · After-Action Report', action: () => setActiveTab('report') },
    { label: 'Variant: Set Tuesday Evening → Cascade', action: () => { setScenario('tuesday_evening', 'cascade'); } },
    { label: 'Variant: Set Tuesday Evening → Benign', action: () => { setScenario('tuesday_evening', 'benign'); } },
    { label: 'Stress: Inject Gateway GW-B Blackout', action: () => { injectFault('gateway_blackout', 'GW-B'); } },
    { label: 'Stress: Inject Street Flood Camera Cutout', action: () => { injectFault('channel_cutout', 'camera_flood'); } },
    { label: 'Stress: Inject Coordinated Rumor Wave', action: () => { injectFault('rumor_wave'); } },
    ...SCENARIO_LIST.map((scen) => ({
      label: `Scenario: ${scen.name}`,
      action: () => setScenario(scen.id),
    })),
  ];

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-ink/30 backdrop-blur-[1px] select-none">
      <div className="w-full max-w-lg bg-surface border border-rule shadow-md overflow-hidden">
        <div className="flex items-center px-3 py-2 border-b border-rule">
          <Search className="w-4 h-4 text-ink-3 mr-2" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, scenario or page..."
            className="w-full bg-transparent font-mono text-xs text-ink focus:outline-none"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="text-ink-3 hover:text-ink"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto p-1 text-xs font-mono">
          {filtered.length === 0 ? (
            <div className="p-3 text-ink-3 text-center">No matching commands.</div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  item.action();
                  setCommandPaletteOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-paper-2 flex items-center justify-between text-ink border-b border-rule/30 last:border-b-0"
              >
                <span>{item.label}</span>
                <span className="text-[10px] text-ink-3 font-sans">Run ↵</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
