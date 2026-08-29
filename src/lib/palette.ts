/**
 * Canvas needs literal colours, not CSS variables.
 * These mirror the `@theme` block in src/index.css - change both together.
 */
export const PALETTE = {
  ocean: '#f7f7f5',
  land: '#e3e2e0',
  border: '#ffffff',
  borderStrong: '#c9c7c2',
  graticule: '#ececea',
  text: '#37352f',
  accent: '#2383e2',
  yellow: '#dfab01',
  yellowBg: '#fbf3db',
} as const

/**
 * Visited ramp, Notion blue, keyed to photo count.
 *
 * The first step is for somewhere visited with no photos yet, so it has to read
 * clearly against the grey land on its own - seeing where you've been is the
 * whole point. Earlier pale tints were near-invisible next to `land`.
 */
export const VISIT_RAMP = ['#a8d4f0', '#7ec0e8', '#4da3dd', '#2383e2', '#0b6e99'] as const
export const RAMP_THRESHOLDS = [0, 1, 5, 15, 40] as const
