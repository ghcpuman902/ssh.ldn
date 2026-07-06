import type { PlanningApplication } from "@/lib/server/planning"

const PLANNING_DATA_GOV_UK_ENTITY_BASE_URL =
  "https://www.planning.data.gov.uk/entity"

/** Councils that publish relative `url_planning_app` paths on their own portal. */
const LPA_PLANNING_PORTAL_BASE: Record<string, string> = {
  Hackney: "https://developmentandhousing.hackney.gov.uk",
}

const LPA_REFERENCE_SEARCH_URL: Record<string, (reference: string) => string> = {
  Islington: (reference) =>
    `https://planning.islington.gov.uk/publicaccess/search.do?action=simple&searchType=Application&searchCriteria.reference=${encodeURIComponent(reference)}`,
  Camden: (reference) =>
    `https://camdocs.camden.gov.uk/online-applications/search.do?action=simple&searchType=Application&searchCriteria.reference=${encodeURIComponent(reference)}`,
  Westminster: (reference) =>
    `https://idoxpa.westminster.gov.uk/online-applications/search.do?action=simple&searchType=Application&searchCriteria.reference=${encodeURIComponent(reference)}`,
}

/** Council planning register landing pages when no direct application URL exists. */
const LPA_PLANNING_FALLBACK_URL: Record<string, string> = {
  Islington: "https://www.islington.gov.uk/planning/applications/comment",
  Camden: "https://www.camden.gov.uk/planning-applications",
  Westminster: "https://www.westminster.gov.uk/planning-building-control-and-environmental-regulations/planning-applications",
  "Tower Hamlets":
    "https://development.towerhamlets.gov.uk/online-applications/search.do?action=simple&searchType=Application",
  Hackney: "https://developmentandhousing.hackney.gov.uk/planning/index.html",
}

export type PlanningApplicationLinkInput = Pick<
  PlanningApplication,
  | "source"
  | "applicationId"
  | "reference"
  | "description"
  | "status"
  | "decisionType"
  | "applicationTypeFull"
  | "developmentType"
  | "decisionDate"
  | "distanceMeters"
  | "planningAuthority"
  | "urlPlanningApp"
>

const resolveRelativePlanningUrl = (
  urlPlanningApp: string,
  planningAuthority: string | null
) => {
  if (!planningAuthority) {
    return null
  }

  const base = LPA_PLANNING_PORTAL_BASE[planningAuthority]
  if (!base) {
    return null
  }

  return `${base}${urlPlanningApp.startsWith("/") ? "" : "/"}${urlPlanningApp}`
}

const hasDirectPlanningApplicationUrl = (
  application: PlanningApplicationLinkInput
) => {
  if (!application.urlPlanningApp) {
    return false
  }

  if (/^https?:\/\//i.test(application.urlPlanningApp)) {
    return /getApplication|applicationDetails\.do/i.test(application.urlPlanningApp)
  }

  return /getApplication|applicationDetails\.do/i.test(application.urlPlanningApp)
}

const getPlanningLinkPriority = (application: PlanningApplicationLinkInput) => {
  if (hasDirectPlanningApplicationUrl(application)) {
    return 0
  }

  if (
    application.source === "planning.data.gov.uk" &&
    application.applicationId
  ) {
    return 1
  }

  if (resolvePlanningApplicationUrl(application)) {
    return 2
  }

  return 3
}

export type PlanningLinkKind = "direct" | "entity" | "portal"

export const getPlanningLinkKind = (
  application: PlanningApplicationLinkInput
): PlanningLinkKind | null => {
  if (hasDirectPlanningApplicationUrl(application)) {
    return "direct"
  }

  if (
    application.source === "planning.data.gov.uk" &&
    application.applicationId
  ) {
    return "entity"
  }

  if (resolvePlanningApplicationUrl(application)) {
    return "portal"
  }

  return null
}

export const getPlanningLinkLabel = (
  application: Pick<
    PlanningApplicationLinkInput,
    "reference" | "planningAuthority" | "description"
  >,
  linkKind: PlanningLinkKind | null
) => {
  const reference = application.reference?.trim()
  const council = application.planningAuthority?.trim()
  const subject = reference ?? application.description?.slice(0, 80) ?? "planning application"

  if (linkKind === "direct") {
    return council
      ? `Open ${subject} on ${council} planning register`
      : `Open ${subject} on council planning register`
  }

  if (linkKind === "entity") {
    return `View ${subject} on planning.data.gov.uk`
  }

  if (linkKind === "portal") {
    return council
      ? `Search ${subject} on ${council} planning register`
      : `Search ${subject} on council planning register`
  }

  return subject
}

export const resolvePlanningApplicationUrl = (
  application: PlanningApplicationLinkInput
): string | null => {
  if (application.urlPlanningApp) {
    if (/^https?:\/\//i.test(application.urlPlanningApp)) {
      return application.urlPlanningApp
    }

    const relativeUrl = resolveRelativePlanningUrl(
      application.urlPlanningApp,
      application.planningAuthority
    )
    if (relativeUrl) {
      return relativeUrl
    }
  }

  if (
    application.source === "planning.data.gov.uk" &&
    application.applicationId
  ) {
    return `${PLANNING_DATA_GOV_UK_ENTITY_BASE_URL}/${application.applicationId}`
  }

  if (application.reference && application.planningAuthority) {
    const searchUrl = LPA_REFERENCE_SEARCH_URL[application.planningAuthority]
    if (searchUrl) {
      return searchUrl(application.reference)
    }
  }

  if (application.planningAuthority) {
    return LPA_PLANNING_FALLBACK_URL[application.planningAuthority] ?? null
  }

  return null
}

export const presentPlanningApplications = (
  applications: PlanningApplication[],
  limit = 5
) =>
  [...applications]
    .sort((a, b) => {
      const linkPriorityDelta =
        getPlanningLinkPriority(a) - getPlanningLinkPriority(b)
      if (linkPriorityDelta !== 0) {
        return linkPriorityDelta
      }

      const aDistance = a.distanceMeters ?? Number.POSITIVE_INFINITY
      const bDistance = b.distanceMeters ?? Number.POSITIVE_INFINITY
      return aDistance - bDistance
    })
    .slice(0, limit)
    .map((application) => ({
      applicationId: application.applicationId,
      reference: application.reference,
      description: application.description,
      status: application.status,
      decisionType: application.decisionType,
      applicationTypeFull: application.applicationTypeFull,
      developmentType: application.developmentType,
      decisionDate: application.decisionDate,
      distanceMeters: application.distanceMeters,
      planningAuthority: application.planningAuthority,
      url: resolvePlanningApplicationUrl(application),
      linkKind: getPlanningLinkKind(application),
    }))
