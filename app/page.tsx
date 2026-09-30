import type { Metadata } from "next"
import { preconnect, prefetchDNS, preload } from "react-dom"

import { MapPage } from "@/components/map/map-page"
import {
  buildShareCardPath,
  buildShareQuery,
  formatShareDescription,
  formatShareMetaTitle,
  parseShareCardSearchParams,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  splitShareAddress,
} from "@/lib/map/share-card"
import { decodeNoiseTimeSlot } from "@/lib/map/noise-time"
import { TRANSIT_GEOMETRY_CACHE_VERSION } from "@/lib/map/transit-geometry-cache"
import { SITE_NAME, SITE_URL } from "@/lib/site"

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const readParam = (value: string | string[] | undefined) => {
  const raw = Array.isArray(value) ? value[0] : value
  return raw?.trim() ?? ""
}

export const generateMetadata = async ({
  searchParams,
}: HomePageProps): Promise<Metadata> => {
  const params = await searchParams
  const card = parseShareCardSearchParams(params)
  if (!card) return {}

  const lines = splitShareAddress(card.address)
  const title = formatShareMetaTitle(lines, card.score)
  const description = formatShareDescription(lines, card.score)
  const image = buildShareCardPath(card)
  const timeSlot = decodeNoiseTimeSlot(readParam(params.timeSlot)) ?? undefined
  const query = buildShareQuery({ ...card, timeSlot })

  return {
    title,
    description,
    alternates: {
      canonical: `/?${query}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/?${query}`,
      siteName: SITE_NAME,
      locale: "en_GB",
      type: "website",
      images: [
        {
          url: image,
          width: SHARE_CARD_WIDTH,
          height: SHARE_CARD_HEIGHT,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  }
}

export default function Page() {
  prefetchDNS("https://tiles.openfreemap.org")
  preconnect("https://tiles.openfreemap.org")
  preload(
    `/api/map/tube-geometry?lod=preview&v=${TRANSIT_GEOMETRY_CACHE_VERSION}`,
    {
      as: "fetch",
      crossOrigin: "anonymous",
    }
  )

  return <MapPage />
}
