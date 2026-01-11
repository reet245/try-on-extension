import { create } from 'zustand';
import { db, type TryOnResult, getRecentResults, toggleFavorite, deleteResult } from '@/lib/db';

interface HistoryState {
  results: TryOnResult[];
  isLoading: boolean;
  selectedResult: TryOnResult | null;

  // Actions
  loadResults: () => Promise<void>;
  addResult: (result: TryOnResult) => void;
  toggleFavorite: (id: number) => Promise<void>;
  deleteResult: (id: number) => Promise<void>;
  setSelectedResult: (result: TryOnResult | null) => void;
  clearHistory: () => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  results: [],
  isLoading: false,
  selectedResult: null,

  loadResults: async () => {
    set({ isLoading: true });
    try {
      const results = await getRecentResults(50);
      set({ results, isLoading: false });
    } catch (error) {
      console.error('Failed to load results:', error);
      set({ isLoading: false });
    }
  },

  addResult: (result) => {
    set((state) => ({
      results: [result, ...state.results]
    }));
  },

  toggleFavorite: async (id) => {
    await toggleFavorite(id);
    const results = get().results.map((r) =>
      r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
    );
    set({ results });
  },

  deleteResult: async (id) => {
    await deleteResult(id);
    set((state) => ({
      results: state.results.filter((r) => r.id !== id),
      selectedResult: state.selectedResult?.id === id ? null : state.selectedResult
    }));
  },

  setSelectedResult: (result) => set({ selectedResult: result }),

  clearHistory: async () => {
    await db.tryOnResults.clear();
    set({ results: [], selectedResult: null });
  },
}));
