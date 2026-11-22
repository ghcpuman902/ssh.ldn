import { ImageResponse } from "next/og"

import { getNoiseScoreHex } from "@/lib/map/noise-score-color"
import { NOISE_DATA_BASE_URL } from "@/lib/map/noise-tiles"
import {
  describeNoiseScore,
  layoutShareMap,
  layoutSharePlace,
  layoutShareStreet,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  SHARE_SHEET_HEIGHT,
  SHARE_SHEET_RADIUS,
  SHARE_TAB,
  shareTabPath,
  shortShareAddress,
  type ShareCardInput,
} from "@/lib/map/share-card"
import { renderShareNoisePng } from "@/lib/server/share-noise-raster"

const NOTO_400 =
  "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@5.2.5/latin-400-normal.ttf"
const NOTO_600 =
  "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@5.2.5/latin-600-normal.ttf"

type ShareFont = {
  name: string
  data: ArrayBuffer
  weight: 400 | 600 | 700
  style: "normal"
}

let fontsPromise: Promise<ShareFont[] | undefined> | null = null

const fetchBuffer = async (url: string) => {
  const response = await fetch(url, {
    headers: { "User-Agent": "ssh-ldn/1.0 (share card)" },
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) return null
  return response.arrayBuffer()
}

const loadFonts = () => {
  fontsPromise ??= Promise.all([fetchBuffer(NOTO_400), fetchBuffer(NOTO_600)])
    .then(([regular, semibold]) => {
      if (!regular || !semibold) return undefined

      return [
        { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
        { name: "Inter", data: semibold, weight: 600 as const, style: "normal" as const },
      ]
    })
    .catch(() => undefined)

  return fontsPromise
}

const toDataUrl = (buffer: ArrayBuffer, mime: string) =>
  `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`

const loadMap = async (input: ShareCardInput) => {
  const layout = layoutShareMap(input.latitude, input.longitude)
  const [tiles, noise] = await Promise.all([
    Promise.all(
      layout.tiles.map(async (tile) => {
        const [base, labels] = await Promise.all([
          fetchBuffer(tile.baseUrl),
          fetchBuffer(tile.labelUrl),
        ])

        return {
          ...tile,
          base: base ? toDataUrl(base, "image/jpeg") : null,
          labels: labels ? toDataUrl(labels, "image/png") : null,
        }
      })
    ),
    renderShareNoisePng(NOISE_DATA_BASE_URL, layout.view).catch((error) => {
      console.error("share card noise", error)
      return null
    }),
  ])

  return {
    ...layout,
    tiles,
    noise: noise ? `data:image/png;base64,${noise.toString("base64")}` : null,
  }
}

const fill = { position: "absolute", left: 0, top: 0 } as const

/**
 * Full-bleed share card (Mangle, t1327u-t1329u): the real map (Positron +
 * the weekday-day noise grid, every source on) edge to edge, a white logo
 * tab cut into the top-left corner and a white sheet rising from the bottom
 * with the place and its score. White only, no shadows, no frame: platforms
 * round the corners themselves.
 */
export const createShareCardImage = async (input: ShareCardInput) => {
  const [fonts, map] = await Promise.all([loadFonts(), loadMap(input)])
  const short = shortShareAddress(input.address)
  const street = layoutShareStreet(short.name, input.score !== undefined)
  const place = short.area ? layoutSharePlace(short.area, street.width) : ""
  const scoreColor =
    input.score !== undefined ? getNoiseScoreHex(input.score) : "#1c1c1c"
  const phrase =
    input.score !== undefined ? describeNoiseScore(input.score) : ""
  const W = SHARE_CARD_WIDTH
  const H = SHARE_CARD_HEIGHT
  const tab = SHARE_TAB

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#fafaf8",
          fontFamily: "Inter",
        }}
      >
        {map.tiles.map((tile) =>
          tile.base ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`b${tile.key}`}
              alt=""
              src={tile.base}
              width={tile.size}
              height={tile.size}
              style={{ position: "absolute", left: tile.left, top: tile.top }}
            />
          ) : null
        )}

        {map.noise ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={map.noise} width={W} height={H} style={fill} />
        ) : null}

        {map.tiles.map((tile) =>
          tile.labels ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`l${tile.key}`}
              alt=""
              src={tile.labels}
              width={tile.size}
              height={tile.size}
              style={{ position: "absolute", left: tile.left, top: tile.top }}
            />
          ) : null
        )}

        <svg
          width={22}
          height={30}
          viewBox="0 0 22 30"
          style={{ position: "absolute", left: map.pinLeft - 11, top: map.pinTop - 29 }}
        >
          <path
            d="M11 29 C11 29 1 17.5 1 11 A10 10 0 0 1 21 11 C21 17.5 11 29 11 29 Z"
            fill="#1c1c1c"
            stroke="#ffffff"
            strokeWidth={2}
          />
          <circle cx={11} cy={11} r={3.6} fill="#ffffff" />
        </svg>

        <svg
          width={tab.width + tab.fillet}
          height={tab.height + tab.fillet}
          viewBox={`0 0 ${tab.width + tab.fillet} ${tab.height + tab.fillet}`}
          style={fill}
        >
          <path d={shareTabPath()} fill="#ffffff" />
        </svg>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: tab.width,
            height: tab.height,
            display: "flex",
            alignItems: "center",
            paddingLeft: 24,
          }}
        >
          <div style={{ display: "flex", fontSize: 32 }}>🤫</div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 10 }}>
            <div
              style={{
                display: "flex",
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: -0.6,
                color: "#1c1c1c",
                lineHeight: 1,
              }}
            >
              ssh-ldn
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 4,
                fontSize: 14,
                color: "#737373",
                lineHeight: 1,
              }}
            >
              London Noise Map
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: W,
            height: SHARE_SHEET_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#ffffff",
            borderTopLeftRadius: SHARE_SHEET_RADIUS,
            borderTopRightRadius: SHARE_SHEET_RADIUS,
            padding: "0 40px 16px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", width: street.width }}>
            <div
              style={{
                display: "flex",
                width: street.width,
                fontSize: street.fontSize,
                fontWeight: 600,
                lineHeight: `${street.lineHeight}px`,
                letterSpacing: -0.8,
                color: "#1c1c1c",
                whiteSpace: street.lines === 1 ? "nowrap" : "normal",
              }}
            >
              {street.text}
            </div>
            {place ? (
              <div
                style={{
                  display: "flex",
                  width: street.width,
                  marginTop: 4,
                  fontSize: 22,
                  lineHeight: "28px",
                  color: "#737373",
                  whiteSpace: "nowrap",
                }}
              >
                {place}
              </div>
            ) : null}
          </div>

          {input.score !== undefined ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                marginLeft: 20,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 64,
                    fontWeight: 600,
                    lineHeight: 1,
                    letterSpacing: -2,
                    color: scoreColor,
                  }}
                >
                  {input.score}
                </div>
                <div
                  style={{
                    display: "flex",
                    marginLeft: 4,
                    marginBottom: 7,
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#737373",
                  }}
                >
                  /100
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 4,
                  fontSize: 22,
                  lineHeight: "28px",
                  fontWeight: 600,
                  color: "#1c1c1c",
                  whiteSpace: "nowrap",
                }}
              >
                {phrase}
              </div>
            </div>
          ) : null}

          <div
            style={{
              position: "absolute",
              right: 40,
              bottom: 6,
              display: "flex",
              fontSize: 11,
              color: "#a3a3a3",
            }}
          >
            © Esri, OpenStreetMap · noise © DEFRA
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts,
      emoji: "twemoji",
      headers: {
        "Cache-Control":
          "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    }
  )
}
