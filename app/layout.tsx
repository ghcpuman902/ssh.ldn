import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import "./globals.css"
import { SiteJsonLd } from "@/components/site-json-ld"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeShortcuts } from "@/components/theme-shortcuts"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  SITE_DESCRIPTION,
  SITE_GITHUB_URL,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site"
import { cn } from "@/lib/utils"

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

// Canonical URLs are set per page; a layout-level canonical would leak onto
// every child route. The default share image comes from `opengraph-image.tsx`
// and `twitter-image.tsx`.
export const metadata: Metadata = {
  title: { default: SITE_TITLE, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  category: "utilities",
  authors: [{ name: SITE_NAME, url: SITE_GITHUB_URL }],
  creator: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <SiteJsonLd />
        <ThemeProvider>
          <ThemeShortcuts />
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-center" />
        </ThemeProvider>
        {/* `/_vercel/insights` is only injected on Vercel — skip local `next start`. */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  )
}
