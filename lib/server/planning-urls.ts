import type { PlanningApplication } from "@/lib/server/planning"
import {
  getPlanningPortal,
  resolvePortalLink,
} from "@/lib/server/planning-portals"

const PLANNING_DATA_GOV_UK_ENTITY_BASE_URL =
  "https://www.planning.data.gov.uk/entity"

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

/**
 * - `direct`: opens the application, or a results page holding only it.
 * - `entity`: the national record on planning.data.gov.uk.
 * - `portal`: the council's search page only; the reference has to be typed in.
 */
export type PlanningLinkKind = "direct" | "entity" | "portal"

type ResolvedPlanningLink = { url: string; kind: PlanningLinkKind }

const resolvePlanningLink = (
  application: PlanningApplicationLinkInput
): ResolvedPlanningLink | null => {
  // London authorities: only links checked in planning-portals.ts.
  if (getPlanningPortal(application.planningAuthority)) {
    const link = resolvePortalLink(application)
    if (link) {
      return { url: link.url, kind: link.kind === "direct" ? "direct" : "portal" }
    }
  }

  if (
    application.source === "planning.data.gov.uk" &&
    application.applicationId
  ) {
    return {
      url: `${PLANNING_DATA_GOV_UK_ENTITY_BASE_URL}/${application.applicationId}`,
      kind: "entity",
    }
  }

  if (
    application.urlPlanningApp &&
    /^https:\/\/[^\s<>]+$/i.test(application.urlPlanningApp.trim())
  ) {
    return { url: application.urlPlanningApp.trim(), kind: "direct" }
  }

  return null
}

const LINK_PRIORITY: Record<PlanningLinkKind, number> = {
  direct: 0,
  entity: 1,
  portal: 2,
}

const getPlanningLinkPriority = (application: PlanningApplicationLinkInput) => {
  const link = resolvePlanningLink(application)
  return link ? LINK_PRIORITY[link.kind] : 3
}

export const getPlanningLinkKind = (
  application: PlanningApplicationLinkInput
): PlanningLinkKind | null => resolvePlanningLink(application)?.kind ?? null

export const resolvePlanningApplicationUrl = (
  application: PlanningApplicationLinkInput
): string | null => resolvePlanningLink(application)?.url ?? null

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
      ? `Open the ${council} planning search page and search for ${subject}`
      : `Open the council planning search page and search for ${subject}`
  }

  return subject
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
    .map((application) => {
      const link = resolvePlanningLink(application)
      return {
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
        url: link?.url ?? null,
        linkKind: link?.kind ?? null,
      }
    })
