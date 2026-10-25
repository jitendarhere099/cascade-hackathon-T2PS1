import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';

export const GuidedTour: React.FC = () => {
  const { isTourOpen, setTourOpen, setScenario, setVariant, seek } = useAppStore();
  const [step, setStep] = useState(0);

  if (!isTourOpen) return null;

  const steps = [
    {
      title: '01 · The Opening Ambiguity (T+00:00)',
      desc: 'It is a Tuesday evening in Meridian. Rain begins to fall heavier across northern sectors. In these opening minutes, a benign storm and an impending catastrophic cascade look virtually identical.',
      action: () => {
        setScenario('tuesday_evening', 'cascade');
        seek(0);
      },
    },
    {
      title: '02 · The Twin Test & Honest Belief (T+00:07)',
      desc: 'By minute 00:07, drainage sensors register anomalies and emergency lines get busy. Both the benign and cascade variants share literally identical 7-minute prefixes. Notice Firstlight holds P(CASCADE) at ~41% and remains at PREPARE, refusing to emit an overconfident false alarm before the evidence solidifies.',
      action: () => {
        seek(7);
      },
    },
    {
      title: '03 · The Divergence & Decision Geometry (T+00:09)',
      desc: 'At 00:09, two hospitals report triage surges. The Decision Geometry chart reveals the expected cost of inaction escalating exponentially. The value of waiting drops below immediate intervention cost, triggering a stable transition to ALERT.',
      action: () => {
        seek(9);
      },
    },
    {
      title: '04 · Causal Foresight & Structural Chains',
      desc: 'Notice Section 03 Foresight: Firstlight does not merely correlate data—it computes time windows for the next three causal failures (Ambulance Delays, Substation Trip, Gateway Outage) based on an explicit directed graph.',
      action: () => {
        seek(10);
      },
    },
    {
      title: '05 · Exact Attribution & Non-Flip-Flop Stability',
      desc: 'Section 05 breaks down the exact log-odds waterfall contribution of each telemetry cluster. Notice that even as noise fluctuates, hysteresis and minimum dwell times prevent alert flickering (ESCALATE -> WATCH -> ESCALATE).',
      action: () => {
        seek(12);
      },
    },
  ];

  const curr = steps[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      steps[nextStep].action();
    } else {
      setTourOpen(false);
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      const prevStep = step - 1;
      setStep(prevStep);
      steps[prevStep].action();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-surface border-2 border-ink shadow-2xl p-4 select-none">
      <div className="flex justify-between items-center border-b border-rule pb-2 mb-2">
        <span className="font-mono text-[10px] text-ink-3 uppercase font-semibold">
          DUTY OFFICER WALKTHROUGH · STEP {step + 1} OF {steps.length}
        </span>
        <button
          onClick={() => setTourOpen(false)}
          className="text-ink-3 hover:text-ink"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <h3 className="font-serif font-bold text-sm text-ink mb-1.5">{curr.title}</h3>
      <p className="font-sans text-xs text-ink-2 leading-relaxed mb-4">{curr.desc}</p>

      <div className="flex justify-between items-center pt-2 border-t border-rule text-xs font-mono">
        <button
          disabled={step === 0}
          onClick={handlePrev}
          className={`flex items-center gap-1 px-2 py-1 border border-rule ${
            step === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-paper-2 text-ink'
          }`}
        >
          <ArrowLeft className="w-3 h-3" />
          <span>PREV</span>
        </button>

        <div className="flex gap-1">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i === step ? 'bg-ink' : 'bg-rule'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="flex items-center gap-1 px-3 py-1 bg-ink text-surface hover:bg-ink-2 transition-colors font-semibold"
        >
          <span>{step === steps.length - 1 ? 'FINISH' : 'NEXT'}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
