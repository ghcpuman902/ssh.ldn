import type { SearchSuggestion } from "@/lib/map/search-suggestions";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

type NominatimSearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  addresstype?: string;
  address?: {
    name?: string;
    amenity?: string;
    building?: string;
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    postcode?: string;
  };
};

const LONDON_VIEWBOX = "-0.52,51.72,0.24,51.28";

const compactDisplayName = (result: NominatimSearchResult) => {
  const address = result.address;
  const primary =
    address?.name ??
    address?.amenity ??
    address?.building ??
    result.display_name.split(",")[0]?.trim() ??
    result.display_name;
  const area = address?.suburb ?? address?.city ?? address?.town;
  const postcode = address?.postcode;
  const context = [area, postcode].filter(Boolean).join(", ");

  return context ? `${primary}, ${context}` : primary;
};

const toLocationSuggestion = (
  result: NominatimSearchResult
): SearchSuggestion => ({
  id: `nominatim:${result.place_id}`,
  label: compactDisplayName(result),
  address: result.display_name,
  postcode: result.address?.postcode,
  source: "nominatim",
});

export const autocompleteWithNominatim = async (
  query: string
): Promise<SearchSuggestion[]> => {
  const trimmed = query.trim();

  if (trimmed.length < 3) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmed,
    format: "json",
    limit: "6",
    countrycodes: "gb",
    addressdetails: "1",
    viewbox: LONDON_VIEWBOX,
    bounded: "1",
  });

  const response = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ssh.ldn-hackathon-discovery/0.1 (local dev)",
    },
    next: { revalidate: 0 },
  });

  const data = (await response.json()) as NominatimSearchResult[];

  if (!response.ok || !Array.isArray(data)) {
    return [];
  }

  return data.map(toLocationSuggestion);
};
