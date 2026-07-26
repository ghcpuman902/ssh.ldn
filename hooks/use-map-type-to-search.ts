"use client"

import { useEffect, type RefObject } from "react"

import type { MapSearchBarHandle } from "@/components/map/map-search-bar"

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false

  if (target.isContentEditable) return true

  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true

  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
}

type UseMapTypeToSearchOptions = {
  enabled?: boolean
  searchRef: RefObject<MapSearchBarHandle | null>
  onType: (character: string) => void
}

export const useMapTypeToSearch = ({
  enabled = true,
  searchRef,
  onType,
}: UseMapTypeToSearchOptions) => {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key.length !== 1 || !/^[a-zA-Z0-9]$/.test(event.key)) return
      if (isEditableTarget(event.target)) return

      event.preventDefault()
      onType(event.key)
      searchRef.current?.focusInput()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [enabled, onType, searchRef])
}
