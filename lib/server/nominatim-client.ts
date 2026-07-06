const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const NOMINATIM_USER_AGENT =
  "ssh.ldn-hackathon-discovery/0.1 (local dev; contact: dev@ssh.ldn)";

/** Nominatim usage policy: max 1 request per second. */
const MIN_REQUEST_INTERVAL_MS = 1100;

let lastRequestAt = 0;
let rateLimitChain: Promise<void> = Promise.resolve();

const waitForRateLimit = (): Promise<void> => {
  rateLimitChain = rateLimitChain.then(async () => {
    const now = Date.now();
    const waitMs = lastRequestAt + MIN_REQUEST_INTERVAL_MS - now;

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    lastRequestAt = Date.now();
  });

  return rateLimitChain;
};

const parseNominatimResponse = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  const trimmed = text.trimStart();
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "Nominatim rate limit exceeded (max 1 request/second); try again shortly"
      );
    }

    throw new Error(`Nominatim request failed (${response.status})`);
  }

  if (
    contentType.includes("xml") ||
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<")
  ) {
    throw new Error(
      "Nominatim returned an unexpected XML response (likely rate-limited or temporarily unavailable)"
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      "Nominatim returned a non-JSON response (likely rate-limited or temporarily unavailable)"
    );
  }
};

export const nominatimSearch = async (
  params: URLSearchParams
): Promise<unknown> => {
  await waitForRateLimit();

  params.set("format", "json");

  const response = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": NOMINATIM_USER_AGENT,
    },
    next: { revalidate: 0 },
  });

  return parseNominatimResponse(response);
};

export const nominatimReverse = async (
  params: URLSearchParams
): Promise<unknown> => {
  await waitForRateLimit();

  params.set("format", "json");

  const response = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": NOMINATIM_USER_AGENT,
    },
    next: { revalidate: 0 },
  });

  return parseNominatimResponse(response);
};
