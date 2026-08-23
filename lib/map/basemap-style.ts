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

/** Insert noise/POI layers before this id so labels stay on top. */
export const BASEMAP_LABELS_LAYER_ID = "basemap-labels"

/** OpenFreeMap glyph stack — custom symbol layers must use this or MapLibre 404s Open Sans. */
export const BASEMAP_TEXT_FONT = ["Noto Sans Regular"] as const

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

const DARK = {
  label: "#e4e4e7",
  labelMuted: "#d4d4d8",
  halo: "rgba(0,0,0,0.82)",
  majorCasing: "rgba(118,118,122,0.95)",
  motorwayCasing: "rgba(130,130,134,0.95)",
  majorSubtle: "#3f3f46",
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

const applyDarkReadability = (style: StyleSpecification) => {
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
      paint: {
        "text-color": DARK.label,
        "text-halo-color": DARK.halo,
        "text-halo-width": 1.7,
      },
    })
  }

  patchLayer(style, "place_city", { maxzoom: 11 })
  patchLayer(style, "place_city_large", { maxzoom: 11 })

  patchLayer(style, "highway_name_other", {
    layout: { "text-transform": "none" },
    paint: {
      "text-color": DARK.labelMuted,
      "text-halo-color": DARK.halo,
      "text-halo-width": 1.5,
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
