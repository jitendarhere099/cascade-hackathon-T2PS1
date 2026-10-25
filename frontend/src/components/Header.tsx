import React from 'react';
import { SCENARIO_LIST } from '../api/mockEngine';
import { useAppStore } from '../store/useAppStore';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  Repeat,
  Compass,
  ShieldAlert,
  Flame,
  ShieldCheck,
  Layers,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    scenario,
    variant,
    setScenario,
    setVariant,
    isPlaying,
    speed,
    play,
    pause,
    step,
    setSpeed,
    restart,
    currentBelief,
    setTourOpen,
  } = useAppStore();

  const selectedScenMeta = SCENARIO_LIST.find((s) => s.id === scenario) || SCENARIO_LIST[0];

  return (
    <header className="border-b border-rule bg-surface px-4 py-2 select-none">
      {/* Top Bar: Identity & Telemetry Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule/50 pb-2">
        {/* Masthead Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 bg-ink text-surface rounded-xs">
            <ShieldAlert className="w-4 h-4 text-paper" />
          </div>
          <div>
            <div className="flex items-baseline gap-2.5">
              <h1 className="font-serif text-xl font-bold tracking-tight text-ink uppercase leading-none">
                FIRSTLIGHT
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.2 bg-paper-2 border border-rule text-[9px] font-mono text-ink-3 uppercase font-semibold">
                SYS-OP: 24/7 ACTIVE
              </span>
            </div>
            <div className="text-[11px] font-mono tracking-wider text-ink-3 uppercase mt-0.5">
              MERIDIAN MUNICIPAL CRISIS PREDICTION &amp; DECISION ENGINE · POP. 8.2M
            </div>
          </div>
        </div>

        {/* Telemetry Status Indicators & Clock */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
          {/* Wall Clock */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 border border-rule bg-paper shadow-2xs"
            title="Current Simulation Timeline (T+00:00 to T+00:15)"
          >
            <Clock className="w-3.5 h-3.5 text-ink-3" />
            <span className="text-ink-3 text-[10px]">SIM CLOCK:</span>
            <span className="font-bold text-ink tnum">
              {currentBelief ? currentBelief.wall_clock : 'T+00:00'}
            </span>
          </div>

          {/* Operator Fatigue Metric */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 border border-rule bg-paper shadow-2xs"
            title="Operator Alert Fatigue Multiplier: Penalizes repeated false alarms to prevent alarm desensitization"
          >
            <Activity className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-ink-3 text-[10px]">FATIGUE:</span>
            <span className="font-bold text-ink tnum">
              {currentBelief ? currentBelief.fatigue.toFixed(2) : '0.00'}
            </span>
          </div>

          {/* Flip Flop Counter */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 border border-rule bg-paper shadow-2xs"
            title="Recommendation Flips: Number of times system shifted between action levels"
          >
            <Repeat className="w-3.5 h-3.5 text-ink-3" />
            <span className="text-ink-3 text-[10px]">FLIPS:</span>
            <span className="font-bold text-ink tnum">
              {currentBelief ? currentBelief.flip_count : 0}
            </span>
          </div>

          {/* Data Health Stream Badge */}
          {currentBelief && Object.values(currentBelief.data_health).some((s) => s !== 'OK') ? (
            <div
              className="flex items-center gap-1.5 px-2 py-1 border border-amber-400 bg-amber-50 text-amber-900 font-medium text-[10px]"
              title="One or more gateway telemetry feeds are experiencing degraded throughput or outages"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
              <span className="font-bold">REDUCED TELEMETRY</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 px-2 py-1 border border-emerald-300 bg-emerald-50 text-emerald-900 font-medium text-[10px]"
              title="All sensor network gateways reporting nominal telemetry"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block animate-pulse" />
              <span className="font-bold">STREAM NOMINAL</span>
            </div>
          )}

          {/* Guided Tour Trigger */}
          <button
            onClick={() => setTourOpen(true)}
            className="flex items-center gap-1 text-[11px] font-sans px-2.5 py-1 border border-rule bg-surface hover:bg-paper-2 transition-colors text-ink shadow-2xs"
            title="Launch interactive guided demonstration of Firstlight"
          >
            <Compass className="w-3.5 h-3.5 text-ink-2" />
            <span>Guided Tour</span>
          </button>
        </div>
      </div>

      {/* Control Strip: Scenario Selection & Playback Transport */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        {/* Scenario and Variant Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 font-mono text-ink-3 uppercase text-[10px]">
              <Layers className="w-3 h-3 text-ink-3" />
              <span>SCENARIO:</span>
            </div>
            <select
              id="scenario-select"
              aria-label="Simulation Scenario Selector"
              value={scenario}
              onChange={(e) => setScenario(e.target.value, variant)}
              className="bg-paper border border-rule px-2.5 py-1 text-xs font-mono text-ink focus:outline-none focus:border-ink cursor-pointer hover:bg-paper-2 transition-colors"
            >
              {SCENARIO_LIST.map((scen) => (
                <option key={scen.id} value={scen.id}>
                  {scen.name}
                </option>
              ))}
            </select>
          </div>

          {/* Variant Selector Pill */}
          {selectedScenMeta.hasVariants && (
            <div className="flex items-center border border-rule p-0.5 bg-paper gap-0.5 text-xs font-mono">
              <button
                onClick={() => setVariant('cascade')}
                className={`flex items-center gap-1 px-2.5 py-0.5 text-[11px] transition-colors ${
                  variant === 'cascade'
                    ? 'bg-hyp-cascade text-white font-bold shadow-xs'
                    : 'text-ink-2 hover:bg-paper-2'
                }`}
                title="Simulate true cascading multi-district failure path"
              >
                <Flame className="w-3 h-3" />
                <span>Cascade Variant</span>
              </button>
              <button
                onClick={() => setVariant('benign')}
                className={`flex items-center gap-1 px-2.5 py-0.5 text-[11px] transition-colors ${
                  variant === 'benign'
                    ? 'bg-stat-ok text-white font-bold shadow-xs'
                    : 'text-ink-2 hover:bg-paper-2'
                }`}
                title="Simulate benign isolated nuisance with sensor failure"
              >
                <ShieldCheck className="w-3 h-3" />
                <span>Benign Variant</span>
              </button>
            </div>
          )}
        </div>

        {/* Playback Controls & Speed Toggle */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center border border-rule bg-paper shadow-2xs">
            <button
              onClick={isPlaying ? pause : play}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors border-r border-rule font-medium ${
                isPlaying
                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  : 'bg-paper hover:bg-paper-2 text-ink'
              }`}
              title={isPlaying ? 'Pause Simulation (Space)' : 'Play Simulation (Space)'}
              aria-label={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 text-amber-800" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-ink text-ink" />
              )}
              <span className="font-mono text-[10px] uppercase font-bold">
                {isPlaying ? 'PAUSE' : 'PLAY'}
              </span>
            </button>
            <button
              onClick={step}
              className="px-2.5 py-1.5 text-xs flex items-center gap-1 hover:bg-paper-2 transition-colors border-r border-rule text-ink"
              title="Step forward 1 minute in time (.)"
              aria-label="Step forward 1 minute"
            >
              <StepForward className="w-3.5 h-3.5 text-ink-2" />
              <span className="font-mono text-[10px] uppercase font-medium">STEP</span>
            </button>
            <button
              onClick={restart}
              className="px-2.5 py-1.5 text-xs hover:bg-paper-2 transition-colors text-ink-3 hover:text-ink"
              title="Reset simulation to T+00:00"
              aria-label="Reset Simulation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed Selector Segment */}
          <div
            className="flex items-center border border-rule bg-paper text-[10px] font-mono shadow-2xs"
            title="Playback Speed Multiplier"
          >
            <span className="px-1.5 text-[9px] text-ink-3 border-r border-rule/60 hidden sm:inline">SPEED:</span>
            {[1, 5, 20, 60].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 border-r border-rule last:border-r-0 transition-colors ${
                  speed === s
                    ? 'bg-ink text-surface font-bold'
                    : 'text-ink-2 hover:bg-paper-2'
                }`}
                aria-label={`${s}x speed`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
