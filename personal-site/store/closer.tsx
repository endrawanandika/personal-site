import { create } from 'zustand'

interface CloserState {
  closer: () => void,
  setCloser: (f: ()=>void) => void,
}

export const useCloserStore = create<CloserState>((set) => ({
  closer: () => {},
  setCloser: (f) => set(() => ({ closer: f })),
}))
