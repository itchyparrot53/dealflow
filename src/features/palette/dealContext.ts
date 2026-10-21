"use client";

import { create } from "zustand";

// The deal whose page is open, for the palette's deal-context commands (6.8). The workspace registers
// it on mount and clears it on unmount, so the commands only appear while a deal is on screen.
export interface PaletteDeal {
  id: string;
  status: string;
}

interface PaletteDealState {
  deal: PaletteDeal | null;
  setDeal: (deal: PaletteDeal | null) => void;
}

export const usePaletteDeal = create<PaletteDealState>((set) => ({
  deal: null,
  setDeal: (deal) => set({ deal }),
}));
