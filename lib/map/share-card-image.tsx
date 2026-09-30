import { ImageResponse } from "next/og"

import { getNoiseScoreHex } from "@/lib/map/noise-score-color"
import {
  describeNoiseScore,
  layoutShareMap,
  layoutSharePlace,
  layoutShareStreet,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  SHARE_MAP_FRAME,
  splitShareAddress,
  type ShareCardInput,
} from "@/lib/map/share-card"

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

const loadTiles = async (input: ShareCardInput) => {
  const layout = layoutShareMap(input.latitude, input.longitude)
  const tiles = await Promise.all(
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
  )

  return { ...layout, tiles }
}

export const createShareCardImage = async (input: ShareCardInput) => {
  const [fonts, map] = await Promise.all([loadFonts(), loadTiles(input)])
  const lines = splitShareAddress(input.address)
  const street = layoutShareStreet(lines.street, input.score !== undefined)
  const place = lines.place ? layoutSharePlace(lines.place, street.width) : ""
  const scoreColor =
    input.score !== undefined ? getNoiseScoreHex(input.score) : "#1c1c1c"
  const phrase =
    input.score !== undefined ? describeNoiseScore(input.score) : ""
  const frame = SHARE_MAP_FRAME

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#ffffff",
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
            display: "flex",
            overflow: "hidden",
            borderRadius: frame.radius,
            backgroundColor: "#eceae6",
            border: "1px solid #e4e4e7",
          }}
        >
          {map.tiles.map((tile) => (
            <div
              key={tile.key}
              style={{
                position: "absolute",
                left: tile.left,
                top: tile.top,
                width: tile.size,
                height: tile.size,
                display: "flex",
              }}
            >
              {tile.base ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  src={tile.base}
                  width={tile.size}
                  height={tile.size}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: tile.size,
                    height: tile.size,
                  }}
                />
              ) : null}
              {tile.labels ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  src={tile.labels}
                  width={tile.size}
                  height={tile.size}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: tile.size,
                    height: tile.size,
                  }}
                />
              ) : null}
            </div>
          ))}

          <div
            style={{
              position: "absolute",
              left: map.pinLeft - 22,
              top: map.pinTop - 26,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "#ffffff",
              border: "3px solid #1c1c1c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
            }}
          >
            📍
          </div>

          <div
            style={{
              position: "absolute",
              left: 22,
              top: 22,
              display: "flex",
              alignItems: "center",
              backgroundColor: "#ffffff",
              borderRadius: 18,
              padding: "8px 14px 8px 10px",
            }}
          >
            <div style={{ display: "flex", fontSize: 28 }}>🤫</div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginLeft: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
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
                  marginTop: 3,
                  fontSize: 13,
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
              right: 22,
              top: 22,
              display: "flex",
              backgroundColor: "#ffffff",
              borderRadius: 12,
              padding: "6px 10px",
              fontSize: 13,
              color: "#737373",
            }}
          >
            © Esri, OSM
          </div>

          <div
            style={{
              position: "absolute",
              left: 22,
              bottom: 22,
              width: frame.width - 46,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#ffffff",
              borderRadius: 28,
              padding: "18px 22px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: street.width,
              }}
            >
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
                  width: 220,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 56,
                      fontWeight: 600,
                      lineHeight: 1,
                      letterSpacing: -1.5,
                      color: scoreColor,
                    }}
                  >
                    {input.score}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      marginLeft: 4,
                      marginBottom: 6,
                      fontSize: 18,
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
                    fontSize: 16,
                    lineHeight: "20px",
                    color: "#737373",
                    textAlign: "right",
                  }}
                >
                  {phrase}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    {
      width: SHARE_CARD_WIDTH,
      height: SHARE_CARD_HEIGHT,
      fonts,
      emoji: "twemoji",
      headers: {
        "Cache-Control":
          "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    }
  )
}
