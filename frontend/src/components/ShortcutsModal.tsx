import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { X } from 'lucide-react';

export const ShortcutsModal: React.FC = () => {
  const { isShortcutsOpen, setShortcutsOpen } = useAppStore();

  if (!isShortcutsOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Toggle Play / Pause simulation' },
    { key: '.', desc: 'Step forward 1 simulated minute' },
    { key: 'J / K', desc: 'Scrub backwards / forwards in time' },
    { key: '1', desc: 'Confirm officer action: WATCH' },
    { key: '2', desc: 'Confirm officer action: PREPARE' },
    { key: '3', desc: 'Confirm officer action: ALERT' },
    { key: '4', desc: 'Confirm officer action: ESCALATE' },
    { key: 'M', desc: 'Toggle Meridian cartography schematic map' },
    { key: 'Cmd / Ctrl + K', desc: 'Open Command Palette' },
    { key: '?', desc: 'Show / hide this shortcuts reference' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[1px] select-none p-4">
      <div className="w-full max-w-md bg-surface border border-rule shadow-md p-4">
        <div className="flex justify-between items-center border-b border-rule pb-2 mb-3">
          <span className="font-serif font-bold text-sm text-ink uppercase tracking-wide">
            OPERATIONAL KEYBOARD SHORTCUTS
          </span>
          <button
            onClick={() => setShortcutsOpen(false)}
            className="text-ink-3 hover:text-ink"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-xs font-mono">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center py-1 border-b border-rule/30 last:border-b-0"
            >
              <kbd className="px-2 py-0.5 bg-paper-2 border border-rule text-ink font-bold text-[10px]">
                {s.key}
              </kbd>
              <span className="text-ink-2 font-sans">{s.desc}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-2 border-t border-rule text-right">
          <button
            onClick={() => setShortcutsOpen(false)}
            className="px-3 py-1 bg-ink text-surface font-mono text-xs hover:bg-ink-2 transition-colors"
          >
            CLOSE [ESC]
          </button>
        </div>
      </div>
    </div>
  );
};
