import { create } from 'zustand'
import { loadAtlas, type WorldAtlas } from '../lib/geo'

export type ViewMode = 'atlas' | 'plan' | 'memories'

export type ImportState = {
  active: boolean
  done: number
  total: number
  fileName: string
  /** Files from this run that landed in the unplaced tray. */
  unplaced: number
}

type AtlasStore = {
  atlas: WorldAtlas | null
  atlasError: string | null
  view: ViewMode
  selectedRegion: string | null
  /** When set, the next globe click places this photo instead of opening a page. */
  assigningPhotoId: string | null
  importState: ImportState
  init: () => Promise<void>
  setView: (view: ViewMode) => void
  selectRegion: (regionId: string | null) => void
  setAssigning: (photoId: string | null) => void
  setImportState: (patch: Partial<ImportState>) => void
}

const idleImport: ImportState = { active: false, done: 0, total: 0, fileName: '', unplaced: 0 }

export const useAtlasStore = create<AtlasStore>((set, get) => ({
  atlas: null,
  atlasError: null,
  view: 'atlas',
  selectedRegion: null,
  assigningPhotoId: null,
  importState: idleImport,

  init: async () => {
    if (get().atlas) return
    try {
      set({ atlas: await loadAtlas(), atlasError: null })
    } catch (err) {
      set({ atlasError: err instanceof Error ? err.message : 'Could not load the map.' })
    }
  },

  setView: (view) => set({ view, selectedRegion: null, assigningPhotoId: null }),
  selectRegion: (selectedRegion) => set({ selectedRegion }),
  setAssigning: (assigningPhotoId) => set({ assigningPhotoId, selectedRegion: null }),
  setImportState: (patch) => set((s) => ({ importState: { ...s.importState, ...patch } })),
}))
