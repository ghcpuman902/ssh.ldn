/**
 * Validates planning metadata + URL resolution for demo addresses.
 * Run: node scripts/test-planning-demo.mjs
 */

const DEMO_POINTS = [
  { id: "ramen_space_dalston", lat: 51.545061, lng: -0.073901 },
  { id: "wapping_pub_quiet_aircraft", lat: 51.5043, lng: -0.0586 },
  { id: "kings_cross_euston_road_noisy", lat: 51.5308, lng: -0.1238 },
]

const LPA_PLANNING_PORTAL_BASE = {
  Hackney: "https://developmentandhousing.hackney.gov.uk",
}

const LPA_REFERENCE_SEARCH_URL = {
  "Tower Hamlets": (reference) =>
    `https://development.towerhamlets.gov.uk/online-applications/simpleSearchResults.do?searchType=Application&searchCriteria.reference=${encodeURIComponent(reference)}`,
  Hackney: (reference) =>
    `https://developmentandhousing.hackney.gov.uk/planning/index.html?fa=search&searchQuery=${encodeURIComponent(reference)}`,
}

const resolvePlanningApplicationUrl = (application) => {
  if (application.urlPlanningApp) {
    if (/^https?:\/\//i.test(application.urlPlanningApp)) {
      return application.urlPlanningApp
    }

    const base = LPA_PLANNING_PORTAL_BASE[application.planningAuthority]
    if (base) {
      return `${base}${application.urlPlanningApp.startsWith("/") ? "" : "/"}${application.urlPlanningApp}`
    }
  }

  if (
    application.source === "planning.data.gov.uk" &&
    application.applicationId
  ) {
    return `https://www.planning.data.gov.uk/entity/${application.applicationId}`
  }

  if (application.reference && application.planningAuthority) {
    const searchUrl = LPA_REFERENCE_SEARCH_URL[application.planningAuthority]
    if (searchUrl) {
      return searchUrl(application.reference)
    }
  }

  return null
}

const fetchLondonPlanning = async (lat, lng, radiusMeters = 300) => {
  const response = await fetch(
    "https://planningdata.london.gov.uk/api-guest/applications/_search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-AllowRequest": "be2rmRnt&",
      },
      body: JSON.stringify({
        size: 5,
        query: {
          geo_distance: {
            distance: `${radiusMeters}m`,
            centroid: { lat, lon: lng },
          },
        },
        _source: [
          "lpa_app_no",
          "lpa_name",
          "description",
          "decision",
          "status",
          "application_type_full",
          "development_type",
          "centroid",
          "url_planning_app",
          "id",
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    }
  )

  if (!response.ok) {
    throw new Error(`London Planning Datahub failed (${response.status})`)
  }

  const payload = await response.json()
  return (payload.hits?.hits ?? []).map((hit) => {
    const source = hit._source ?? {}
    return {
      applicationId: source.id ?? source.lpa_app_no ?? null,
      reference: source.lpa_app_no ?? null,
      description: source.description ?? null,
      status: source.status ?? source.decision ?? null,
      decisionType: source.decision ?? null,
      applicationTypeFull: source.application_type_full ?? null,
      developmentType: source.development_type ?? null,
      planningAuthority: source.lpa_name ?? null,
      urlPlanningApp: source.url_planning_app ?? null,
      source: "planningdata.london.gov.uk",
    }
  })
}

const checkUrl = async (url) => {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    })
    return response.status
  } catch {
    return "unreachable"
  }
}

for (const demo of DEMO_POINTS) {
  const applications = await fetchLondonPlanning(demo.lat, demo.lng)
  console.log(`\n=== ${demo.id} (${applications.length} sample applications) ===`)

  for (const application of applications) {
    const resolvedUrl = resolvePlanningApplicationUrl(application)
    const urlStatus = resolvedUrl ? await checkUrl(resolvedUrl) : null

    console.log(
      JSON.stringify(
        {
          reference: application.reference,
          status: application.status,
          applicationTypeFull: application.applicationTypeFull,
          developmentType: application.developmentType,
          planningAuthority: application.planningAuthority,
          urlPlanningApp: application.urlPlanningApp,
          resolvedUrl,
          urlStatus,
          description: application.description?.slice(0, 90) ?? null,
        },
        null,
        2
      )
    )
  }
}
