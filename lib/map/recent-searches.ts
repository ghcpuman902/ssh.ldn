import type { SearchSuggestion } from "@/lib/map/search-suggestions";

const STORAGE_KEY = "ssh.ldn.recent-searches";
const MAX_RECENT = 8;

export type RecentSearchEntry = {
  id: string;
  label: string;
  address: string;
  placeId?: string;
  searchedAt: number;
};

const readStorage = (): RecentSearchEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as RecentSearchEntry[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry) =>
        typeof entry.id === "string" &&
        typeof entry.label === "string" &&
        typeof entry.address === "string"
    );
  } catch {
    return [];
  }
};

export const readRecentSearches = (): RecentSearchEntry[] =>
  readStorage()
    .sort((left, right) => right.searchedAt - left.searchedAt)
    .slice(0, MAX_RECENT);

export const pushRecentSearch = (entry: {
  label: string;
  address: string;
  placeId?: string;
}): RecentSearchEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const id = entry.placeId ?? entry.address.toLowerCase();
  const nextEntry: RecentSearchEntry = {
    id,
    label: entry.label,
    address: entry.address,
    placeId: entry.placeId,
    searchedAt: Date.now(),
  };

  const deduped = readStorage().filter((item) => item.id !== id);
  const next = [nextEntry, ...deduped].slice(0, MAX_RECENT);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  return next;
};

export const recentSearchesToSuggestions = (
  entries: RecentSearchEntry[]
): SearchSuggestion[] =>
  entries.map((entry) => ({
    id: `recent:${entry.id}`,
    label: entry.label,
    address: entry.address,
    placeId: entry.placeId,
    source: "recent",
  }));
