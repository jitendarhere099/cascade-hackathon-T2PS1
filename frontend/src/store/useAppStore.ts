import { create } from 'zustand';
import { clientInstance } from '../api/client';
import { DEFAULT_COSTS } from '../api/mockEngine';
import type { Action, BeliefUpdate, CostModelConfig } from '../types';

export type NavTab =
  | 'command'
  | 'twins'
  | 'causal'
  | 'sources'
  | 'scoreboard'
  | 'stress'
  | 'report';

interface AppState {
  scenario: string;
  variant: string;
  seed: number;
  isPlaying: boolean;
  speed: number;
  activeTab: NavTab;
  currentBelief: BeliefUpdate | null;
  history: BeliefUpdate[];
  officerDecisions: Record<number, Action>;
  costs: CostModelConfig;
  isCostModalOpen: boolean;
  isCommandPaletteOpen: boolean;
  isTourOpen: boolean;
  isShortcutsOpen: boolean;

  // Actions
  init: () => Promise<void>;
  setScenario: (scen: string, variant?: string) => Promise<void>;
  setVariant: (variant: string) => Promise<void>;
  setSeed: (seed: number) => Promise<void>;
  play: () => void;
  pause: () => void;
  step: () => void;
  setSpeed: (speed: number) => void;
  seek: (t: number) => void;
  logOfficerDecision: (action: Action) => Promise<void>;
  updateCosts: (costs: Partial<CostModelConfig>) => void;
  injectFault: (type: string, target?: string) => Promise<void>;
  setActiveTab: (tab: NavTab) => void;
  setCostModalOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setTourOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  restart: () => Promise<void>;
}

const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const initialTab = (urlParams?.get('tab') as NavTab) || 'command';
const initialScenario = urlParams?.get('scenario') || 'tuesday_evening';
const initialVariant = urlParams?.get('variant') || 'cascade';
const initialSeed = Number(urlParams?.get('seed')) || 42;

export const useAppStore = create<AppState>((set, get) => ({
  scenario: initialScenario,
  variant: initialVariant,
  seed: initialSeed,
  isPlaying: false,
  speed: 1.0,
  activeTab: initialTab,
  currentBelief: null,
  history: [],
  officerDecisions: {},
  costs: DEFAULT_COSTS,
  isCostModalOpen: false,
  isCommandPaletteOpen: false,
  isTourOpen: false,
  isShortcutsOpen: false,

  init: async () => {
    const { scenario, variant, seed } = get();
    await clientInstance.initEpisode(scenario, variant, seed);
    clientInstance.connect((update: BeliefUpdate) => {
      set((state) => {
        const nextHist = [...state.history.filter((h) => h.t < update.t), update];
        return {
          currentBelief: update,
          history: nextHist,
        };
      });
    });
  },

  setScenario: async (scenario: string, variant: string = 'cascade') => {
    set({ scenario, variant, isPlaying: false, history: [] });
    await get().init();
  },

  setVariant: async (variant: string) => {
    set({ variant, isPlaying: false, history: [] });
    await get().init();
  },

  setSeed: async (seed: number) => {
    set({ seed, isPlaying: false, history: [] });
    await get().init();
  },

  play: () => {
    set({ isPlaying: true });
    clientInstance.play();
  },

  pause: () => {
    set({ isPlaying: false });
    clientInstance.pause();
  },

  step: () => {
    set({ isPlaying: false });
    clientInstance.step();
  },

  setSpeed: (speed: number) => {
    set({ speed });
    clientInstance.setSpeed(speed);
  },

  seek: (t: number) => {
    set({ isPlaying: false });
    clientInstance.seek(t);
  },

  logOfficerDecision: async (action: Action) => {
    const { currentBelief } = get();
    if (!currentBelief) return;
    const t = currentBelief.t;
    set((state) => ({
      officerDecisions: { ...state.officerDecisions, [t]: action },
      currentBelief: { ...currentBelief, officer_action: action },
    }));
    await clientInstance.logOfficerDecision(t, action);
  },

  updateCosts: (newCosts: Partial<CostModelConfig>) => {
    set((state) => ({
      costs: { ...state.costs, ...newCosts },
    }));
  },

  injectFault: async (type: string, target?: string) => {
    await clientInstance.injectFault(type, target);
  },

  setActiveTab: (tab: NavTab) => set({ activeTab: tab }),
  setCostModalOpen: (open: boolean) => set({ isCostModalOpen: open }),
  setCommandPaletteOpen: (open: boolean) => set({ isCommandPaletteOpen: open }),
  setTourOpen: (open: boolean) => set({ isTourOpen: open }),
  setShortcutsOpen: (open: boolean) => set({ isShortcutsOpen: open }),

  restart: async () => {
    set({ isPlaying: false, history: [], officerDecisions: {} });
    await get().init();
  },
}));
