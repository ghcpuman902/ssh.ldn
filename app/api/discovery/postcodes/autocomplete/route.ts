import { type NextRequest } from "next/server";

import {
  filterPresetSuggestions,
  mergeSearchSuggestions,
} from "@/lib/map/search-suggestions";
import { autocompleteWithNominatim } from "@/lib/server/nominatim-autocomplete";
import { autocompleteWithPostcodesIo } from "@/lib/server/postcodes-io-autocomplete";

export const GET = async (request: NextRequest) => {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const presets = filterPresetSuggestions(query);

  if (query.trim().length < 2) {
    return Response.json({
      query,
      suggestions: presets,
    });
  }

  const [postcodesResult, locationsResult] = await Promise.allSettled([
    autocompleteWithPostcodesIo(query),
    autocompleteWithNominatim(query),
  ]);

  const postcodes =
    postcodesResult.status === "fulfilled" ? postcodesResult.value : [];
  const locations =
    locationsResult.status === "fulfilled" ? locationsResult.value : [];
  const errors = [
    postcodesResult.status === "rejected"
      ? `Postcodes.io: ${
          postcodesResult.reason instanceof Error
            ? postcodesResult.reason.message
            : "autocomplete failed"
        }`
      : null,
    locationsResult.status === "rejected"
      ? `Nominatim: ${
          locationsResult.reason instanceof Error
            ? locationsResult.reason.message
            : "autocomplete failed"
        }`
      : null,
  ].filter(Boolean);

  return Response.json({
    query,
    suggestions: mergeSearchSuggestions(presets, postcodes, locations),
    ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
  });
};
