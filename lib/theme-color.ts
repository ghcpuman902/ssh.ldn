/** Matches `--background` in globals.css (oklch 1 / oklch 0.145). */
export const THEME_COLORS = { light: "#ffffff", dark: "#0a0a0a" } as const

/**
 * The site follows the OS (`prefers-color-scheme`) only. This runs before
 * hydration and drops any theme stored by the old manual toggle so it can
 * never override the system setting.
 */
export const THEME_COLOR_SCRIPT = `try{localStorage.removeItem("theme");localStorage.removeItem("ssh-ldn-theme-system")}catch(e){}`
