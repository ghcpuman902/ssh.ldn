import Link from "next/link"

import { TRANSIT_LOGO_SOURCES } from "@/components/map/transit-mode-icon"
import {
  CARTO_BASEMAP_CREDIT,
  MAP_STRATEGIC_DISCLAIMER,
  NOISE_DATA_CREDITS,
  type DataCredit,
  VISUAL_DATA_CREDITS,
} from "@/lib/map/data-credits"
import { DEFRA_TIME_SLOT_NOTE } from "@/lib/map/noise-time"

export const metadata = {
  title: "Data sources — ssh-ldn",
  description:
    "Dataset attributions, licences, and trademark declarations for the ssh-ldn London noise map.",
}

const CreditCard = ({ credit }: { credit: DataCredit }) => (
  <article className="rounded-xl border border-border bg-background p-4">
    <h3 className="font-medium text-foreground">{credit.title}</h3>
    <dl className="mt-3 space-y-2 text-sm">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
        <dt className="shrink-0 font-medium text-muted-foreground">Provider</dt>
        <dd>{credit.provider}</dd>
      </div>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
        <dt className="shrink-0 font-medium text-muted-foreground">Licence</dt>
        <dd>
          {credit.licenceUrl.startsWith("/") ? (
            credit.licence
          ) : (
            <a
              href={credit.licenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:text-primary hover:underline"
            >
              {credit.licence}
            </a>
          )}
        </dd>
      </div>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
        <dt className="shrink-0 font-medium text-muted-foreground">Version</dt>
        <dd>{credit.version}</dd>
      </div>
      {credit.notes ? (
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
          <dt className="shrink-0 font-medium text-muted-foreground">Notes</dt>
          <dd className="text-muted-foreground">{credit.notes}</dd>
        </div>
      ) : null}
      <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
        <dt className="shrink-0 font-medium text-muted-foreground">Dataset</dt>
        <dd>
          <a
            href={credit.datasetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:text-primary hover:underline"
          >
            {credit.datasetUrl}
          </a>
        </dd>
      </div>
    </dl>
  </article>
)

const CreditSection = ({
  title,
  description,
  credits,
}: {
  title: string
  description: string
  credits: DataCredit[]
}) => (
  <section className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
    <div className="grid gap-3">
      {credits.map((credit) => (
        <CreditCard key={credit.id} credit={credit} />
      ))}
    </div>
  </section>
)

export default function DataSourcesPage() {
  return (
    <main className="min-h-svh bg-background px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-4">
          <Link
            href="/"
            className="inline-flex text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Back to map
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Data sources &amp; attributions
            </h1>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Full dataset declarations for the ssh-ldn London noise map. Map
              tooltips show layer names only; this page holds the detailed
              source information. An unindexed reference prototype for Tube
              interior-noise mapping (FOI-backed, not open data) lives at{" "}
              <Link
                href="/maps/public-noise-data"
                className="text-foreground underline-offset-2 hover:underline"
              >
                /maps/public-noise-data
              </Link>
              — useful to show what a section map can look like before we
              collect our own measurements.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p>{MAP_STRATEGIC_DISCLAIMER}</p>
          <p className="mt-2">{DEFRA_TIME_SLOT_NOTE}</p>
        </section>

        <CreditSection
          title="Noise layers"
          description="Strategic noise rasters and local amenity sources used for the noise overlay and scoring."
          credits={NOISE_DATA_CREDITS}
        />

        <CreditSection
          title="Visual layers"
          description="Transport and greenery context overlays — not noise measurements."
          credits={VISUAL_DATA_CREDITS}
        />

        <CreditSection
          title="Basemap"
          description="Background map tiles beneath all overlays."
          credits={[CARTO_BASEMAP_CREDIT]}
        />

        <section id="trademarks" className="space-y-4 scroll-mt-8">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Trademarks &amp; logos
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Transport logos used in the visual-layer controls are sourced from
              Wikimedia Commons.
            </p>
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
            <p>
              The London Underground, Overground, Elizabeth line, DLR, and Tram
              roundel icons are from{" "}
              <a
                href={TRANSIT_LOGO_SOURCES.underground}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:text-primary hover:underline"
              >
                Wikimedia Commons
              </a>
              . The{" "}
              <strong className="font-medium text-foreground">
                TfL roundel is a registered trademark of Transport for London
              </strong>
              . This application is not affiliated with, endorsed by, or
              sponsored by Transport for London.
            </p>
            <p>
              The National Rail double-arrow icon is from{" "}
              <a
                href={TRANSIT_LOGO_SOURCES.nationalRail}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:text-primary hover:underline"
              >
                Wikimedia Commons
              </a>
              . The{" "}
              <strong className="font-medium text-foreground">
                National Rail double-arrow is a registered trademark of its
                respective owners
              </strong>{" "}
              (Rail Delivery Group / Department for Transport). This application
              is not affiliated with, endorsed by, or sponsored by those
              organisations.
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs">
              <li>
                <a
                  href={TRANSIT_LOGO_SOURCES.underground}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:text-primary hover:underline"
                >
                  Underground.svg
                </a>
              </li>
              <li>
                <a
                  href={TRANSIT_LOGO_SOURCES.overground}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:text-primary hover:underline"
                >
                  Overground_roundel.svg
                </a>
              </li>
              <li>
                <a
                  href={TRANSIT_LOGO_SOURCES.elizabeth}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:text-primary hover:underline"
                >
                  Elizabeth_line_roundel.svg
                </a>
              </li>
              <li>
                <a
                  href={TRANSIT_LOGO_SOURCES.dlr}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:text-primary hover:underline"
                >
                  DLR_roundel.svg
                </a>
              </li>
              <li>
                <a
                  href={TRANSIT_LOGO_SOURCES.tram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:text-primary hover:underline"
                >
                  Tramlink_roundel.svg
                </a>
              </li>
              <li>
                <a
                  href={TRANSIT_LOGO_SOURCES.nationalRail}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:text-primary hover:underline"
                >
                  National_Rail_logo.svg
                </a>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  )
}
