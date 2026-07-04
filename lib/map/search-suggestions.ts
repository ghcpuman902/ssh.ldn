import { TEST_POINTS } from "@/lib/test-points";

export type SearchSuggestion = {
  id: string;
  label: string;
  address: string;
  testPointId?: string;
  postcode?: string;
  source: "preset" | "postcodes.io" | "nominatim";
};

export const PRESET_SEARCH_SUGGESTIONS: SearchSuggestion[] = TEST_POINTS.map(
  (point) => ({
    id: `preset:${point.id}`,
    label: point.address,
    address: point.address,
    testPointId: point.id,
    source: "preset",
  })
);

export const filterPresetSuggestions = (query: string): SearchSuggestion[] => {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return PRESET_SEARCH_SUGGESTIONS;
  }

  return PRESET_SEARCH_SUGGESTIONS.filter((suggestion) =>
    suggestion.label.toLowerCase().includes(normalized)
  );
};

export const mergeSearchSuggestions = (
  presets: SearchSuggestion[],
  postcodes: SearchSuggestion[],
  locations: SearchSuggestion[] = []
): SearchSuggestion[] => {
  const seen = new Set<string>();
  const merged: SearchSuggestion[] = [];

  for (const suggestion of [...presets, ...locations, ...postcodes]) {
    const key = suggestion.address.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    merged.push(suggestion);
  }

  return merged.slice(0, 8);
};
