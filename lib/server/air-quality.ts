import { haversineMeters } from "@/lib/server/geo";

export type AirQualityInput = {
  lat: number;
  lng: number;
  radiusMeters?: number;
};

type MonitoringSite = {
  siteCode: string;
  siteName: string;
  siteType: string;
  latitude: number;
  longitude: number;
  localAuthorityName: string;
  dateClosed?: string;
};

const parseMonitoringSites = (payload: {
  Sites?: { Site?: Array<Record<string, string>> | Record<string, string> };
}) => {
  const rawSites = payload.Sites?.Site;
  const sites = Array.isArray(rawSites)
    ? rawSites
    : rawSites
      ? [rawSites]
      : [];

  return sites
    .map((site) => ({
      siteCode: site["@SiteCode"],
      siteName: site["@SiteName"],
      siteType: site["@SiteType"],
      latitude: Number(site["@Latitude"]),
      longitude: Number(site["@Longitude"]),
      localAuthorityName: site["@LocalAuthorityName"],
      dateClosed: site["@DateClosed"] || undefined,
    }))
    .filter(
      (site) =>
        Boolean(site.siteCode) &&
        Number.isFinite(site.latitude) &&
        Number.isFinite(site.longitude)
    ) as MonitoringSite[];
};

export const getNearbyAirQualitySites = async ({
  lat,
  lng,
  radiusMeters = 2000,
}: AirQualityInput) => {
  const response = await fetch(
    "https://api.erg.ic.ac.uk/AirQuality/Information/MonitoringSites/GroupName=London/Json",
    {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(12_000),
    }
  );

  if (!response.ok) {
    throw new Error(`London Air API request failed (${response.status})`);
  }

  const payload = await response.json();
  const sites = parseMonitoringSites(payload)
    .filter((site) => !site.dateClosed)
    .map((site) => ({
      ...site,
      distanceMeters: Math.round(
        haversineMeters(lat, lng, site.latitude, site.longitude)
      ),
    }))
    .filter((site) => site.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 10);

  return {
    source: "london-air",
    sourceEndpoint: "api.erg.ic.ac.uk/AirQuality/Information/MonitoringSites",
    sourceLicence: "Imperial College London ERG / London Air",
    sourceVersion: "LAQN monitoring site directory",
    retrievedAt: new Date().toISOString(),
    latitude: lat,
    longitude: lng,
    radiusMeters,
    siteCount: sites.length,
    sites,
    warnings:
      sites.length === 0
        ? ["No active LAQN monitoring sites within radius."]
        : ["Air quality is contextual enrichment only; not used in core noise score."],
  };
};
