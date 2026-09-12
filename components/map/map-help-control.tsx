"use client"

import { useEffect, type RefObject } from "react"
import type { IControl } from "maplibre-gl"
import type { MapRef } from "react-map-gl/maplibre"

const HELP_ICON = `<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>`

class MapHelpButtonControl implements IControl {
  private container: HTMLDivElement | undefined
  private button: HTMLButtonElement | undefined

  constructor(private readonly onOpen: () => void) {}

  onAdd() {
    const container = document.createElement("div")
    container.className = "maplibregl-ctrl maplibregl-ctrl-group"

    const button = document.createElement("button")
    button.type = "button"
    button.className = "maplibregl-ctrl-help"
    button.setAttribute("aria-label", "About map controls")
    button.setAttribute("aria-haspopup", "dialog")
    button.innerHTML = HELP_ICON
    button.addEventListener("click", this.onOpen)

    container.appendChild(button)
    this.container = container
    this.button = button
    return container
  }

  onRemove() {
    this.button?.removeEventListener("click", this.onOpen)
    this.container?.remove()
    this.container = undefined
    this.button = undefined
  }
}

type MapHelpControlProps = {
  mapRef: RefObject<MapRef | null>
  enabled: boolean
  onOpen: () => void
}

export const MapHelpControl = ({
  mapRef,
  enabled,
  onOpen,
}: MapHelpControlProps) => {
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !enabled) return

    const control = new MapHelpButtonControl(onOpen)
    map.addControl(control, "bottom-left")

    return () => {
      map.removeControl(control)
    }
  }, [enabled, mapRef, onOpen])

  return null
}
