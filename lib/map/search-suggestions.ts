import type { PlaceSuggestion } from "@/lib/map/google-places";

export type SearchSuggestion = {
  id: string;
  label: string;
  address: string;
  placeId?: string;
  postcode?: string;
  source: "google-places" | "recent";
};

export const placeSuggestionsToSearchSuggestions = (
  suggestions: PlaceSuggestion[]
): SearchSuggestion[] =>
  suggestions.map((suggestion) => ({
    ...suggestion,
    source: "google-places" as const,
  }));

export const mergeSearchSuggestions = (
  recent: SearchSuggestion[],
  places: SearchSuggestion[]
): SearchSuggestion[] => {
  const seen = new Set<string>();
  const merged: SearchSuggestion[] = [];

  for (const suggestion of [...recent, ...places]) {
    const key = suggestion.placeId ?? suggestion.address.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    merged.push(suggestion);
  }

  return merged.slice(0, 8);
};
