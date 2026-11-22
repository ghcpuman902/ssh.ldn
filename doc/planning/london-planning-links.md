# London planning links: what deep-links and what does not

Checked 22 Nov 2026 for the ssh-ldn analyse sheet (COMPLAINTS: Tower Hamlets
planning link broken). Code: `lib/server/planning-portals.ts`, test
`lib/server/planning-portals.test.mjs`. Raw probe output lives in
`_agent/planning/` (`verify.json`, `probe1.json`, `lpa-samples.json`).

## Summary

- 36 authorities: 32 boroughs, the City, LLDC, OPDC, OSDC (the datahub's `lpa_name` values).
- **27 deep-link by reference**: a URL built from the council reference opens the
  application, or a results page with only it.
- **7 deep-link only through the datahub URL** (pages keyed by an internal id).
- **2 search page only**: Bromley (Arcus, no ids published) and LLDC (no longer a planning
  authority since 1 Dec 2024; we open Newham's search).
- Of the 33 borough authorities (32 + City): 26 by reference, 6 via datahub URL only
  (Tascomi x5, Haringey), 1 search page only (Bromley). Kingston and Sutton have working
  reference links but their search takes 1-2 minutes, so their fast datahub URLs go first.
- 8 councils put a human check in front of the portal (Camden, Hackney, Harrow, Merton,
  Waltham Forest, Barking and Dagenham, Hounslow, Hammersmith and Fulham). People pass it in a
  browser; curl and headless Chrome cannot, so those links are checked by URL shape and the
  datahub's own URLs, not by page content.
- No authority supports a deep link by postcode, coordinates or UPRN into the application
  page. Idox simple search accepts a postcode and returns a results list (checked for every
  Idox borough), but we link by reference because it lands on the one application.

## What broke Tower Hamlets

The London Planning Datahub publishes `url_planning_app` for Tower Hamlets as
`applicationDetails.do?keyVal=DCAPR150841`. The portal's key is `DCAPR_150841`, so the page
answered HTTP 200 with the title "Error" ("A remote exception occurred"). The old code trusted
any `applicationDetails.do` URL as a direct link. It now builds the Idox reference search
(`simpleSearchResults.do?...simpleSearchString=PA/26/00972`), which lands on the application
even when the datahub reference lacks the portal's `/S` suffix.

## Single sources

- **planning.data.gov.uk**: the `planning-application` dataset is alpha with 0 entities
  (`/dataset/planning-application.json`), and a point query at the test address returns none.
  Not usable for links.
- **London Planning Datahub** (`planningdata.london.gov.uk/api-guest`): one consistent API for
  nearby applications across all authorities (we already use it), but `url_planning_app` is
  unreliable: placeholders for Islington, Lambeth, Enfield, Redbridge; a broken key for Tower
  Hamlets; dead hosts for Wandsworth; missing for Westminster, Barnet, K&C, Croydon, Bromley,
  Newham, Bexley, LLDC. So the per-council table decides the link and the datahub URL is only
  used where it is known good.

## Per authority

Result = what a real request returned for a live application in that authority.

| Authority (datahub name) | System | Deep link | Sample ref | Result |
|---|---|---|---|---|
| Barking & Dagenham | Tascomi | datahub URL only (human check) | 26/01384/CLUP | "Let's confirm you are human" (AWS WAF) |
| Barnet | Idox Public Access | by reference | 26/4080/HSE | search ok; link ok+ref "26/4080/HSE | Alterations to the existing sin" |
| Bexley | Idox Public Access | by reference | 26/00139/FUL01 | search ok; link ok+ref "26/00139/FUL01 | Application to approve detai" |
| Brent | Idox Public Access | by reference | 26/2282 | search ok; link ok+ref "26/2282 | Demolition of existing single store" |
| Bromley | Arcus (Salesforce) | search page only | 22/03337/FULL1 | search page 200 "Home"; no per-application URL (Salesforce ids, none in datahub) |
| Camden | Northgate Planning Explorer | by reference (human check) | 2026/4256/P | Cloudflare "Just a moment..." (403) for curl and headless Chrome |
| City of London | Idox Public Access | by reference | 26/01578/ADVT | search ok; link ok+ref "26/01578/ADVT | Replacement of 8.no fascia si" |
| Croydon | Idox Public Access | by reference | 26/02879/GPDO | search ok; link ok+ref "26/02879/GPDO | Demolition of the existing re" |
| Ealing | Idox Public Access | by reference | 263749NMA | search ok; link ok+ref "263749NMA | Application for a Non-Material Am" |
| Enfield | Idox Public Access | by reference | 26/04810/HOU | search ok; link ok+ref "26/04810/HOU | Single storey wraparound exten" |
| Greenwich | Idox Public Access | by reference | 26/3353/PN1 | search ok; link ok+ref "26/3353/PN1 | Prior Approval for the construc" |
| Hackney | Tascomi | datahub URL only (human check) | 2026/2169 | "Let's confirm you are human" (AWS WAF) for curl and headless Chrome |
| Hammersmith & Fulham | NEC (Northgate) Online Planning | by reference (human check) | P/2026/01736/DET | search 200; detail "Check if Human page" |
| Haringey | Arcus (Salesforce) | datahub URL only | HGY/2026/2816 | browser: "Planning Application: HGY/2026/2816" (datahub URL) |
| Harrow | Tascomi | datahub URL only (human check) | PL/2414/26 | "Let's confirm you are human" (AWS WAF) |
| Havering | Ocella | by reference | Z0004.26 | search ok; link ok+ref "OcellaWeb" |
| Hillingdon | Ocella | by reference | 996/APP/2026/1942 | search ok; link ok+ref "London Borough of Hillingdon - Planning" |
| Hounslow | NEC (Northgate) Online Planning | by reference (human check) | PA/2026/2996 | "UnsupportedWebBrowser" / "Check if Human page" |
| Islington | Agile Applications | by reference | P2026/2476/FUL | browser: "1 of 1 results"; Agile API total=1 |
| Kensington & Chelsea | RBKC own portal | by reference | PP/26/05487 | browser: case page title "PP/26/05487 Application" |
| Kingston | Idox Public Access | by reference (datahub URL first) | 26/02405/TPO | datahub detail URL 200 in 2 s, title has ref; ref search 200 but 120 s; search page timed out |
| Lambeth | Idox Public Access | by reference | 26/03398/LDCP | search ok; link ok+ref "26/03398/LDCP | Certifictae of lawfulness (pr" |
| Lewisham | Idox Public Access | by reference | DC/26/145580 | search ok; link ok+ref "DC/26/145580 | Schedule 1 application for alt" |
| Merton | Tascomi | datahub URL only (human check) | 26/LDCP/2296 | "Let's confirm you are human" (AWS WAF) |
| Newham | Idox Public Access | by reference | 26/02354/AOD | search ok; link ok+ref "26/02354/AOD | Application for approval of de" |
| Redbridge | Agile Applications | by reference | 2798/26 | browser: "1 of 1 results"; Agile API total=1 |
| Richmond | Agile Applications | by reference | PA26/3214 | browser: "1 of 1 results"; Agile API total=1 |
| Southwark | Idox Public Access | by reference | 26/AP/3324 | search ok; link ok+ref "26/AP/3324 | Installation of four logos on th" |
| Sutton | Idox Public Access | by reference (datahub URL first) | DM2026/01046 | datahub detail URL 200 in 2 s, title has ref; ref search timed out at 60 s; search.do redirects to the council page |
| Tower Hamlets | Idox Public Access | by reference | PA/26/01428/S | search ok; link ok+ref "PA/26/01428/S | Application for Non-Material " |
| Waltham Forest | Tascomi | datahub URL only (human check) | 262342 | "Let's confirm you are human" (AWS WAF) |
| Wandsworth | Agile Applications | by reference | 2025/3436 | browser: "1 of 1 results"; Agile API total=1 |
| Westminster | Idox Public Access | by reference | 26/07775/FULL | search ok; link ok+ref "26/07775/FULL | Replacement of existing singl" |
| LLDC | Idox Public Access | search page only | 20/00482/REM | old register 404/offline; old refs (20/00482/REM) give 500 on Newham and TH Idox; Newham search page 200 |
| OPDC | Agile Applications | by reference | 26/0208/AODOPDC | browser: "1 of 1 results"; Agile API total=1 |
| OSDC | Arcus (Salesforce) | datahub URL only | PA/2026/0050 | HTTP 200 "Public Register" (datahub URL, Salesforce page) |

## Notes per system

- **Idox**: `simpleSearchResults.do?action=firstPage&searchType=Application&searchCriteria.simpleSearchString=<ref>&searchCriteria.simpleSearch=true`
  works as GET without a CSRF token. One hit redirects to the application.
- **Agile Applications** (Islington, Redbridge, Richmond, Wandsworth, OPDC):
  `/<client>/search-applications/results?criteria={"reference":"<ref>"}`. The page is an
  Angular app, so the check used a browser plus the public API
  (`planningapi.agileapplications.co.uk/api/application/search?reference=` with the
  `x-client` code from `identity.agileapplications.co.uk/api/client/get?url=<client>`).
- **Ocella** (Hillingdon, Havering): `OcellaWeb/planningDetails?reference=<ref>`.
- **Tascomi** (Hackney, Harrow, Merton, Waltham Forest, Barking and Dagenham):
  `planning/index.html?fa=getApplication&id=<internal id>`; only the datahub has the id. We
  strip the datahub's double slash.
- **NEC** (Hounslow, H&F): `OnlinePlanningOverview?applicationNumber=<ref>`.
- **Northgate** (Camden): `DisplayAppDetails.aspx?AppNo=<ref>`.
- **RBKC**: `rbkc.gov.uk/planningsearch/cases/<ref>` (slashes kept).
- **Arcus** (Haringey, OSDC, Bromley): Salesforce ids; Haringey and OSDC publish them to the
  datahub, Bromley does not.
