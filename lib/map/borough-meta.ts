export type BoroughMeta = {
  slug: string
  name: string
  initials: string
  accentClassName: string
  logoSrc: string | null
}

const borough = (
  slug: string,
  name: string,
  initials: string,
  accentClassName: string,
  logoFile?: string
): BoroughMeta => ({
  slug,
  name,
  initials,
  accentClassName,
  logoSrc: logoFile ? `/boroughs/${logoFile}` : null,
})

/** Council wordmark served from /public/boroughs (see scripts/download-borough-logos.mjs). */
const logo = (slug: string) => `${slug}-logo.svg`

/** Maps Planning London Datahub `lpa_name` and variants to borough branding. */
export const BOROUGH_BY_PLANNING_AUTHORITY: Record<string, BoroughMeta> = {
  Hackney: borough(
    "hackney",
    "Hackney",
    "H",
    "bg-amber-400 text-foreground",
    logo("hackney")
  ),
  "Tower Hamlets": borough(
    "tower-hamlets",
    "Tower Hamlets",
    "TH",
    "bg-emerald-700 text-white",
    logo("tower-hamlets")
  ),
  Islington: borough(
    "islington",
    "Islington",
    "I",
    "bg-sky-800 text-white",
    logo("islington")
  ),
  Camden: borough(
    "camden",
    "Camden",
    "C",
    "bg-indigo-900 text-white",
    logo("camden")
  ),
  Westminster: borough(
    "westminster",
    "Westminster",
    "W",
    "bg-purple-900 text-white",
    logo("westminster")
  ),
  "Waltham Forest": borough(
    "waltham-forest",
    "Waltham Forest",
    "WF",
    "bg-lime-800 text-white",
    logo("waltham-forest")
  ),
  "Kensington & Chelsea": borough(
    "kensington-chelsea",
    "Kensington & Chelsea",
    "KC",
    "bg-rose-900 text-white",
    logo("kensington-chelsea")
  ),
  "Kensington and Chelsea": borough(
    "kensington-chelsea",
    "Kensington & Chelsea",
    "KC",
    "bg-rose-900 text-white",
    logo("kensington-chelsea")
  ),
  Lewisham: borough(
    "lewisham",
    "Lewisham",
    "L",
    "bg-teal-800 text-white",
    logo("lewisham")
  ),
  Southwark: borough(
    "southwark",
    "Southwark",
    "S",
    "bg-violet-800 text-white",
    logo("southwark")
  ),
  Greenwich: borough(
    "greenwich",
    "Greenwich",
    "G",
    "bg-emerald-800 text-white",
    logo("greenwich")
  ),
  Lambeth: borough(
    "lambeth",
    "Lambeth",
    "Lb",
    "bg-red-800 text-white",
    logo("lambeth")
  ),
  Croydon: borough(
    "croydon",
    "Croydon",
    "Cr",
    "bg-slate-800 text-white",
    logo("croydon")
  ),
  Brent: borough(
    "brent",
    "Brent",
    "Br",
    "bg-blue-900 text-white",
    logo("brent")
  ),
  Ealing: borough(
    "ealing",
    "Ealing",
    "Ea",
    "bg-green-800 text-white",
    logo("ealing")
  ),
  Hounslow: borough(
    "hounslow",
    "Hounslow",
    "Ho",
    "bg-cyan-900 text-white",
    logo("hounslow")
  ),
  Hillingdon: borough(
    "hillingdon",
    "Hillingdon",
    "Hi",
    "bg-stone-700 text-white",
    logo("hillingdon")
  ),
  Harrow: borough(
    "harrow",
    "Harrow",
    "Ha",
    "bg-blue-800 text-white",
    logo("harrow")
  ),
  Barnet: borough(
    "barnet",
    "Barnet",
    "Ba",
    "bg-sky-900 text-white",
    logo("barnet")
  ),
  Enfield: borough(
    "enfield",
    "Enfield",
    "En",
    "bg-indigo-800 text-white",
    logo("enfield")
  ),
  Haringey: borough(
    "haringey",
    "Haringey",
    "Hg",
    "bg-fuchsia-900 text-white",
    "haringey-logo.png"
  ),
  "Hammersmith & Fulham": borough(
    "hammersmith-fulham",
    "Hammersmith & Fulham",
    "HF",
    "bg-slate-900 text-white",
    logo("hammersmith-fulham")
  ),
  "Hammersmith and Fulham": borough(
    "hammersmith-fulham",
    "Hammersmith & Fulham",
    "HF",
    "bg-slate-900 text-white",
    logo("hammersmith-fulham")
  ),
  "Richmond upon Thames": borough(
    "richmond-thames",
    "Richmond upon Thames",
    "R",
    "bg-teal-900 text-white",
    logo("richmond-thames")
  ),
  Kingston: borough(
    "kingston",
    "Kingston",
    "K",
    "bg-blue-950 text-white",
    logo("kingston")
  ),
  "Kingston upon Thames": borough(
    "kingston",
    "Kingston",
    "K",
    "bg-blue-950 text-white",
    logo("kingston")
  ),
  Merton: borough(
    "merton",
    "Merton",
    "M",
    "bg-emerald-950 text-white",
    logo("merton")
  ),
  Sutton: borough(
    "sutton",
    "Sutton",
    "Su",
    "bg-green-900 text-white",
    logo("sutton")
  ),
  Bromley: borough(
    "bromley",
    "Bromley",
    "Bro",
    "bg-amber-900 text-white",
    logo("bromley")
  ),
  Bexley: borough(
    "bexley",
    "Bexley",
    "Bx",
    "bg-orange-900 text-white",
    logo("bexley")
  ),
  "Barking & Dagenham": borough(
    "barking-dagenham",
    "Barking & Dagenham",
    "BD",
    "bg-red-900 text-white",
    logo("barking-dagenham")
  ),
  "Barking and Dagenham": borough(
    "barking-dagenham",
    "Barking & Dagenham",
    "BD",
    "bg-red-900 text-white",
    logo("barking-dagenham")
  ),
  "City of London": borough(
    "city-of-london",
    "City of London",
    "CoL",
    "bg-zinc-900 text-white",
    logo("city-of-london")
  ),
  Newham: borough(
    "newham",
    "Newham",
    "N",
    "bg-orange-800 text-white",
    logo("newham")
  ),
  Redbridge: borough(
    "redbridge",
    "Redbridge",
    "Rb",
    "bg-red-800 text-white",
    "redbridge-logo.png"
  ),
  Havering: borough(
    "havering",
    "Havering",
    "Hv",
    "bg-green-950 text-white",
    logo("havering")
  ),
  Wandsworth: borough(
    "wandsworth",
    "Wandsworth",
    "W",
    "bg-blue-900 text-white",
    logo("wandsworth")
  ),
  "London Planning Datahub": borough(
    "london",
    "London",
    "LDN",
    "bg-primary text-primary-foreground"
  ),
  "planning.data.gov.uk": borough(
    "england",
    "England",
    "UK",
    "bg-muted text-muted-foreground"
  ),
}

const normalizePlanningAuthority = (planningAuthority: string | null | undefined) =>
  planningAuthority?.replace(/\s+/g, " ").trim() ?? ""

export const getBoroughMeta = (
  planningAuthority: string | null | undefined
): BoroughMeta => {
  const normalized = normalizePlanningAuthority(planningAuthority)
  if (!normalized) {
    return borough("unknown", "Unknown borough", "?", "bg-muted text-muted-foreground")
  }

  return (
    BOROUGH_BY_PLANNING_AUTHORITY[normalized] ??
    borough(
      normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      normalized,
      normalized
        .split(/\s+/)
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      "bg-muted text-foreground"
    )
  )
}

export const resolvePrimaryBorough = (
  planningAuthorities: Array<string | null | undefined>
) => {
  const counts = new Map<string, number>()

  for (const authority of planningAuthorities) {
    const normalized = normalizePlanningAuthority(authority)
    if (!normalized) {
      continue
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }

  const [topAuthority] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? []

  return topAuthority ? getBoroughMeta(topAuthority) : null
}
