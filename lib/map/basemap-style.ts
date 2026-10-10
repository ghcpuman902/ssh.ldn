import type {
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl"

import darkMatterStyle from "@/lib/map/styles/openfreemap-dark.json"
import positronStyle from "@/lib/map/styles/openfreemap-positron.json"

export type MapTheme = "light" | "dark"

/** Insert above-ground rail before this id so it stays under noise rasters. */
export const RAIL_UNDERLAY_SLOT_ID = "rail-underlay-slot"

/** Insert noise/POI rasters before this id so they stay under transit overlays. */
export const NOISE_OVERLAY_SLOT_ID = "noise-overlay-slot"

/** Insert green layers before this id so they stay under coloured transit. */
export const TRANSIT_OVERLAY_SLOT_ID = "transit-overlay-slot"

/** Insert transit lines before this id so station dots paint above the tracks. */
export const STATION_OVERLAY_SLOT_ID = "station-overlay-slot"

/** Insert noise/POI layers before this id so labels stay on top. */
export const BASEMAP_LABELS_LAYER_ID = "basemap-labels"

/** OpenFreeMap glyph stack — custom symbol layers must use this or MapLibre 404s Open Sans. */
export const BASEMAP_TEXT_FONT = ["Noto Sans Regular"] as const

/** Style diffing ignores metadata, so this tag survives a lighting swap. */
const BASEMAP_THEME_METADATA_KEY = "ssh-ldn:basemap-theme"

type LayerPatch = {
  minzoom?: number
  maxzoom?: number
  layout?: Record<string, unknown>
  paint?: Record<string, unknown>
}

const LIGHT = {
  label: "#3f3f46",
  labelMuted: "#52525b",
  halo: "rgba(255,255,255,0.94)",
  majorCasing: "rgb(158,158,164)",
  motorwayCasing: "rgb(148,148,156)",
  majorSubtle: "rgb(170,170,176)",
} as const

/**
 * Night is "London from a plane", but one you can still navigate: a dark
 * ground with a visibly blue river, faint green parks and dim grey streets,
 * so the noise reads as light without losing where you are. Labels are
 * near-white on a dark halo so they read over the glow.
 */
const DARK = {
  background: "#0a0c11",
  water: "#1c4672",
  waterway: "#245585",
  waterLabel: "#9cc8f0",
  park: "#163626",
  wood: "#143022",
  building: "#11131a",
  path: "#1c1f27",
  minor: "#252933",
  majorInner: "#1d2029",
  rail: "#3a3e4a",
  label: "#f4f4f5",
  labelMuted: "#e4e4e7",
  halo: "rgba(0,0,0,0.92)",
  majorCasing: "rgba(98,104,118,0.9)",
  motorwayCasing: "rgba(112,118,132,0.92)",
  majorSubtle: "#30333c",
} as const

const slotLayer = (id: string): LayerSpecification => ({
  id,
  type: "background",
  paint: { "background-opacity": 0 },
})

const patchLayer = (
  style: StyleSpecification,
  id: string,
  next: LayerPatch
) => {
  const layer = style.layers.find((item) => item.id === id)
  if (!layer) return

  if (next.minzoom !== undefined) layer.minzoom = next.minzoom
  if (next.maxzoom !== undefined) layer.maxzoom = next.maxzoom
  if (next.layout) {
    layer.layout = { ...layer.layout, ...next.layout }
  }
  if (next.paint) {
    layer.paint = { ...layer.paint, ...next.paint }
  }
}

const insertOverlaySlots = (style: StyleSpecification) => {
  const geometry = style.layers.filter((layer) => layer.type !== "symbol")
  const labels = style.layers.filter((layer) => layer.type === "symbol")

  style.layers = [
    ...geometry,
    slotLayer(RAIL_UNDERLAY_SLOT_ID),
    slotLayer(NOISE_OVERLAY_SLOT_ID),
    slotLayer(TRANSIT_OVERLAY_SLOT_ID),
    slotLayer(STATION_OVERLAY_SLOT_ID),
    slotLayer(BASEMAP_LABELS_LAYER_ID),
    ...labels,
  ]
}

const applyLightReadability = (style: StyleSpecification) => {
  patchLayer(style, "highway_major_casing", {
    paint: {
      "line-color": LIGHT.majorCasing,
      "line-width": [
        "interpolate",
        ["exponential", 1.3],
        ["zoom"],
        10,
        3.8,
        20,
        26,
      ],
    },
  })

  for (const id of [
    "highway_motorway_casing",
    "tunnel_motorway_casing",
    "highway_motorway_bridge_casing",
  ]) {
    patchLayer(style, id, {
      paint: { "line-color": LIGHT.motorwayCasing },
    })
  }

  patchLayer(style, "highway_major_subtle", {
    paint: {
      "line-color": LIGHT.majorSubtle,
      "line-width": 2.6,
    },
  })

  patchLayer(style, "label_other", {
    minzoom: 10,
    maxzoom: 16,
    layout: {
      "text-font": [...BASEMAP_TEXT_FONT],
      "text-transform": "none",
      "text-letter-spacing": 0.02,
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        11,
        13,
        13,
        15,
        14,
      ],
    },
    paint: {
      "text-color": LIGHT.label,
      "text-halo-color": LIGHT.halo,
      "text-halo-width": 1.8,
      "text-halo-blur": 0.6,
    },
  })

  patchLayer(style, "label_town", {
    layout: {
      "text-transform": "none",
      "text-size": ["interpolate", ["exponential", 1.2], ["zoom"], 7, 12, 12, 15],
    },
    paint: {
      "text-color": LIGHT.label,
      "text-halo-color": LIGHT.halo,
      "text-halo-width": 1.6,
    },
  })

  patchLayer(style, "label_village", {
    layout: { "text-transform": "none" },
    paint: {
      "text-color": LIGHT.label,
      "text-halo-color": LIGHT.halo,
      "text-halo-width": 1.6,
    },
  })

  patchLayer(style, "label_city", { maxzoom: 11 })
  patchLayer(style, "label_city_capital", { maxzoom: 11 })

  patchLayer(style, "highway-name-major", {
    paint: {
      "text-color": LIGHT.label,
      "text-halo-color": LIGHT.halo,
      "text-halo-width": 1.7,
      "text-halo-blur": 0.4,
    },
  })

  patchLayer(style, "highway-name-minor", {
    minzoom: 14.5,
    paint: {
      "text-color": LIGHT.labelMuted,
      "text-halo-color": LIGHT.halo,
      "text-halo-width": 1.5,
    },
  })

  patchLayer(style, "airport", {
    paint: {
      "text-color": LIGHT.labelMuted,
      "text-halo-color": LIGHT.halo,
      "text-halo-width": 1.5,
    },
  })
}

const DARK_LABEL_PAINT = {
  "text-color": DARK.label,
  "text-halo-color": DARK.halo,
  "text-halo-width": 1.8,
  "text-halo-blur": 0.4,
}

const applyDarkReadability = (style: StyleSpecification) => {
  patchLayer(style, "background", {
    paint: { "background-color": DARK.background },
  })
  patchLayer(style, "water", { paint: { "fill-color": DARK.water } })
  patchLayer(style, "waterway", { paint: { "line-color": DARK.waterway } })
  patchLayer(style, "landuse_park", { paint: { "fill-color": DARK.park } })
  patchLayer(style, "landcover_wood", { paint: { "fill-color": DARK.wood } })
  patchLayer(style, "building", {
    paint: {
      "fill-color": DARK.building,
      "fill-outline-color": DARK.background,
    },
  })

  patchLayer(style, "highway_path", { paint: { "line-color": DARK.path } })
  patchLayer(style, "highway_minor", { paint: { "line-color": DARK.minor } })
  patchLayer(style, "highway_major_inner", {
    paint: { "line-color": DARK.majorInner },
  })
  for (const id of ["railway_transit", "railway_minor", "railway"]) {
    patchLayer(style, id, { paint: { "line-color": DARK.rail } })
  }

  patchLayer(style, "highway_major_casing", {
    paint: {
      "line-color": DARK.majorCasing,
      "line-width": [
        "interpolate",
        ["exponential", 1.3],
        ["zoom"],
        10,
        3.8,
        20,
        26,
      ],
    },
  })

  patchLayer(style, "highway_motorway_casing", {
    paint: {
      "line-color": DARK.motorwayCasing,
    },
  })

  patchLayer(style, "highway_major_subtle", {
    paint: {
      "line-color": DARK.majorSubtle,
      "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0, 8, 2.6],
    },
  })

  for (const id of ["place_suburb", "place_other", "place_town", "place_village"]) {
    patchLayer(style, id, {
      maxzoom: 16,
      layout: {
        "text-transform": "none",
        "text-offset": [0, 0],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          11,
          13,
          13,
          15,
          14,
        ],
      },
      paint: DARK_LABEL_PAINT,
    })
  }

  for (const id of ["place_city", "place_city_large"]) {
    patchLayer(style, id, { maxzoom: 11, paint: DARK_LABEL_PAINT })
  }

  for (const id of ["highway_name_other", "highway_name_motorway"]) {
    patchLayer(style, id, {
      layout: { "text-transform": "none" },
      paint: {
        ...DARK_LABEL_PAINT,
        "text-color": DARK.labelMuted,
        "text-halo-width": 1.6,
      },
    })
  }

  patchLayer(style, "water_name", {
    paint: {
      ...DARK_LABEL_PAINT,
      "text-color": DARK.waterLabel,
    },
  })
}

const createBasemapStyle = (
  base: StyleSpecification,
  theme: MapTheme
): StyleSpecification => {
  const style = structuredClone(base)

  if (theme === "light") applyLightReadability(style)
  else applyDarkReadability(style)

  const openmaptiles = style.sources.openmaptiles
  if (openmaptiles && openmaptiles.type === "vector") {
    openmaptiles.attribution =
      "© OpenStreetMap contributors · © OpenFreeMap"
  }

  insertOverlaySlots(style)
  style.metadata = {
    ...(style.metadata as Record<string, unknown> | undefined),
    [BASEMAP_THEME_METADATA_KEY]: theme,
  }
  return style
}

export const MAP_TILE_STYLES = {
  light: createBasemapStyle(
    positronStyle as StyleSpecification,
    "light"
  ),
  dark: createBasemapStyle(
    darkMatterStyle as StyleSpecification,
    "dark"
  ),
} as const

export const getMapStyle = (theme: MapTheme = "light") => MAP_TILE_STYLES[theme]

export const getBasemapTheme = (
  style: StyleSpecification | undefined
): MapTheme | null => {
  const theme = (style?.metadata as Record<string, unknown> | undefined)?.[
    BASEMAP_THEME_METADATA_KEY
  ]
  return theme === "light" || theme === "dark" ? theme : null
}

const BASEMAP_LAYER_IDS = new Set(
  [...MAP_TILE_STYLES.light.layers, ...MAP_TILE_STYLES.dark.layers].map(
    (layer) => layer.id
  )
)

const BASEMAP_SOURCE_IDS = new Set([
  ...Object.keys(MAP_TILE_STYLES.light.sources),
  ...Object.keys(MAP_TILE_STYLES.dark.sources),
])

/**
 * `transformStyle` for a diffed basemap swap. Keeps every noise / transit
 * layer and source the app added at runtime, anchored before the same slot
 * layer, so MapLibre only re-paints the basemap instead of tearing down and
 * re-fetching the overlays.
 */
export const carryOverOverlays = (
  previous: StyleSpecification | undefined,
  next: StyleSpecification
): StyleSpecification => {
  if (!previous) return next

  const nextIds = new Set(next.layers.map((layer) => layer.id))
  const insertBefore = new Map<string, LayerSpecification[]>()
  let pending: LayerSpecification[] = []

  for (const layer of previous.layers) {
    if (!BASEMAP_LAYER_IDS.has(layer.id)) {
      pending.push(layer)
      continue
    }
    // Only anchor on layers the next style keeps (the slots always are).
    if (pending.length === 0 || !nextIds.has(layer.id)) continue

    insertBefore.set(layer.id, [
      ...(insertBefore.get(layer.id) ?? []),
      ...pending,
    ])
    pending = []
  }

  const layers: LayerSpecification[] = []
  for (const layer of next.layers) {
    const overlays = insertBefore.get(layer.id)
    if (overlays) layers.push(...overlays)
    layers.push(layer)
  }
  layers.push(...pending)

  const sources = { ...next.sources }
  for (const [id, source] of Object.entries(previous.sources)) {
    if (!BASEMAP_SOURCE_IDS.has(id)) sources[id] = source
  }

  return { ...next, sources, layers }
}
