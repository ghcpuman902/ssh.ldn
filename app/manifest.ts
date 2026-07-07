import type { MetadataRoute } from "next"

import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_NAME,
} from "@/lib/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_SHORT_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "en-GB",
    categories: ["utilities", "maps"],
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
    ],
  }
}
