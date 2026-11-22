/**
 * One row per London planning authority, keyed by the `lpa_name` the London
 * Planning Datahub returns. Every URL shape here was checked with real HTTP
 * requests against a live application on 22 Nov 2026; the research table is
 * doc/planning/london-planning-links.md.
 *
 * Pure data and string work only, so `node --test` can import it directly.
 */

export type PlanningSystem =
  | "idox"
  | "agile"
  | "ocella"
  | "tascomi"
  | "northgate"
  | "nec"
  | "arcus"
  | "rbkc"

/**
 * How far a link can go:
 * - `reference`: a URL built from the reference opens the application, or a
 *   results page holding only it. Checked by HTTP.
 * - `datahub`: only the per-application URL the council publishes to the
 *   datahub works (no reference URL exists).
 * - `search`: no deep link works; we send people to the search page.
 */
export type PlanningDeepLink = "reference" | "datahub" | "search"

export type PlanningPortal = {
  /** Display name. */
  name: string
  system: PlanningSystem
  /** Public search page (always works, checked by HTTP). */
  searchUrl: string
  deepLink: PlanningDeepLink
  /** Builds the deep link from the council reference. */
  referenceUrl?: (reference: string) => string
  /**
   * What to do with `url_planning_app` from the datahub:
   * - `use`: the council's URL works as published.
   * - `fix`: works after `normaliseDatahubUrl`.
   * - `ignore`: placeholder text, dead host or broken key; never link it.
   */
  datahubUrl: "use" | "fix" | "ignore"
  /**
   * The council puts a human check (Cloudflare, AWS WAF, NEC) in front of the
   * portal, so scripts get a challenge page. People pass it in a browser.
   */
  botWall?: boolean
  /** Search is too slow to send people to; use the datahub URL when present. */
  preferDatahub?: boolean
  note?: string
}

const enc = encodeURIComponent

const idox = (
  name: string,
  base: string,
  options: Partial<Pick<PlanningPortal, "datahubUrl" | "preferDatahub" | "note">> = {}
): PlanningPortal => ({
  name,
  system: "idox",
  searchUrl: `${base}/search.do?action=simple&searchType=Application`,
  deepLink: "reference",
  // GET simple search needs no CSRF token. One hit redirects straight to the
  // application page; a partial reference (e.g. Tower Hamlets without /S)
  // still lands on the single match.
  referenceUrl: (reference) =>
    `${base}/simpleSearchResults.do?action=firstPage&searchType=Application&searchCriteria.simpleSearchString=${enc(reference)}&searchCriteria.simpleSearch=true`,
  datahubUrl: options.datahubUrl ?? "use",
  preferDatahub: options.preferDatahub,
  note: options.note,
})

const agile = (
  name: string,
  host: string,
  client: string,
  note?: string
): PlanningPortal => ({
  name,
  system: "agile",
  searchUrl: `${host}/${client}/search-applications/`,
  deepLink: "reference",
  referenceUrl: (reference) =>
    `${host}/${client}/search-applications/results?criteria=${enc(JSON.stringify({ reference }))}`,
  datahubUrl: "ignore",
  note,
})

const ocella = (name: string, base: string): PlanningPortal => ({
  name,
  system: "ocella",
  searchUrl: `${base}/OcellaWeb/planningSearch`,
  deepLink: "reference",
  referenceUrl: (reference) =>
    `${base}/OcellaWeb/planningDetails?reference=${enc(reference)}`,
  datahubUrl: "fix",
})

const tascomi = (name: string, base: string): PlanningPortal => ({
  name,
  system: "tascomi",
  searchUrl: `${base}/planning/index.html?fa=search`,
  deepLink: "datahub",
  datahubUrl: "fix",
  botWall: true,
  note: "Application pages use an internal id, so only the datahub URL can deep link.",
})

const nec = (name: string, base: string): PlanningPortal => ({
  name,
  system: "nec",
  searchUrl: `${base}/NECSWS/ES/Presentation/Planning/OnlinePlanning/OnlinePlanningSearch`,
  deepLink: "reference",
  referenceUrl: (reference) =>
    `${base}/NECSWS/ES/Presentation/Planning/OnlinePlanning/OnlinePlanningOverview?applicationNumber=${enc(reference)}`,
  datahubUrl: "use",
  botWall: true,
})

const AGILE_HOST = "https://planning.agileapplications.co.uk"

/** Keyed by the datahub `lpa_name`. 32 boroughs, the City and 3 corporations. */
export const LONDON_PLANNING_PORTALS = {
  "Barking & Dagenham": tascomi(
    "Barking and Dagenham",
    "https://online-befirst.lbbd.gov.uk"
  ),
  Barnet: idox("Barnet", "https://publicaccess.barnet.gov.uk/online-applications"),
  Bexley: idox("Bexley", "https://pa.bexley.gov.uk/online-applications"),
  Brent: idox("Brent", "https://pa.brent.gov.uk/online-applications"),
  Bromley: {
    name: "Bromley",
    system: "arcus",
    searchUrl: "https://planningaccess.bromley.gov.uk/s/",
    deepLink: "search",
    datahubUrl: "ignore",
    note: "Arcus (Salesforce) register since June 2025; pages are keyed by Salesforce id and the datahub has no URLs. The old Idox host no longer answers.",
  },
  Camden: {
    name: "Camden",
    system: "northgate",
    searchUrl:
      "https://planningrecords.camden.gov.uk/Northgate/PlanningExplorer/GeneralSearch.aspx",
    deepLink: "reference",
    referenceUrl: (reference) =>
      `https://planningrecords.camden.gov.uk/Northgate/PlanningExplorer/DisplayAppDetails.aspx?AppNo=${enc(reference)}`,
    datahubUrl: "use",
    botWall: true,
  },
  "City of London": idox(
    "City of London",
    "https://www.planning2.cityoflondon.gov.uk/online-applications"
  ),
  Croydon: idox("Croydon", "https://publicaccess3.croydon.gov.uk/online-applications"),
  Ealing: idox("Ealing", "https://pam.ealing.gov.uk/online-applications"),
  Enfield: idox(
    "Enfield",
    "https://planningandbuildingcontrol.enfield.gov.uk/online-applications",
    { datahubUrl: "ignore", note: "Datahub URL is the placeholder \"<enter PA URL here>\"." }
  ),
  Greenwich: idox(
    "Greenwich",
    "https://planning.royalgreenwich.gov.uk/online-applications"
  ),
  Hackney: tascomi("Hackney", "https://developmentandhousing.hackney.gov.uk"),
  "Hammersmith & Fulham": nec("Hammersmith and Fulham", "https://property.lbhf.gov.uk"),
  Haringey: {
    name: "Haringey",
    system: "arcus",
    searchUrl: "https://publicregister.haringey.gov.uk/pr/s/",
    deepLink: "datahub",
    datahubUrl: "use",
    note: "Arcus (Salesforce): detail pages are keyed by Salesforce id, which only the datahub URL carries.",
  },
  Harrow: tascomi("Harrow", "https://planningsearch.harrow.gov.uk"),
  Havering: ocella("Havering", "https://development.havering.gov.uk"),
  Hillingdon: ocella("Hillingdon", "https://planning.hillingdon.gov.uk"),
  Hounslow: nec("Hounslow", "https://planningandbuilding.hounslow.gov.uk"),
  Islington: agile(
    "Islington",
    AGILE_HOST,
    "islington",
    "Moved to Agile Applications in April 2024; the datahub URL is a placeholder."
  ),
  "Kensington & Chelsea": {
    name: "Kensington and Chelsea",
    system: "rbkc",
    searchUrl: "https://www.rbkc.gov.uk/planningsearch",
    deepLink: "reference",
    // The case path keeps the reference's slashes: /cases/PP/26/05487.
    referenceUrl: (reference) =>
      `https://www.rbkc.gov.uk/planningsearch/cases/${reference
        .trim()
        .split("/")
        .map(enc)
        .join("/")}`,
    datahubUrl: "ignore",
    note: "New register after the November 2025 cyber attack; case pages render in the browser.",
  },
  Kingston: idox("Kingston upon Thames", "https://publicaccess.kingston.gov.uk/online-applications", {
    preferDatahub: true,
    note: "Search pages take 2 minutes or time out; datahub application URLs load in about 2 s.",
  }),
  Lambeth: idox("Lambeth", "https://planning.lambeth.gov.uk/online-applications", {
    datahubUrl: "ignore",
    note: "Datahub URL is the placeholder \"<enter PA URL here>\".",
  }),
  Lewisham: idox("Lewisham", "https://planning.lewisham.gov.uk/online-applications"),
  Merton: tascomi("Merton", "https://rspandlp.merton.gov.uk"),
  Newham: idox("Newham", "https://pa.newham.gov.uk/online-applications"),
  Redbridge: agile("Redbridge", "https://planning.redbridge.gov.uk", "redbridge"),
  Richmond: agile(
    "Richmond upon Thames",
    "https://planning.richmond.gov.uk",
    "richmond"
  ),
  Southwark: idox("Southwark", "https://planning.southwark.gov.uk/online-applications"),
  Sutton: idox("Sutton", "https://planningregister.sutton.gov.uk/online-applications", {
    preferDatahub: true,
    note: "Reference search times out (over 60 s) and the search page redirects to the council site; datahub application URLs load in about 2 s.",
  }),
  "Tower Hamlets": idox(
    "Tower Hamlets",
    "https://development.towerhamlets.gov.uk/online-applications",
    {
      datahubUrl: "fix",
      note: "Datahub keyVal drops the underscore (DCAPR150841 for DCAPR_150841); the portal shows \"Error\" for it.",
    }
  ),
  "Waltham Forest": tascomi(
    "Waltham Forest",
    "https://builtenvironment.walthamforest.gov.uk"
  ),
  Wandsworth: agile(
    "Wandsworth",
    "https://planning.wandsworth.gov.uk",
    "wandsworth",
    "Moved from Northgate to Agile Applications in September 2026; old datahub URLs point at the dead Northgate host."
  ),
  Westminster: idox("Westminster", "https://idoxpa.westminster.gov.uk/online-applications"),
  LLDC: {
    name: "London Legacy Development Corporation",
    system: "idox",
    searchUrl:
      "https://pa.newham.gov.uk/online-applications/search.do?action=simple&searchType=Application",
    deepLink: "search",
    datahubUrl: "ignore",
    note: "Planning powers went back to Newham, Tower Hamlets, Hackney and Waltham Forest on 1 Dec 2024. The LLDC register is offline and old references do not match on the borough portals, so we open Newham's search page (most of the old LLDC area).",
  },
  OPDC: agile("Old Oak and Park Royal Development Corporation", AGILE_HOST, "opdc"),
  OSDC: {
    name: "Oxford Street Development Corporation",
    system: "arcus",
    searchUrl: "https://planning.oxfordstreetdc.org.uk/pr/s/",
    deepLink: "datahub",
    datahubUrl: "use",
  },
} satisfies Record<string, PlanningPortal>

export type LondonPlanningAuthority = keyof typeof LONDON_PLANNING_PORTALS

/** The 32 boroughs and the City; the corporations are on top of these. */
export const LONDON_BOROUGH_AUTHORITIES = [
  "Barking & Dagenham", "Barnet", "Bexley", "Brent", "Bromley", "Camden",
  "City of London", "Croydon", "Ealing", "Enfield", "Greenwich", "Hackney",
  "Hammersmith & Fulham", "Haringey", "Harrow", "Havering", "Hillingdon",
  "Hounslow", "Islington", "Kensington & Chelsea", "Kingston", "Lambeth",
  "Lewisham", "Merton", "Newham", "Redbridge", "Richmond", "Southwark",
  "Sutton", "Tower Hamlets", "Waltham Forest", "Wandsworth", "Westminster",
] as const satisfies readonly LondonPlanningAuthority[]

export const getPlanningPortal = (
  authority: string | null | undefined
): PlanningPortal | null =>
  authority && Object.hasOwn(LONDON_PLANNING_PORTALS, authority)
    ? LONDON_PLANNING_PORTALS[authority as LondonPlanningAuthority]
    : null

/**
 * Repairs the known faults in datahub `url_planning_app` values:
 * - Tower Hamlets drops the underscore in the Idox keyVal.
 * - Tascomi URLs carry a double slash before /planning.
 * - Ocella URLs are published as http.
 */
export const normaliseDatahubUrl = (url: string): string => {
  let next = url.trim().replace(/^http:\/\//i, "https://")
  next = next.replace(/^(https:\/\/[^/]+)\/{2,}/i, "$1/")
  next = next.replace(/([?&]keyVal=)DCAPR(\d)/, "$1DCAPR_$2")
  return next
}

const isHttpUrl = (value: string) => /^https?:\/\/[^\s<>]+$/i.test(value.trim())

export type PlanningLink = {
  url: string
  /** `direct`: opens the application (or a results page of only it). */
  kind: "direct" | "search"
}

/**
 * Best working link for one application: a checked reference deep link, then
 * a usable datahub URL, then the council search page.
 */
export const resolvePortalLink = (input: {
  planningAuthority: string | null
  reference: string | null
  urlPlanningApp: string | null
}): PlanningLink | null => {
  const portal = getPlanningPortal(input.planningAuthority)
  const reference = input.reference?.trim() || null
  const datahub =
    portal && portal.datahubUrl !== "ignore" && input.urlPlanningApp && isHttpUrl(input.urlPlanningApp)
      ? portal.datahubUrl === "fix"
        ? normaliseDatahubUrl(input.urlPlanningApp)
        : input.urlPlanningApp.trim()
      : null

  if (!portal) {
    return null
  }

  if (datahub && (portal.preferDatahub || !portal.referenceUrl || !reference)) {
    return { url: datahub, kind: "direct" }
  }

  if (portal.referenceUrl && reference) {
    return { url: portal.referenceUrl(reference), kind: "direct" }
  }

  if (datahub) {
    return { url: datahub, kind: "direct" }
  }

  return { url: portal.searchUrl, kind: "search" }
}
