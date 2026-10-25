import React, { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { CommandRoom } from './pages/CommandRoom';
import { TwinLab } from './pages/TwinLab';
import { CausalExplorer } from './pages/CausalExplorer';
import { SourcesPriors } from './pages/SourcesPriors';
import { Scoreboard } from './pages/Scoreboard';
import { StressLab } from './pages/StressLab';
import { AfterActionReport } from './pages/AfterActionReport';
import { CommandPalette } from './components/CommandPalette';
import { ShortcutsModal } from './components/ShortcutsModal';
import { CostModelModal } from './components/CostModelModal';
import { GuidedTour } from './components/GuidedTour';
import type { Action } from './types';
import {
  Smartphone,
  Monitor,
  Eye,
  ShieldCheck,
  BellRing,
  Siren,
  Play,
  Pause,
  StepForward,
  Clock,
  BrainCircuit,
  TrendingUp,
} from 'lucide-react';

export default function App() {
  const {
    activeTab,
    init,
    isPlaying,
    play,
    pause,
    step,
    seek,
    currentBelief,
    logOfficerDecision,
    setCommandPaletteOpen,
    setShortcutsOpen,
  } = useAppStore();

  const [isMobileMode, setIsMobileMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('mobile') === 'true') return true;
      return window.innerWidth < 768;
    }
    return false;
  });

  // Auto-init on mount
  useEffect(() => {
    init();
  }, [init]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if inside an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Cmd+K or Ctrl+K for Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (isPlaying) pause();
        else play();
      } else if (e.key === '.') {
        e.preventDefault();
        step();
      } else if (e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (currentBelief) seek(Math.max(0, currentBelief.t - 1));
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (currentBelief) seek(Math.min(15, currentBelief.t + 1));
      } else if (e.key === '1') {
        logOfficerDecision('WATCH');
      } else if (e.key === '2') {
        logOfficerDecision('PREPARE');
      } else if (e.key === '3') {
        logOfficerDecision('ALERT');
      } else if (e.key === '4') {
        logOfficerDecision('ESCALATE');
      } else if (e.key === '?') {
        setShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, play, pause, step, seek, currentBelief, logOfficerDecision, setCommandPaletteOpen, setShortcutsOpen]);

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans">
      <Header />
      <Navigation />

      {/* Viewport Mode Toggle for Reviewers (Desktop broadsheet vs One-Button mobile) */}
      <div className="bg-paper-2 border-b border-rule px-4 py-1 text-[10px] font-mono flex justify-between items-center text-ink-3">
        <span className="font-semibold text-ink-2">MERIDIAN CRISIS ENGINE · V1.0.0-PROD</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileMode(!isMobileMode)}
            className="flex items-center gap-1.5 px-2.5 py-0.5 border border-rule bg-surface hover:bg-paper transition-colors text-ink shadow-2xs font-medium"
            title="Toggle between full broadsheet dashboard and simplified field duty terminal"
          >
            {isMobileMode ? <Monitor className="w-3.5 h-3.5 text-ink-2" /> : <Smartphone className="w-3.5 h-3.5 text-ink-2" />}
            <span>{isMobileMode ? 'BROADSHEET VIEW' : 'ONE-BUTTON MOBILE VIEW'}</span>
          </button>
        </div>
      </div>

      <main className="flex-1">
        {isMobileMode ? (
          <OneButtonMobileView />
        ) : (
          <>
            {activeTab === 'command' && <CommandRoom />}
            {activeTab === 'twins' && <TwinLab />}
            {activeTab === 'causal' && <CausalExplorer />}
            {activeTab === 'sources' && <SourcesPriors />}
            {activeTab === 'scoreboard' && <Scoreboard />}
            {activeTab === 'stress' && <StressLab />}
            {activeTab === 'report' && <AfterActionReport />}
          </>
        )}
      </main>

      {/* Global Modals & Overlays */}
      <CommandPalette />
      <ShortcutsModal />
      <CostModelModal />
      <GuidedTour />
    </div>
  );
}

// Specialized One Button Mobile Emergency View (<768px / mobile toggle)
function OneButtonMobileView() {
  const { currentBelief, logOfficerDecision, play, pause, isPlaying, step } = useAppStore();

  if (!currentBelief) {
    return <div className="p-8 text-center font-mono text-xs text-ink-3">AWAITING TELEMETRY STREAM...</div>;
  }

  const { action, probs, forecast, mind_change, wall_clock, officer_action } = currentBelief;
  const topForecast = forecast[0];

  const ACTION_ICONS: Record<Action, React.ComponentType<{ className?: string }>> = {
    WATCH: Eye,
    PREPARE: ShieldCheck,
    ALERT: BellRing,
    ESCALATE: Siren,
  };

  const CurrentIcon = ACTION_ICONS[action];

  return (
    <div className="p-4 max-w-md mx-auto space-y-3.5 select-none">
      {/* Probability Card */}
      <div className="border border-rule bg-surface p-4 text-center shadow-2xs">
        <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-ink-3 uppercase mb-1">
          <Clock className="w-3 h-3 text-ink-3" />
          <span>DUTY OFFICER TERMINAL · {wall_clock}</span>
        </div>
        <div className="font-serif text-5xl font-bold my-1 tracking-tight text-ink leading-none">
          {(probs.CASCADE * 100).toFixed(0)}%
        </div>
        <div className="text-xs font-mono text-ink-3 uppercase font-semibold mt-1">
          POSTERIOR P(CASCADING CRISIS)
        </div>
        {/* Horizontal Probability Bar */}
        <div className="w-full h-2 bg-paper-2 border border-rule/60 mt-3 overflow-hidden">
          <div
            className="h-full bg-hyp-cascade transition-all duration-300"
            style={{ width: `${Math.round(probs.CASCADE * 100)}%` }}
          />
        </div>
      </div>

      {/* The Big Action Directive Box */}
      <div className="space-y-2">
        <div
          className={`p-5 border-2 text-center transition-all ${
            action === 'ESCALATE'
              ? 'bg-act-escalate text-white border-red-950 font-bold animate-escalate-pulse'
              : action === 'ALERT'
              ? 'bg-orange-100 text-orange-950 border-orange-500'
              : action === 'PREPARE'
              ? 'bg-amber-100 text-amber-950 border-amber-400'
              : 'bg-paper-2 text-ink-2 border-rule'
          }`}
        >
          <div className="flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-widest text-ink-3 mb-1">
            <CurrentIcon className="w-3.5 h-3.5" />
            <span>RECOMMENDED ACTION DIRECTIVE</span>
          </div>
          <div className="font-serif text-4xl font-bold uppercase tracking-tight">{action}</div>
        </div>

        {/* Officer 1-tap confirmation / override */}
        <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
          {(['WATCH', 'PREPARE', 'ALERT', 'ESCALATE'] as Action[]).map((act) => {
            const isOfficer = officer_action === act;
            const ActIcon = ACTION_ICONS[act];
            return (
              <button
                key={act}
                onClick={() => logOfficerDecision(act)}
                className={`py-2 px-1 border flex flex-col items-center gap-0.5 transition-colors ${
                  isOfficer
                    ? 'bg-ink text-surface font-bold border-ink'
                    : 'bg-surface hover:bg-paper-2 border-rule text-ink'
                }`}
                title={`Confirm decision as ${act}`}
              >
                <ActIcon className="w-3 h-3" />
                <span className="text-[10px] font-bold">{act}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Forecast Card */}
      {topForecast && (
        <div className="border border-rule bg-surface p-3 text-xs shadow-2xs">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-ink-3 uppercase mb-1 font-semibold">
            <TrendingUp className="w-3 h-3 text-hyp-isolated" />
            <span>NEXT PREDICTED EVENT:</span>
          </div>
          <div className="font-serif font-bold text-ink text-sm">{topForecast.node}</div>
          <div className="text-[10px] font-mono text-ink-2 mt-0.5">
            Window: T+{topForecast.window_start}m–T+{topForecast.window_end}m · {(topForecast.prob * 100).toFixed(0)}% probability
          </div>
        </div>
      )}

      {/* Latest Reasoning Narrative */}
      <div className="border border-rule bg-surface p-3 text-xs shadow-2xs">
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-ink-3 uppercase mb-1 font-semibold">
          <BrainCircuit className="w-3 h-3 text-ink-3" />
          <span>LATEST REASONING:</span>
        </div>
        <p className="font-serif text-xs text-ink-2 italic leading-relaxed">
          "{mind_change.message}"
        </p>
      </div>

      {/* Transport Controls */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={isPlaying ? pause : play}
          className="flex-1 py-2.5 bg-ink text-surface font-mono text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-surface" />}
          <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
        </button>
        <button
          onClick={step}
          className="px-4 py-2.5 border border-rule bg-surface font-mono text-xs font-medium flex items-center gap-1.5 hover:bg-paper-2 shadow-2xs"
        >
          <StepForward className="w-3.5 h-3.5 text-ink-2" />
          <span>STEP (+1m)</span>
        </button>
      </div>
    </div>
  );
}
