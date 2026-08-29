import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { DropOverlay } from './components/ImportDropzone'
import { RegionPage } from './components/RegionPage'
import { AtlasView } from './views/AtlasView'
import { MemoriesView } from './views/MemoriesView'
import { PlanView } from './views/PlanView'
import { metaFor } from './lib/countryMeta'
import { useTravelData } from './lib/useTravelData'
import { useAtlasStore } from './store/useAtlas'

const TITLES = { atlas: 'Atlas', plan: 'Plan trips', memories: 'Memories' } as const
const ICONS = { atlas: '🌍', plan: '✈️', memories: '🖼️' } as const

export function App() {
  const { view, init, atlasError, atlas, openRegionId, closeRegion } = useAtlasStore()
  const data = useTravelData()

  useEffect(() => {
    void init()
  }, [init])

  const region = openRegionId && atlas ? atlas.byId(openRegionId) : null

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar data={data} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-4 text-[13px]">
          <button
            onClick={closeRegion}
            className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-text-2 transition-colors hover:bg-bg-hover hover:text-text"
          >
            <span>{ICONS[view]}</span>
            {TITLES[view]}
          </button>
          {region && (
            <>
              <span className="text-text-3">/</span>
              <span className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 font-medium text-text">
                <span>{metaFor(region.countryId).flag}</span>
                {region.name}
              </span>
            </>
          )}
        </header>

        {atlasError && (
          <p className="border-b border-border bg-yellow-bg px-4 py-2 text-[13px] text-text">
            {atlasError}
          </p>
        )}

        <main className="min-h-0 flex-1 overflow-hidden">
          {region ? (
            <RegionPage region={region} place={data.places.get(region.id)} />
          ) : (
            <>
              {view === 'atlas' && <AtlasView data={data} />}
              {view === 'plan' && <PlanView data={data} />}
              {view === 'memories' && <MemoriesView />}
            </>
          )}
        </main>
      </div>

      <DropOverlay />
    </div>
  )
}
