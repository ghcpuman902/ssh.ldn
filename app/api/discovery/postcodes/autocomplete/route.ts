import { type NextRequest } from "next/server";

import {
  filterPresetSuggestions,
  mergeSearchSuggestions,
} from "@/lib/map/search-suggestions";
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

  try {
    const postcodes = await autocompleteWithPostcodesIo(query);

    return Response.json({
      query,
      suggestions: mergeSearchSuggestions(presets, postcodes),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Postcodes.io autocomplete failed";

    return Response.json(
      {
        query,
        suggestions: presets,
        error: message,
      },
      { status: 502 }
    );
  }
};
