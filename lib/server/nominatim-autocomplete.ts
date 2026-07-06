type NominatimAutocompleteSuggestion = {
  id: string;
  label: string;
  address: string;
  postcode?: string;
  source: "nominatim";
};

import { nominatimSearch } from "@/lib/server/nominatim-client";

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
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    postcode?: string;
  };
};

import { LONDON_BBOX } from "@/lib/map/config";

const LONDON_VIEWBOX = `${LONDON_BBOX.west},${LONDON_BBOX.north},${LONDON_BBOX.east},${LONDON_BBOX.south}`;

const compactDisplayName = (result: NominatimSearchResult) => {
  const address = result.address;
  const streetLine = [
    address?.house_number,
    address?.road ?? address?.name ?? address?.amenity ?? address?.building,
  ]
    .filter(Boolean)
    .join(" ");
  const primary =
    streetLine ||
    result.display_name.split(",")[0]?.trim() ||
    result.display_name;
  const area = address?.suburb ?? address?.city ?? address?.town;
  const postcode = address?.postcode;
  const context = [area, postcode].filter(Boolean).join(", ");

  return context ? `${primary}, ${context}` : primary;
};

const toLocationSuggestion = (
  result: NominatimSearchResult
): NominatimAutocompleteSuggestion => ({
  id: `nominatim:${result.place_id}`,
  label: compactDisplayName(result),
  address: result.display_name,
  postcode: result.address?.postcode,
  source: "nominatim",
});

export const autocompleteWithNominatim = async (
  query: string
): Promise<NominatimAutocompleteSuggestion[]> => {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmed.includes("London") ? trimmed : `${trimmed}, London`,
    limit: "8",
    countrycodes: "gb",
    addressdetails: "1",
    viewbox: LONDON_VIEWBOX,
    dedupe: "1",
  });

  try {
    const data = (await nominatimSearch(params)) as NominatimSearchResult[];

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(toLocationSuggestion);
  } catch {
    return [];
  }
};
