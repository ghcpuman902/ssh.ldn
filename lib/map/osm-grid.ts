import { LONDON_BOUNDS } from "@/lib/map/config"

/** ~4.4 km lat × ~2.8 km lng at 51.5°N — balances Overpass load vs coverage. */
export const OSM_GRID_CELL_DEG = 0.04

export type OsmGridCell = {
  row: number
  col: number
  west: number
  south: number
  east: number
  north: number
}

export type LngLatBox = {
  west: number
  south: number
  east: number
  north: number
}

const londonBox = (): LngLatBox => {
  const [[west, south], [east, north]] = LONDON_BOUNDS as [
    [number, number],
    [number, number],
  ]
  return { west, south, east, north }
}

export const osmGridCellKey = (row: number, col: number) => `${row}:${col}`

export const osmGridCellBbox = (row: number, col: number): OsmGridCell => {
  const { west, south } = londonBox()
  const cellWest = west + col * OSM_GRID_CELL_DEG
  const cellSouth = south + row * OSM_GRID_CELL_DEG

  return {
    row,
    col,
    west: cellWest,
    south: cellSouth,
    east: cellWest + OSM_GRID_CELL_DEG,
    north: cellSouth + OSM_GRID_CELL_DEG,
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** Grid cells intersecting a viewport bbox, clipped to Greater London / M25 bounds. */
export const osmGridCellsForViewport = (viewport: LngLatBox): OsmGridCell[] => {
  const london = londonBox()

  const west = clamp(viewport.west, london.west, london.east)
  const east = clamp(viewport.east, london.west, london.east)
  const south = clamp(viewport.south, london.south, london.north)
  const north = clamp(viewport.north, london.south, london.north)

  if (west >= east || south >= north) {
    return []
  }

  const minCol = Math.floor((west - london.west) / OSM_GRID_CELL_DEG)
  const maxCol = Math.floor((east - london.west) / OSM_GRID_CELL_DEG)
  const minRow = Math.floor((south - london.south) / OSM_GRID_CELL_DEG)
  const maxRow = Math.floor((north - london.south) / OSM_GRID_CELL_DEG)

  const cells: OsmGridCell[] = []

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      cells.push(osmGridCellBbox(row, col))
    }
  }

  return cells
}

const cellCenter = (cell: OsmGridCell) => ({
  lng: (cell.west + cell.east) / 2,
  lat: (cell.south + cell.north) / 2,
})

const squaredDistance = (
  left: { lat: number; lng: number },
  right: { lat: number; lng: number }
) => {
  const lngScale = Math.cos(((left.lat + right.lat) / 2 / 180) * Math.PI)
  const dLng = (left.lng - right.lng) * lngScale
  const dLat = left.lat - right.lat
  return dLng * dLng + dLat * dLat
}

/**
 * Blender-style tile prioritisation: start at the viewport center, then spiral
 * outward. A smaller Central London bias keeps the densest POI cells early when
 * the user is zoomed out across the whole M25 box.
 */
export const prioritizeOsmGridCells = (
  cells: OsmGridCell[],
  viewportCenter: { latitude: number; longitude: number },
  londonCenter: { latitude: number; longitude: number }
) =>
  [...cells].sort((left, right) => {
    const leftCenter = cellCenter(left)
    const rightCenter = cellCenter(right)
    const viewport = {
      lat: viewportCenter.latitude,
      lng: viewportCenter.longitude,
    }
    const london = { lat: londonCenter.latitude, lng: londonCenter.longitude }
    const leftScore =
      squaredDistance(leftCenter, viewport) +
      squaredDistance(leftCenter, london) * 0.28
    const rightScore =
      squaredDistance(rightCenter, viewport) +
      squaredDistance(rightCenter, london) * 0.28

    return leftScore - rightScore
  })

/** Cap concurrent Overpass fetches when zoomed out over wide areas. */
export const osmGridFetchLimitForZoom = (zoom: number) => {
  if (zoom >= 14) return 6
  if (zoom >= 12) return 4
  if (zoom >= 10) return 3
  return 2
}
