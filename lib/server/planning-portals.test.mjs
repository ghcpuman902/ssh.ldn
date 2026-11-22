// Every London planning authority the datahub can return must have a checked
// link row, and the known datahub faults must be repaired or ignored.
import assert from "node:assert/strict"
import { test } from "node:test"

import {
  LONDON_BOROUGH_AUTHORITIES,
  LONDON_PLANNING_PORTALS,
  normaliseDatahubUrl,
  resolvePortalLink,
} from "./planning-portals.ts"

// lpa_name values seen in planningdata.london.gov.uk (terms agg, Nov 2026).
const DATAHUB_LPA_NAMES = [
  "Barking & Dagenham", "Barnet", "Bexley", "Brent", "Bromley", "Camden",
  "City of London", "Croydon", "Ealing", "Enfield", "Greenwich", "Hackney",
  "Hammersmith & Fulham", "Haringey", "Harrow", "Havering", "Hillingdon",
  "Hounslow", "Islington", "Kensington & Chelsea", "Kingston", "Lambeth",
  "Lewisham", "Merton", "Newham", "Redbridge", "Richmond", "Southwark",
  "Sutton", "Tower Hamlets", "Waltham Forest", "Wandsworth", "Westminster",
  "LLDC", "OPDC", "OSDC",
]

test("33 borough authorities (32 boroughs + City) are listed once", () => {
  assert.equal(LONDON_BOROUGH_AUTHORITIES.length, 33)
  assert.equal(new Set(LONDON_BOROUGH_AUTHORITIES).size, 33)
})

test("every datahub authority has a portal row, and nothing extra", () => {
  assert.deepEqual(
    Object.keys(LONDON_PLANNING_PORTALS).sort(),
    [...DATAHUB_LPA_NAMES].sort()
  )
})

test("every row has an https search page and a coherent deep-link mode", () => {
  for (const [authority, portal] of Object.entries(LONDON_PLANNING_PORTALS)) {
    assert.match(portal.searchUrl, /^https:\/\/[^\s]+$/, authority)
    if (portal.deepLink === "reference") {
      assert.equal(typeof portal.referenceUrl, "function", authority)
      const url = portal.referenceUrl("26/01234/FUL")
      assert.match(url, /^https:\/\//, authority)
      assert.ok(url.includes("26") && url.includes("01234"), authority)
    } else {
      assert.equal(portal.referenceUrl, undefined, authority)
    }
    if (portal.deepLink === "datahub") {
      assert.notEqual(portal.datahubUrl, "ignore", authority)
    }
  }
})

test("Tower Hamlets keyVal gets its underscore back", () => {
  assert.equal(
    normaliseDatahubUrl(
      "https://development.towerhamlets.gov.uk/online-applications/applicationDetails.do?keyVal=DCAPR150841&activeTab=summary"
    ),
    "https://development.towerhamlets.gov.uk/online-applications/applicationDetails.do?keyVal=DCAPR_150841&activeTab=summary"
  )
})

test("Tower Hamlets links use the reference search, not the broken keyVal", () => {
  const link = resolvePortalLink({
    planningAuthority: "Tower Hamlets",
    reference: "PA/26/00972",
    urlPlanningApp:
      "https://development.towerhamlets.gov.uk/online-applications/applicationDetails.do?keyVal=DCAPR150841&activeTab=summary",
  })
  assert.equal(link?.kind, "direct")
  assert.match(link.url, /simpleSearchResults\.do\?.*simpleSearchString=PA%2F26%2F00972/)
})

test("Tascomi double slash and Ocella http are fixed", () => {
  assert.equal(
    resolvePortalLink({
      planningAuthority: "Hackney",
      reference: "2026/2169",
      urlPlanningApp:
        "https://developmentandhousing.hackney.gov.uk//planning/index.html?fa=getApplication&id=86418",
    })?.url,
    "https://developmentandhousing.hackney.gov.uk/planning/index.html?fa=getApplication&id=86418"
  )
  assert.equal(
    normaliseDatahubUrl(
      "http://development.havering.gov.uk/OcellaWeb/planningDetails?reference=Z0004.26"
    ),
    "https://development.havering.gov.uk/OcellaWeb/planningDetails?reference=Z0004.26"
  )
})

test("placeholder datahub URLs are never linked", () => {
  for (const [planningAuthority, urlPlanningApp] of [
    ["Enfield", "<enter PA URL here>"],
    ["Islington", "http://site.com/?appref=P2026/2476/FUL"],
    ["Lambeth", "<enter PA URL here>"],
  ]) {
    const link = resolvePortalLink({ planningAuthority, reference: "X/1", urlPlanningApp })
    assert.ok(!link.url.includes("site.com") && !link.url.includes("<"), planningAuthority)
  }
})

test("no deep link means the search page, flagged as search", () => {
  const bromley = resolvePortalLink({
    planningAuthority: "Bromley",
    reference: "22/03337/FULL1",
    urlPlanningApp: null,
  })
  assert.deepEqual(bromley, {
    url: LONDON_PLANNING_PORTALS.Bromley.searchUrl,
    kind: "search",
  })
  const hackneyNoUrl = resolvePortalLink({
    planningAuthority: "Hackney",
    reference: "2026/2169",
    urlPlanningApp: null,
  })
  assert.equal(hackneyNoUrl.kind, "search")
})

test("Agile and RBKC reference links keep the reference intact", () => {
  assert.equal(
    LONDON_PLANNING_PORTALS.Islington.referenceUrl("P2026/2476/FUL"),
    "https://planning.agileapplications.co.uk/islington/search-applications/results?criteria=%7B%22reference%22%3A%22P2026%2F2476%2FFUL%22%7D"
  )
  assert.equal(
    LONDON_PLANNING_PORTALS["Kensington & Chelsea"].referenceUrl("PP/26/05487"),
    "https://www.rbkc.gov.uk/planningsearch/cases/PP/26/05487"
  )
})

test("unknown authorities resolve to null", () => {
  assert.equal(
    resolvePortalLink({ planningAuthority: "Elmbridge", reference: "1", urlPlanningApp: null }),
    null
  )
})
