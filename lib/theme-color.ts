/** Matches `--background` in globals.css (oklch 1 / oklch 0.145). */
export const THEME_COLORS = { light: "#ffffff", dark: "#0a0a0a" } as const

/**
 * `viewport.themeColor` media queries follow the OS, but the site theme is a
 * manual toggle (next-themes, `enableSystem={false}`), so the status bar would
 * disagree with the page. This runs before hydration and points every
 * theme-color meta at the stored theme; `ThemeColorSync` takes over after.
 */
export const THEME_COLOR_SCRIPT = `try{var c=localStorage.getItem("theme")==="dark"?"${THEME_COLORS.dark}":"${THEME_COLORS.light}";document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",c)})}catch(e){}`
