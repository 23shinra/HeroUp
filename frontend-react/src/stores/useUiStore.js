import { create } from "zustand";

/** Lightweight UI-only state; toast lives in useGameStore to mirror production. */
export const useUiStore = create((set) => ({
  syncModalOpen: false,
  setSyncModalOpen: (open) => set({ syncModalOpen: open }),
}));
