import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Streamgraph } from '../charts/Streamgraph';
import { DecisionGeometry } from '../charts/DecisionGeometry';
import { ForesightRangeBars } from '../charts/ForesightRangeBars';
import { WaterfallAttribution } from '../charts/WaterfallAttribution';
import { MeridianMap } from '../charts/MeridianMap';
import type { Action, Hypothesis, Channel, EventItem } from '../types';
import {
  Map,
  CheckCircle2,
  Radio,
  AlertTriangle,
  MapPin,
  Flame,
  Siren,
  Eye,
  ShieldCheck,
  BellRing,
  Activity,
  CloudRain,
  Droplets,
  Car,
  Hospital,
  Zap,
  PhoneCall,
  Users,
  MessageSquare,
  Camera,
  Cpu,
  Info,
  BrainCircuit,
  Megaphone,
  Clock,
} from 'lucide-react';

interface HypothesisMeta {
  name: string;
  short: string;
  code: string;
  colorHex: string;
  borderClass: string;
  bgLightClass: string;
  textClass: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const HYPOTHESIS_META: Record<Hypothesis, HypothesisMeta> = {
  NOISE: {
    name: 'NOISE',
    short: 'Noise',
    code: 'H0',
    colorHex: '#8A8574',
    borderClass: 'border-hyp-noise',
    bgLightClass: 'bg-paper-2',
    textClass: 'text-hyp-noise',
    icon: Radio,
    description: 'Background sensor fluctuation, rain runoff, or uncoordinated transient anomalies.',
  },
  SENSOR_FAILURE: {
    name: 'SENSOR FAILURE',
    short: 'Sensor Fail',
    code: 'H1',
    colorHex: '#B7791F',
    borderClass: 'border-hyp-sensor',
    bgLightClass: 'bg-amber-50',
    textClass: 'text-hyp-sensor',
    icon: AlertTriangle,
    description: 'Common-cause gateway telemetry dropout or stuck instrumentation float switches.',
  },
  ISOLATED: {
    name: 'ISOLATED INCIDENT',
    short: 'Isolated',
    code: 'H2',
    colorHex: '#1F6F8B',
    borderClass: 'border-hyp-isolated',
    bgLightClass: 'bg-sky-50',
    textClass: 'text-hyp-isolated',
    icon: MapPin,
    description: 'Localized flooding or district-confined incident that does not spread across municipal sectors.',
  },
  CASCADE: {
    name: 'CASCADING CRISIS',
    short: 'Cascade',
    code: 'H3',
    colorHex: '#D9421C',
    borderClass: 'border-hyp-cascade',
    bgLightClass: 'bg-red-50',
    textClass: 'text-hyp-cascade',
    icon: Flame,
    description: 'Multi-district systemic failure chain: drainage overflow causing traffic gridlock, hospital diversion, and power disruption.',
  },
};

interface ActionMeta {
  label: string;
  subtitle: string;
  bg: string;
  text: string;
  border: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ACTION_CONFIG: Record<Action, ActionMeta> = {
  WATCH: {
    label: 'WATCH',
    subtitle: 'Passive Monitoring · Baseline Telemetry',
    bg: 'bg-paper-2',
    text: 'text-ink-2',
    border: 'border-rule',
    accent: 'bg-ink-3',
    icon: Eye,
  },
  PREPARE: {
    label: 'PREPARE',
    subtitle: 'Pre-Position Resources · Standby Alert',
    bg: 'bg-amber-50',
    text: 'text-amber-950',
    border: 'border-amber-400',
    accent: 'bg-amber-600',
    icon: ShieldCheck,
  },
  ALERT: {
    label: 'ALERT',
    subtitle: 'Public Notification · Traffic Diversion',
    bg: 'bg-orange-50',
    text: 'text-orange-950',
    border: 'border-orange-500',
    accent: 'bg-orange-600',
    icon: BellRing,
  },
  ESCALATE: {
    label: 'ESCALATE',
    subtitle: 'Full Multi-Agency Incident Mobilization',
    bg: 'bg-act-escalate',
    text: 'text-white font-bold',
    border: 'border-red-950',
    accent: 'bg-red-800',
    icon: Siren,
  },
};

// Helper for channel icons
function getChannelIcon(channel: Channel): React.ComponentType<{ className?: string }> {
  switch (channel) {
    case 'drainage_sensor':
      return Droplets;
    case 'traffic_sensor':
      return Car;
    case 'hospital_arrival':
      return Hospital;
    case 'power_grid':
      return Zap;
    case 'emergency_call':
      return PhoneCall;
    case 'citizen_report':
      return Users;
    case 'social_post':
      return MessageSquare;
    case 'camera_flood':
      return Camera;
    case 'heartbeat':
      return Radio;
    default:
      return Cpu;
  }
}

// Channel label formatter
function formatChannelName(channel: Channel): string {
  switch (channel) {
    case 'drainage_sensor':
      return 'DRAINAGE';
    case 'traffic_sensor':
      return 'TRAFFIC';
    case 'hospital_arrival':
      return 'HOSPITAL';
    case 'power_grid':
      return 'POWER';
    case 'emergency_call':
      return '911-DISPATCH';
    case 'citizen_report':
      return 'CITIZEN';
    case 'social_post':
      return 'SOCIAL';
    case 'camera_flood':
      return 'CCTV-OPTIC';
    case 'heartbeat':
      return 'HEARTBEAT';
    default:
      return channel.toUpperCase();
  }
}

export const CommandRoom: React.FC = () => {
  const {
    currentBelief,
    history,
    costs,
    seek,
    logOfficerDecision,
    setCostModalOpen,
  } = useAppStore();

  const [showMap, setShowMap] = useState(true);

  if (!currentBelief) {
    return (
      <div className="p-12 text-center font-mono text-xs text-ink-3">
        <Activity className="w-6 h-6 animate-spin mx-auto mb-3 text-ink-3" />
        INITIALIZING MERIDIAN TELEMETRY ENGINE &amp; PARTICLE FILTER...
      </div>
    );
  }

  const {
    t,
    probs,
    intervals_90,
    action,
    value_of_waiting,
    decision_margin,
    dwell_remaining,
    devils_advocate,
    why_not_escalate,
    mind_change,
    nuisance,
    recent_events = [],
    officer_action,
  } = currentBelief;

  // Determine leading hypothesis
  const leadingHypothesis = (['NOISE', 'SENSOR_FAILURE', 'ISOLATED', 'CASCADE'] as Hypothesis[]).reduce(
    (prev, cur) => (probs[cur] > probs[prev] ? cur : prev),
    'NOISE' as Hypothesis
  );

  return (
    <div className="p-4 space-y-4 max-w-[1700px] mx-auto select-none">
      {/* Top Grid: 12 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: 04 Ledger (3 Cols) */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="bg-surface border border-rule p-3.5 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-rule text-[11px] font-mono tracking-wider text-ink-3">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-ink-3" />
                <span>04 · EVENT LEDGER</span>
              </span>
              <span
                className="text-[9px] bg-paper-2 border border-rule px-1.5 py-0.2"
                title="Events sorted strictly by verified physical event occurrence timestamp"
              >
                BITEMPORAL
              </span>
            </div>

            {/* Ledger Audit Counters / Hardware Status Register */}
            <div className="grid grid-cols-4 gap-1 mb-2.5 text-center text-[9px] font-mono bg-paper p-1.5 border border-rule">
              <div title="Fresh packets delivered within latency SLA">
                <span className="text-ink-3 block text-[8px]">FRESH</span>
                <span className="font-bold text-emerald-800">{currentBelief.ledger_stats.fresh}</span>
              </div>
              <div title="Out-of-order late packets rolled back into particle filter">
                <span className="text-ink-3 block text-[8px]">LATE</span>
                <span className="font-bold text-amber-800">{currentBelief.ledger_stats.late}</span>
              </div>
              <div title="Duplicate telemetry events deduplicated with zero added evidence">
                <span className="text-ink-3 block text-[8px]">DEDUP</span>
                <span className="font-bold text-ink-2">{currentBelief.ledger_stats.duplicate}</span>
              </div>
              <div title="Retracted false sensor alarms cleanly neutralized">
                <span className="text-ink-3 block text-[8px]">RETRACT</span>
                <span className="font-bold text-stat-bad">{currentBelief.ledger_stats.retracted}</span>
              </div>
            </div>

            {/* Event List with Visual Source Differentiation */}
            <div className="space-y-1.5 overflow-y-auto max-h-[580px] pr-1">
              {renderRecentEventsList(recent_events)}
            </div>
          </div>
        </div>

        {/* Center Core: 01 Belief & 02 Recommended Action / Decision Geometry (6 Cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* 01 Probabilities Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-surface border border-rule p-3">
            {(['NOISE', 'SENSOR_FAILURE', 'ISOLATED', 'CASCADE'] as Hypothesis[]).map((hyp) => {
              const p = probs[hyp];
              const interval = intervals_90[hyp] || [p, p];
              const meta = HYPOTHESIS_META[hyp];
              const Icon = meta.icon;
              const isLeading = leadingHypothesis === hyp;

              return (
                <div
                  key={hyp}
                  className={`relative p-2.5 border transition-all ${
                    isLeading
                      ? `border-ink bg-paper shadow-2xs`
                      : 'border-rule/60 bg-surface'
                  }`}
                  title={`${meta.name}: ${meta.description}`}
                >
                  {/* Leading Badge Accent */}
                  {isLeading && (
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: meta.colorHex }}
                    />
                  )}

                  {/* Header: Name, Icon, Code */}
                  <div className="flex items-center justify-between text-[10px] font-mono tracking-wider text-ink-3 mb-1">
                    <span className="flex items-center gap-1 font-bold text-ink truncate">
                      <Icon className="w-3 h-3 shrink-0" style={{ color: meta.colorHex }} />
                      <span className="truncate">{meta.short}</span>
                    </span>
                    <span className="text-ink-3 text-[9px] font-mono font-medium">{meta.code}</span>
                  </div>

                  {/* Large Probability Percentage */}
                  <div className="font-serif text-3xl font-bold text-ink tnum my-0.5 leading-none">
                    {(p * 100).toFixed(0)}
                    <span className="text-base font-normal text-ink-3">%</span>
                  </div>

                  {/* Compact Horizontal Probability Bar */}
                  <div className="w-full h-1.5 bg-paper-2 border border-rule/50 my-1 overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${Math.round(p * 100)}%`,
                        backgroundColor: meta.colorHex,
                      }}
                    />
                  </div>

                  {/* 90% Uncertainty Interval */}
                  <div
                    className="text-[8.5px] font-mono text-ink-3 truncate"
                    title="90% Bayesian Credible Interval from particle posterior distribution"
                  >
                    90% CI: [{(interval[0] * 100).toFixed(0)}–{(interval[1] * 100).toFixed(0)}%]
                  </div>
                </div>
              );
            })}
          </div>

          {/* 01 Streamgraph Belief River */}
          <Streamgraph history={history} currentT={t} onSeek={seek} height={210} />

          {/* 02 The Action Directive & Decision Geometry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-surface border border-rule p-4">
            {/* The Action Button Box */}
            <div className="flex flex-col justify-between border-r border-rule/60 pr-3">
              <div>
                <div className="flex justify-between items-center text-[10px] font-mono text-ink-3 mb-2 pb-1.5 border-b border-rule/50">
                  <span className="font-bold text-ink flex items-center gap-1">
                    <Eye className="w-3 h-3 text-ink-3" />
                    <span>02 · RECOMMENDED ACTION</span>
                  </span>
                  {dwell_remaining > 0 && (
                    <span
                      className="text-amber-950 font-bold bg-amber-100 px-1.5 py-0.2 border border-amber-300 text-[9px] flex items-center gap-1"
                      title="Dwell Lock prevents rapid oscillation between action levels under noisy incoming telemetry"
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>DWELL LOCK ({dwell_remaining}m)</span>
                    </span>
                  )}
                </div>

                {/* 4-Step Graduated Response Ladder */}
                <div className="grid grid-cols-4 gap-1 mb-2 text-center text-[8.5px] font-mono border border-rule/60 p-0.5 bg-paper">
                  {(['WATCH', 'PREPARE', 'ALERT', 'ESCALATE'] as Action[]).map((act) => {
                    const isCurrent = action === act;
                    const Icon = ACTION_CONFIG[act].icon;
                    return (
                      <div
                        key={act}
                        className={`py-1 px-0.5 border flex flex-col items-center gap-0.5 transition-all ${
                          isCurrent
                            ? 'bg-ink text-surface font-bold border-ink shadow-2xs'
                            : 'border-transparent text-ink-3'
                        }`}
                      >
                        <Icon className="w-2.5 h-2.5" />
                        <span className="leading-none">{act}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Giant Action Typography Banner */}
                {(() => {
                  const CurrentIcon = ACTION_CONFIG[action].icon;
                  return (
                    <div
                      className={`p-3.5 border text-center transition-all ${
                        ACTION_CONFIG[action].bg
                      } ${ACTION_CONFIG[action].border} ${
                        action === 'ESCALATE' ? 'animate-escalate-pulse ring-1 ring-red-800' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5 text-[9.5px] font-mono uppercase tracking-widest text-ink-3 mb-1">
                        <CurrentIcon className="w-3.5 h-3.5 text-ink-2" />
                        <span>SYSTEM DIRECTIVE</span>
                      </div>
                      <div
                        className={`font-serif text-3xl font-bold tracking-tight uppercase leading-none my-1 ${
                          ACTION_CONFIG[action].text
                        }`}
                      >
                        {action}
                      </div>
                      <div className="text-[10px] font-sans text-ink-2 mt-1">
                        {ACTION_CONFIG[action].subtitle}
                      </div>
                    </div>
                  );
                })()}

                {/* Margins & Waiting values */}
                <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] font-mono bg-paper p-2 border border-rule">
                  <div title="Cost penalty of choosing second-best action over the recommended directive">
                    <span className="text-ink-3 block text-[8px]">DECISION MARGIN:</span>
                    <span className="font-bold text-ink tnum">+{decision_margin.toFixed(2)} cost units</span>
                  </div>
                  <div title="Expected reduction in Bayes risk by waiting 1 minute for additional sensor packets">
                    <span className="text-ink-3 block text-[8px]">VALUE OF WAITING:</span>
                    <span className="font-bold text-ink tnum">{value_of_waiting.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Confirm as Officer Control */}
              <div className="mt-3 pt-2 border-t border-rule/50 flex items-center justify-between">
                <span className="text-[9.5px] font-mono text-ink-3 uppercase">OFFICER OVERRIDE:</span>
                <div className="flex gap-1 text-[10px] font-mono">
                  {(['WATCH', 'PREPARE', 'ALERT', 'ESCALATE'] as Action[]).map((act) => {
                    const isOfficerSelected = officer_action === act;
                    return (
                      <button
                        key={act}
                        onClick={() => logOfficerDecision(act)}
                        title={`Duty officer override to ${act}`}
                        className={`px-2 py-0.5 border text-[9.5px] transition-colors ${
                          isOfficerSelected
                            ? 'bg-ink text-surface font-bold border-ink'
                            : 'border-rule hover:bg-paper-2 text-ink-2'
                        }`}
                      >
                        {act[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Decision Geometry Loss Curves */}
            <DecisionGeometry
              currentP={probs.CASCADE}
              currentAction={action}
              costs={costs}
              fatigue={currentBelief.fatigue}
              currentDelayMin={t}
              onOpenCostModel={() => setCostModalOpen(true)}
              height={175}
            />
          </div>
        </div>

        {/* Right Column: 03 Foresight & 06 Cartography (3 Cols) */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {/* 03 Foresight Range Bars */}
          <ForesightRangeBars
            currentT={t}
            forecasts={currentBelief.forecast}
            nextBestObservation={currentBelief.next_best_observation}
          />

          {/* 06 Map Toggle Panel */}
          <div className="bg-surface border border-rule p-2.5 flex flex-col">
            <div className="flex justify-between items-center mb-1 text-[10px] font-mono text-ink-3 pb-1 border-b border-rule">
              <span className="flex items-center gap-1.5 font-bold text-ink">
                <Map className="w-3.5 h-3.5 text-ink-2" />
                <span>MERIDIAN CARTOGRAPHY</span>
              </span>
              <button
                onClick={() => setShowMap(!showMap)}
                className="text-[9px] uppercase font-mono px-1.5 py-0.2 border border-rule hover:bg-paper-2 text-ink-2"
              >
                {showMap ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            {showMap && (
              <MeridianMap
                currentEvents={recent_events}
                outages={nuisance.gateway_outage}
                epicenterDistrict={probs.ISOLATED > 0.4 ? 'D4' : 'D2'}
                topHypothesis={action === 'ESCALATE' ? 'CASCADE' : 'ISOLATED'}
                height={220}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: 05 Why It Changed Its Mind */}
      <div className="bg-surface border border-rule p-4">
        <div className="flex justify-between items-center mb-3 pb-1.5 border-b border-rule text-[11px] font-mono tracking-wider text-ink-3">
          <span className="font-bold text-ink flex items-center gap-1.5">
            <BrainCircuit className="w-3.5 h-3.5 text-hyp-isolated" />
            <span>05 · EXPLAINABILITY &amp; CAUSAL ATTRIBUTION AUDIT</span>
          </span>
          <span className="text-[10px] bg-paper-2 border border-rule px-2 py-0.2">
            EPISODE REASONING REPORT
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Waterfall Attribution (5 cols) */}
          <div className="lg:col-span-5">
            <WaterfallAttribution items={currentBelief.attribution} />
          </div>

          {/* Mind-Change & Devil's Advocate Narrative (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-3">
            {/* Mind Change Audit Log */}
            <div className="border border-rule/70 p-3 bg-paper/50">
              <div className="text-[10px] font-mono text-ink-3 uppercase mb-1 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-stat-ok" />
                <span className="text-ink font-bold">MIND-CHANGE AUDIT LOG [MINUTE T+{t}]</span>
              </div>
              <p className="font-serif text-sm text-ink leading-relaxed">
                "{mind_change.message}"
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Devil's Advocate */}
              <div className="border border-rule/70 p-3 bg-paper/30">
                <div className="text-[10px] font-mono text-ink-3 uppercase mb-1 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                  <span>DEVIL'S ADVOCATE (STRONGEST COUNTER):</span>
                </div>
                <div className="font-serif font-bold text-ink text-xs mb-1">
                  {devils_advocate.hypothesis} ({(devils_advocate.probability * 100).toFixed(0)}%)
                </div>
                <p className="text-[10.5px] text-ink-2 font-sans italic leading-snug">
                  "{devils_advocate.evidence}"
                </p>
              </div>

              {/* Why Not Escalate */}
              <div className="border border-rule/70 p-3 bg-paper/30">
                <div className="text-[10px] font-mono text-ink-3 uppercase mb-1 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-stat-ok" />
                  <span>WHY NOT ESCALATE THRESHOLD:</span>
                </div>
                <p className="text-[10.5px] text-ink-2 font-sans leading-relaxed">
                  {why_not_escalate}
                </p>
              </div>
            </div>

            {/* Nuisance Factor Gauges */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rule/50 text-[10px] font-mono">
              <span className="text-ink-3 uppercase text-[9px] font-bold">NUISANCE MARGINALS:</span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-paper-2 border border-rule text-ink">
                <CloudRain className="w-3 h-3 text-ink-2" />
                <span>RAIN: {nuisance.rain.toUpperCase()}</span>
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-paper-2 border border-rule text-ink">
                <Activity className="w-3 h-3 text-ink-2" />
                <span>FLU: {(nuisance.flu * 100).toFixed(0)}%</span>
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-paper-2 border border-rule text-ink">
                <Megaphone className="w-3 h-3 text-ink-2" />
                <span>RUMOR: {(nuisance.rumor * 100).toFixed(0)}%</span>
              </span>
              {Object.entries(nuisance.gateway_outage).map(([gw, prob]) => (
                <span
                  key={gw}
                  className={`flex items-center gap-1 px-2 py-0.5 border ${
                    prob > 0.5
                      ? 'bg-red-50 text-stat-bad border-red-300 font-bold'
                      : 'bg-paper-2 border-rule text-ink'
                  }`}
                  title={`Gateway outage posterior probability: ${(prob * 100).toFixed(0)}%`}
                >
                  <Radio className="w-2.5 h-2.5" />
                  <span>{gw}: {(prob * 100).toFixed(0)}%</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Typeset ledger row renderer with clean 1px border and refined category badges
function renderRecentEventsList(events: EventItem[]) {
  if (events.length === 0) {
    return (
      <div className="p-8 text-center font-mono text-xs text-ink-3">
        <Radio className="w-5 h-5 mx-auto mb-2 opacity-40 animate-pulse" />
        Waiting for incoming telemetry packets...
      </div>
    );
  }

  return events.slice(0, 14).map((ev) => {
    const isRetracted = ev.status === 'retracted';
    const isDiscounted = ev.status === 'discounted';
    const ChannelIcon = getChannelIcon(ev.channel);
    const channelLabel = formatChannelName(ev.channel);

    return (
      <div
        key={ev.id}
        className={`p-2 border border-rule/70 bg-paper/50 text-[10px] font-mono flex flex-col gap-1 transition-colors hover:bg-paper ${
          isRetracted ? 'line-through opacity-50 bg-red-50' : ''
        }`}
      >
        {/* Row 1: Source ID & Event Timestamp */}
        <div className="flex justify-between items-baseline">
          <div className="flex items-center gap-1.5 truncate">
            <ChannelIcon className="w-3 h-3 text-ink-2 shrink-0" />
            <span className="font-bold text-ink truncate">{ev.source_id}</span>
          </div>
          <span className="text-[9px] text-ink-3 flex items-center gap-0.5 shrink-0">
            <Clock className="w-2.5 h-2.5" />
            <span>{ev.event_time ? ev.event_time.substring(14, 19) : '00:00'}</span>
          </span>
        </div>

        {/* Row 2: Channel badge & District/Gateway Location */}
        <div className="flex justify-between items-center text-[9px] text-ink-2">
          <span className="px-1.5 py-0.2 bg-paper-2 border border-rule/60 text-[8px] font-semibold">
            {channelLabel}
          </span>
          <span className="text-ink-3 font-medium">
            {ev.district ? `SECTOR ${ev.district}` : ev.gateway_id ? ev.gateway_id : 'MUNICIPAL'}
          </span>
        </div>

        {/* Row 3: Measurement Value & Status Tag */}
        <div className="flex justify-between items-center pt-1 border-t border-rule/30 text-[8.5px]">
          <span className="text-ink-2 font-mono">
            {ev.value !== null ? (
              <span className="font-semibold text-ink">VAL: {ev.value}</span>
            ) : (
              <span className="text-ink-3">HEARTBEAT PING</span>
            )}
          </span>
          <span
            className={`px-1.5 py-0.2 uppercase font-bold text-[7.5px] border ${
              ev.status === 'fresh'
                ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                : ev.status === 'late'
                ? 'bg-amber-100 text-amber-950 border-amber-300'
                : isDiscounted
                ? 'bg-purple-100 text-purple-950 border-purple-300'
                : isRetracted
                ? 'bg-red-100 text-red-950 border-red-300'
                : 'bg-paper-2 text-ink-3 border-rule'
            }`}
          >
            {ev.status}
          </span>
        </div>
      </div>
    );
  });
}
