import Link from "next/link"

import {
  OPENFREEMAP_BASEMAP_CREDIT,
  MAP_STRATEGIC_DISCLAIMER,
  NOISE_DATA_CREDITS,
  OSM_RAIL_CREDIT,
  type DataCredit,
  VISUAL_DATA_CREDITS,
} from "@/lib/map/data-credits"
import { DEFRA_TIME_SLOT_NOTE } from "@/lib/map/noise-time"

export const metadata = {
  title: "Data sources — ssh-ldn",
  description:
    "Dataset attributions and licences for the ssh-ldn London noise map.",
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
              source information.
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
          description="Background map tiles and above-ground railway geometry beneath noise overlays."
          credits={[OPENFREEMAP_BASEMAP_CREDIT, OSM_RAIL_CREDIT]}
        />
      </div>
    </main>
  )
}
