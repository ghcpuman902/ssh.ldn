"use client"

import { useEffect } from "react"

import { THEME_COLORS } from "@/lib/theme-color"

/**
 * The media-specific theme-color metas already follow the OS; this keeps a
 * single, non-media meta in step with live `prefers-color-scheme` changes for
 * browsers that ignore the media attribute.
 */
export const ThemeColorSync = () => {
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"][data-dynamic]'
    )
    if (!meta) {
      meta = document.createElement("meta")
      meta.name = "theme-color"
      meta.dataset.dynamic = ""
      document.head.appendChild(meta)
    }
    const apply = () => {
      const color = mql.matches ? THEME_COLORS.dark : THEME_COLORS.light
      meta!.content = color
      document.documentElement.style.colorScheme = mql.matches ? "dark" : "light"
    }
    apply()
    mql.addEventListener("change", apply)
    return () => mql.removeEventListener("change", apply)
  }, [])

  return null
}
