export type PlanningBadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted"
  | "neutral"

export type PlanningApplicationBadge = {
  key: string
  label: string
  tone: PlanningBadgeTone
}

export type PlanningApplicationMetaInput = {
  status: string | null
  decisionType: string | null
  applicationTypeFull: string | null
  developmentType: string | null
  description: string | null
}

const normalizeMetaText = (value: string | null | undefined) =>
  value?.replace(/\s+/g, " ").trim() ?? ""

const BADGE_TONE_CLASS: Record<PlanningBadgeTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-destructive/20 bg-destructive/10 text-destructive",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  muted: "border-border/70 bg-muted text-muted-foreground",
  neutral: "border-border/70 bg-background text-foreground",
}

export const planningBadgeToneClassName = (tone: PlanningBadgeTone) =>
  BADGE_TONE_CLASS[tone]

const shortenApplicationType = (applicationTypeFull: string) => {
  const lower = applicationTypeFull.toLowerCase()

  if (lower.includes("electronic communications") || lower.includes("telecom")) {
    return "Telecom"
  }
  if (lower.includes("non-material")) {
    return "Non-material"
  }
  if (lower.includes("prior approval")) {
    return "Prior approval"
  }
  if (lower.includes("listed building")) {
    return "Listed building"
  }
  if (lower.includes("full planning")) {
    return "Full planning"
  }
  if (lower.includes("householder")) {
    return "Householder"
  }

  const words = applicationTypeFull.split(/\s+/).slice(0, 2)
  return words.join(" ")
}

export const getPlanningStatusBadge = (
  status: string | null,
  decisionType: string | null
): PlanningApplicationBadge | null => {
  const label = normalizeMetaText(status) || normalizeMetaText(decisionType)
  if (!label) {
    return null
  }

  const lower = label.toLowerCase()

  if (/approved|granted|permission granted|completed/.test(lower)) {
    return { key: "status", label, tone: "success" }
  }
  if (/refused|rejected|declined/.test(lower)) {
    return { key: "status", label, tone: "danger" }
  }
  if (/withdrawn|closed|not required|lapsed/.test(lower)) {
    return { key: "status", label, tone: "muted" }
  }
  if (/opinion issued|awaiting|pending|undecided|received|submitted|progress/.test(lower)) {
    return { key: "status", label, tone: "warning" }
  }

  return { key: "status", label, tone: "neutral" }
}

export const getPlanningTypeBadge = (
  applicationTypeFull: string | null,
  developmentType: string | null
): PlanningApplicationBadge | null => {
  const label =
    normalizeMetaText(applicationTypeFull) ||
    normalizeMetaText(developmentType)

  if (!label) {
    return null
  }

  const lower = label.toLowerCase()
  let tone: PlanningBadgeTone = "neutral"

  if (
    lower.includes("electronic communications") ||
    lower.includes("telecom") ||
    lower.includes("demolition") ||
    lower.includes("major")
  ) {
    tone = "warning"
  } else if (lower.includes("non-material") || lower.includes("advert")) {
    tone = "muted"
  } else if (lower.includes("full planning") || lower.includes("prior approval")) {
    tone = "info"
  }

  return {
    key: "type",
    label: shortenApplicationType(label),
    tone,
  }
}

export const getPlanningNoiseImpactBadge = (
  input: PlanningApplicationMetaInput
): PlanningApplicationBadge | null => {
  const relevance = getPlanningNoiseRelevance(input)
  if (relevance === "low") {
    return null
  }

  return {
    key: "noise-impact",
    label: relevance === "high" ? "High noise risk" : "Possible noise",
    tone: relevance === "high" ? "warning" : "info",
  }
}

export type PlanningNoiseRelevance = "low" | "medium" | "high"

export const getPlanningNoiseRelevance = (
  input: PlanningApplicationMetaInput
): PlanningNoiseRelevance => {
  const haystack = [
    input.description,
    input.applicationTypeFull,
    input.developmentType,
    input.decisionType,
  ]
    .map(normalizeMetaText)
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (!haystack) {
    return "low"
  }

  if (
    /antenna|telecom|electronic communications|demolition|piling|excavation|major development|erection of|construction of|new build|extension to/.test(
      haystack
    )
  ) {
    return "high"
  }

  if (
    /non-material|advert|signage|shopfront|window glazing|change of use/.test(
      haystack
    )
  ) {
    return "low"
  }

  if (/full planning|prior approval|householder|extension|alteration/.test(haystack)) {
    return "medium"
  }

  return "low"
}

export const getPlanningApplicationBadges = (
  input: PlanningApplicationMetaInput
): PlanningApplicationBadge[] => {
  const badges: PlanningApplicationBadge[] = []

  const statusBadge = getPlanningStatusBadge(input.status, input.decisionType)
  if (statusBadge) {
    badges.push(statusBadge)
  }

  const typeBadge = getPlanningTypeBadge(
    input.applicationTypeFull,
    input.developmentType
  )
  if (typeBadge) {
    badges.push(typeBadge)
  }

  const noiseBadge = getPlanningNoiseImpactBadge(input)
  if (noiseBadge) {
    badges.push(noiseBadge)
  }

  return badges
}
