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

/** What an import actually did, so it can never fail silently. */
export type ImportSummary = {
  added: number
  unplaced: number
  failed: number
  quotaHit: boolean
  firstError: string | null
}

type AtlasStore = {
  atlas: WorldAtlas | null
  atlasError: string | null
  view: ViewMode
  /** Highlighted on the globe. Selecting never navigates on its own. */
  selectedRegion: string | null
  /** The region page currently open, opened from the sidebar. */
  openRegionId: string | null
  /** When set, the next globe click places this photo instead of selecting. */
  assigningPhotoId: string | null
  importState: ImportState
  importSummary: ImportSummary | null
  init: () => Promise<void>
  setView: (view: ViewMode) => void
  selectRegion: (regionId: string | null) => void
  openRegion: (regionId: string) => void
  closeRegion: () => void
  setAssigning: (photoId: string | null) => void
  setImportState: (patch: Partial<ImportState>) => void
  setImportSummary: (summary: ImportSummary | null) => void
}

const idleImport: ImportState = { active: false, done: 0, total: 0, fileName: '', unplaced: 0 }

export const useAtlasStore = create<AtlasStore>((set, get) => ({
  atlas: null,
  atlasError: null,
  view: 'atlas',
  selectedRegion: null,
  openRegionId: null,
  assigningPhotoId: null,
  importState: idleImport,
  importSummary: null,

  init: async () => {
    if (get().atlas) return
    try {
      set({ atlas: await loadAtlas(), atlasError: null })
    } catch (err) {
      set({ atlasError: err instanceof Error ? err.message : 'Could not load the map.' })
    }
  },

  setView: (view) =>
    set({ view, selectedRegion: null, openRegionId: null, assigningPhotoId: null }),
  selectRegion: (selectedRegion) => set({ selectedRegion }),
  openRegion: (regionId) => set({ openRegionId: regionId, selectedRegion: regionId }),
  closeRegion: () => set({ openRegionId: null }),
  setAssigning: (assigningPhotoId) => set({ assigningPhotoId, openRegionId: null }),
  setImportState: (patch) => set((s) => ({ importState: { ...s.importState, ...patch } })),
  setImportSummary: (importSummary) => set({ importSummary }),
}))
