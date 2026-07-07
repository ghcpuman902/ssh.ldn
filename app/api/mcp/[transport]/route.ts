import { createMcpHandler } from "mcp-handler"
import { z } from "zod"

import {
  buildAddressNoiseReport,
  formatAddressNoiseReportText,
} from "@/lib/server/address-noise-report"

const timeSlotSchema = z.enum([
  "weekday-day",
  "weekday-night",
  "weekend-day",
  "weekend-night",
])

const addressInputSchema = {
  address: z.string().trim().min(1).describe("London address or postcode"),
  floor: z
    .number()
    .int()
    .min(0)
    .max(50)
    .optional()
    .describe("Floor level, where 0 is ground floor"),
  facing: z
    .string()
    .trim()
    .optional()
    .describe("Street-facing orientation if known"),
  timeSlot: timeSlotSchema
    .optional()
    .describe(
      "Noise time slot: weekday-day, weekday-night, weekend-day, or weekend-night"
    ),
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "explain_london_noise_for_address",
      {
        title: "Explain London noise for an address",
        description:
          "Geocode a London address and return a noise score, confidence band, dominant sources, and plain-language explanation for weekday/weekend and day/night contexts.",
        inputSchema: addressInputSchema,
      },
      async ({ address, floor, facing, timeSlot }) => {
        const report = await buildAddressNoiseReport({
          address,
          floor,
          facing,
          timeSlot,
        })

        if ("error" in report) {
          return {
            content: [
              {
                type: "text" as const,
                text: report.error,
              },
            ],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: formatAddressNoiseReportText(report),
            },
            {
              type: "text" as const,
              text: JSON.stringify(report, null, 2),
            },
          ],
        }
      }
    )
  },
  {},
  {
    basePath: "/api/mcp",
    maxDuration: 60,
  }
)

export { handler as GET, handler as POST, handler as DELETE }
