"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"

import { THEME_COLORS } from "@/lib/theme-color"

/** Keeps the theme-color meta (status bar) on the site theme, not the OS. */
export const ThemeColorSync = () => {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const color =
      resolvedTheme === "dark" ? THEME_COLORS.dark : THEME_COLORS.light
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute("content", color))
  }, [resolvedTheme])

  return null
}
