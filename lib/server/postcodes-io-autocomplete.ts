import { extractUkPostcode } from "@/lib/server/geocode-types";

type PostcodesAutocompleteSuggestion = {
  id: string;
  label: string;
  address: string;
  postcode?: string;
  source: "postcodes.io";
};

const POSTCODES_IO_BASE = "https://api.postcodes.io";

type PostcodesAutocompleteResponse = {
  status: number;
  result: string[] | null;
  error?: string;
};

type PostcodesQueryResponse = {
  status: number;
  result: Array<{
    postcode: string;
    admin_district: string | null;
  }> | null;
  error?: string;
};

const toPostcodeSuggestion = (
  postcode: string,
  adminDistrict?: string | null
): PostcodesAutocompleteSuggestion => ({
  id: `postcode:${postcode.replace(/\s+/g, "")}`,
  label: adminDistrict ? `${postcode}, ${adminDistrict}` : postcode,
  address: postcode,
  postcode,
  source: "postcodes.io",
});

export const autocompleteWithPostcodesIo = async (
  query: string
): Promise<PostcodesAutocompleteSuggestion[]> => {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const compact = trimmed.replace(/\s+/g, "").toUpperCase();
  const postcodeMatch = extractUkPostcode(trimmed);

  if (postcodeMatch) {
    const encoded = encodeURIComponent(postcodeMatch.replace(/\s+/g, ""));
    const response = await fetch(
      `${POSTCODES_IO_BASE}/postcodes/${encoded}/autocomplete`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 0 },
      }
    );

    const data = (await response.json()) as PostcodesAutocompleteResponse;

    if (!response.ok || !data.result?.length) {
      return [toPostcodeSuggestion(postcodeMatch)];
    }

    return data.result.map((postcode) => toPostcodeSuggestion(postcode));
  }

  const response = await fetch(
    `${POSTCODES_IO_BASE}/postcodes/${encodeURIComponent(compact)}/autocomplete`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    }
  );

  const data = (await response.json()) as PostcodesAutocompleteResponse;

  if (response.ok && data.result?.length) {
    return data.result.map((postcode) => toPostcodeSuggestion(postcode));
  }

  const queryResponse = await fetch(
    `${POSTCODES_IO_BASE}/postcodes?q=${encodeURIComponent(trimmed)}&limit=6`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    }
  );

  const queryData = (await queryResponse.json()) as PostcodesQueryResponse;

  if (!queryResponse.ok || !queryData.result?.length) {
    return [];
  }

  return queryData.result.map((item) =>
    toPostcodeSuggestion(item.postcode, item.admin_district)
  );
};
