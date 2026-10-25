import React from 'react';
import type { NavTab } from '../store/useAppStore';
import { useAppStore } from '../store/useAppStore';
import {
  Activity,
  GitCompare,
  GitBranch,
  Database,
  BarChart3,
  Zap,
  FileText,
  Search,
  HelpCircle,
} from 'lucide-react';

interface TabConfig {
  id: NavTab;
  code: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabConfig[] = [
  { id: 'command', code: '01', name: 'COMMAND ROOM', icon: Activity },
  { id: 'twins', code: '02', name: 'TWIN LAB', icon: GitCompare },
  { id: 'causal', code: '03', name: 'CAUSAL EXPLORER', icon: GitBranch },
  { id: 'sources', code: '04', name: 'SOURCES & PRIORS', icon: Database },
  { id: 'scoreboard', code: '05', name: 'SCOREBOARD', icon: BarChart3 },
  { id: 'stress', code: '06', name: 'STRESS LAB', icon: Zap },
  { id: 'report', code: '07', name: 'AFTER-ACTION REPORT', icon: FileText },
];

export const Navigation: React.FC = () => {
  const { activeTab, setActiveTab, setCommandPaletteOpen, setShortcutsOpen } = useAppStore();

  return (
    <nav
      className="border-b border-rule bg-paper px-4 py-1 flex flex-wrap items-center justify-between select-none text-xs"
      aria-label="Main Navigation"
    >
      <div className="flex items-center gap-1 overflow-x-auto py-0.5" role="tablist">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] tracking-wider uppercase transition-all border relative ${
                isActive
                  ? 'border-rule border-b-transparent bg-surface text-ink font-bold shadow-sm -mb-[5px] pb-2 z-10'
                  : 'border-transparent text-ink-3 hover:text-ink hover:bg-paper-2'
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 ${
                  isActive ? 'text-ink' : 'text-ink-3'
                }`}
              />
              <span className="text-[10px] text-ink-3">{tab.code} ·</span>
              <span>{tab.name}</span>
              {isActive && (
                <span className="absolute top-0 left-0 right-0 h-0.5 bg-ink" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 font-mono text-[10px] text-ink-3 py-1">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="px-2 py-1 border border-rule bg-surface hover:bg-paper-2 transition-colors flex items-center gap-1.5 text-ink-2 shadow-xs"
          title="Open Command Palette (Cmd+K / Ctrl+K)"
          aria-label="Open Command Palette"
        >
          <Search className="w-3 h-3 text-ink-3" />
          <span>PALETTE</span>
          <kbd className="bg-paper-2 px-1 border border-rule text-[9px] font-bold">⌘K</kbd>
        </button>
        <button
          onClick={() => setShortcutsOpen(true)}
          className="px-2 py-1 border border-rule bg-surface hover:bg-paper-2 transition-colors flex items-center gap-1 text-ink-2 shadow-xs"
          title="View Keyboard Shortcuts (?)"
          aria-label="Keyboard Shortcuts"
        >
          <HelpCircle className="w-3 h-3 text-ink-3" />
          <span>SHORTCUTS (?)</span>
        </button>
      </div>
    </nav>
  );
};
