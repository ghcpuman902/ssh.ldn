import {
  createSiteOgImage,
  SITE_OG_ALT,
  SITE_OG_SIZE,
} from "@/lib/site-og-image"

export const alt = SITE_OG_ALT
export const size = { width: SITE_OG_SIZE.width, height: SITE_OG_SIZE.height }
export const contentType = "image/png"

export default function Image() {
  return createSiteOgImage()
}
