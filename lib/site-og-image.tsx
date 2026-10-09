import { ImageResponse } from "next/og"

import { getNoiseScoreHex } from "@/lib/map/noise-score-color"
import { SITE_NAME } from "@/lib/site"

export const SITE_OG_SIZE = { width: 1200, height: 630 } as const

export const SITE_OG_ALT =
  "ssh-ldn: a London noise map showing road, rail, aircraft and venue noise by day and night."

const COLUMNS = 9
const ROWS = 9
const CELL = 48
const GAP = 6

const CHIPS = [
  { label: "Road", color: "#f59e0b" },
  { label: "Rail", color: "#0ea5e9" },
  { label: "Aircraft", color: "#6366f1" },
  { label: "Pubs & clubs", color: "#d946ef" },
]

/** Deterministic pseudo-heatmap: loud ridge across the middle, quiet edges. */
const cellScore = (column: number, row: number) => {
  const dx = (column - 4) / 4
  const dy = (row - 4) / 4
  const ridge = Math.exp(-((dy - dx * 0.45) ** 2) * 5.5)
  const wobble = ((column * 37 + row * 91) % 17) / 17
  return Math.round(Math.min(100, 12 + ridge * 70 + wobble * 22))
}

export const createSiteOgImage = () => {
  const cells = Array.from({ length: COLUMNS * ROWS }, (_, index) => {
    const column = index % COLUMNS
    const row = Math.floor(index / COLUMNS)
    return { key: index, color: getNoiseScoreHex(cellScore(column, row)) }
  })

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 64px",
          backgroundColor: "#ffffff",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 620 }}>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: -4,
              color: "#1c1c1c",
              fontFamily: "monospace",
            }}
          >
            {SITE_NAME}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: 42,
              lineHeight: 1.2,
              fontWeight: 600,
              color: "#1c1c1c",
            }}
          >
            Is your London street quiet?
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: 28,
              lineHeight: 1.35,
              color: "#52525b",
            }}
          >
            Road, rail, aircraft and pub noise by day, night, weekday and
            weekend.
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              marginTop: 32,
              gap: 10,
            }}
          >
            {CHIPS.map((chip) => (
              <div
                key={chip.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 16px",
                  borderRadius: 999,
                  backgroundColor: "#f4f4f5",
                  fontSize: 22,
                  color: "#27272a",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 14,
                    height: 14,
                    marginRight: 10,
                    borderRadius: 7,
                    backgroundColor: chip.color,
                  }}
                />
                {chip.label}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            width: COLUMNS * (CELL + GAP) - GAP,
            height: ROWS * (CELL + GAP) - GAP,
            gap: GAP,
          }}
        >
          {cells.map((cell) => (
            <div
              key={cell.key}
              style={{
                display: "flex",
                width: CELL,
                height: CELL,
                borderRadius: 10,
                backgroundColor: cell.color,
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...SITE_OG_SIZE }
  )
}
