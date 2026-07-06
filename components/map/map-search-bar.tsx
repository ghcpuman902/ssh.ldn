"use client"

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { Clock3, Crosshair, Loader2, MapPin, Search, X } from "lucide-react"

import { buildGeocodeResultFromPlace } from "@/lib/map/build-geocode-result"
import {
  createAutocompleteSessionToken,
  fetchPlaceSuggestions,
  hasGooglePlacesClientKey,
  resolvePlacePrediction,
  type ResolvedPlace,
} from "@/lib/map/google-places"
import {
  pushRecentSearch,
  readRecentSearches,
  recentSearchesToSuggestions,
} from "@/lib/map/recent-searches"
import {
  mergeSearchSuggestions,
  placeSuggestionsToSearchSuggestions,
  type SearchSuggestion,
} from "@/lib/map/search-suggestions"
import type { GeocodeResult } from "@/lib/server/geocode-types"
import { cn } from "@/lib/utils"

export type MapSearchSelection = {
  address: string
  placeId?: string
  resolvedGeocode?: GeocodeResult
}

type MapSearchBarProps = {
  onSearch: (selection: MapSearchSelection) => void
  onSelectFromMap?: () => void
  isSearching?: boolean
  variant?: "floating" | "docked"
  instanceId?: string
  query?: string
  onQueryChange?: (query: string) => void
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  className?: string
}

export const MapSearchBar = ({
  onSearch,
  onSelectFromMap,
  isSearching = false,
  variant = "floating",
  instanceId = "search",
  query: queryProp,
  onQueryChange,
  expanded: expandedProp,
  onExpandedChange,
  className,
}: MapSearchBarProps) => {
  const baseId = useId()
  const listboxId = `${baseId}-${instanceId}`
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const [queryInternal, setQueryInternal] = useState("")
  const [expandedInternal, setExpandedInternal] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [placesAvailable] = useState(hasGooglePlacesClientKey)
  const [recentSearches, setRecentSearches] = useState<SearchSuggestion[]>([])

  const query = queryProp ?? queryInternal
  const expanded =
    variant === "docked" ? true : (expandedProp ?? expandedInternal)
  const isDocked = variant === "docked"

  const setQuery = useCallback(
    (value: string) => {
      onQueryChange?.(value)
      if (queryProp === undefined) {
        setQueryInternal(value)
      }
    },
    [onQueryChange, queryProp]
  )

  const setExpanded = useCallback(
    (value: boolean) => {
      if (isDocked) return
      onExpandedChange?.(value)
      if (expandedProp === undefined) {
        setExpandedInternal(value)
      }
    },
    [expandedProp, isDocked, onExpandedChange]
  )

  const refreshRecentSearches = useCallback(() => {
    setRecentSearches(recentSearchesToSuggestions(readRecentSearches()))
  }, [])

  const ensureSessionToken = useCallback(async () => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = await createAutocompleteSessionToken()
    }

    return sessionTokenRef.current
  }, [])

  const resetSessionToken = useCallback(() => {
    sessionTokenRef.current = null
  }, [])

  const fetchSuggestions = useCallback(
    async (value: string) => {
      const trimmed = value.trim()

      if (!placesAvailable) {
        setSuggestions(
          trimmed.length < 2 ? recentSearchesToSuggestions(readRecentSearches()) : []
        )
        return
      }

      if (trimmed.length < 2) {
        refreshRecentSearches()
        setSuggestions(recentSearchesToSuggestions(readRecentSearches()))
        setActiveIndex(-1)
        return
      }

      setIsLoadingSuggestions(true)

      try {
        const sessionToken = await ensureSessionToken()
        const places = await fetchPlaceSuggestions({
          input: trimmed,
          sessionToken,
        })

        setSuggestions(
          mergeSearchSuggestions(
            [],
            placeSuggestionsToSearchSuggestions(places)
          )
        )
        setActiveIndex(-1)
      } catch {
        setSuggestions([])
      } finally {
        setIsLoadingSuggestions(false)
      }
    },
    [ensureSessionToken, placesAvailable, refreshRecentSearches]
  )

  useEffect(() => {
    refreshRecentSearches()
  }, [refreshRecentSearches])

  useEffect(() => {
    if (!expanded) return

    const debounceMs = query.trim().length >= 2 ? 400 : 0
    const timeoutId = window.setTimeout(() => {
      void fetchSuggestions(query)
    }, debounceMs)

    return () => window.clearTimeout(timeoutId)
  }, [expanded, fetchSuggestions, query])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const container = containerRef.current
      if (!container) return

      // Other MapSearchBar instances (e.g. the mobile-floating variant while
      // viewing desktop) stay mounted but hidden via responsive `display:
      // none` classes. Their container can never "contain" a click target,
      // so without this guard they'd treat every click as "outside" and
      // force-collapse the shared expanded/query state.
      if (container.offsetParent === null) return

      if (!container.contains(event.target as Node)) {
        setShowSuggestions(false)

        if (!isDocked && !query.trim()) {
          setExpanded(false)
        }
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)

    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [isDocked, query, setExpanded])

  const recordRecentSearch = useCallback(
    (entry: { label: string; address: string; placeId?: string }) => {
      pushRecentSearch(entry)
      refreshRecentSearches()
    },
    [refreshRecentSearches]
  )

  const emitSearch = useCallback(
    ({
      address,
      placeId,
      resolvedGeocode,
      label,
    }: {
      address: string
      placeId?: string
      resolvedGeocode?: GeocodeResult
      label?: string
    }) => {
      recordRecentSearch({
        label: label ?? address,
        address,
        placeId,
      })

      onSearch({
        address,
        placeId,
        resolvedGeocode,
      })
      setShowSuggestions(false)
      resetSessionToken()
    },
    [onSearch, recordRecentSearch, resetSessionToken]
  )

  const resolveAndSearch = useCallback(
    async ({
      address,
      placeId,
      label,
    }: {
      address: string
      placeId?: string
      label: string
    }) => {
      if (!placeId || !placesAvailable) {
        emitSearch({ address, placeId, label })
        return
      }

      setIsLoadingSuggestions(true)

      try {
        const resolved: ResolvedPlace = await resolvePlacePrediction({
          placeId,
        })

        emitSearch({
          address: resolved.normalizedAddress,
          placeId,
          label,
          resolvedGeocode: buildGeocodeResultFromPlace(address, resolved),
        })
      } catch {
        emitSearch({ address, placeId, label })
      } finally {
        setIsLoadingSuggestions(false)
      }
    },
    [emitSearch, ensureSessionToken, placesAvailable]
  )

  const handleExpand = () => {
    setExpanded(true)
    setShowSuggestions(true)
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleSubmit = (value = query) => {
    const trimmed = value.trim()

    if (!trimmed) return

    const matchedSuggestion = suggestions.find(
      (suggestion) =>
        suggestion.address.toLowerCase() === trimmed.toLowerCase() ||
        suggestion.label.toLowerCase() === trimmed.toLowerCase()
    )

    if (matchedSuggestion) {
      void resolveAndSearch({
        address: matchedSuggestion.address,
        placeId: matchedSuggestion.placeId,
        label: matchedSuggestion.label,
      })
      return
    }

    void resolveAndSearch({
      address: trimmed,
      label: trimmed,
    })
  }

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.label)

    void resolveAndSearch({
      address: suggestion.address,
      placeId: suggestion.placeId,
      label: suggestion.label,
    })
  }

  const handleSelectFromMapClick = () => {
    setShowSuggestions(false)
    setActiveIndex(-1)
    inputRef.current?.blur()

    if (!isDocked && !query.trim()) {
      setExpanded(false)
    }

    onSelectFromMap?.()
  }

  const handleClear = () => {
    setQuery("")
    setShowSuggestions(false)
    setActiveIndex(-1)
    resetSessionToken()
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const items = showRecentWhenIdle ? recentSearches : suggestions

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setShowSuggestions(true)
      setActiveIndex((current) =>
        current >= items.length - 1 ? 0 : current + 1
      )
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setShowSuggestions(true)
      setActiveIndex((current) =>
        current <= 0 ? items.length - 1 : current - 1
      )
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()

      if (activeIndex >= 0 && items[activeIndex]) {
        handleSelectSuggestion(items[activeIndex])
        return
      }

      handleSubmit()
      return
    }

    if (event.key === "Escape") {
      setShowSuggestions(false)

      if (!isDocked && !query.trim()) {
        setExpanded(false)
      }
    }
  }

  const showRecentWhenIdle =
    query.trim().length < 2 && recentSearches.length > 0 && !isLoadingSuggestions
  const visibleSuggestions = showRecentWhenIdle ? recentSearches : suggestions
  const listVisible =
    expanded &&
    showSuggestions &&
    (Boolean(onSelectFromMap) ||
      visibleSuggestions.length > 0 ||
      isLoadingSuggestions ||
      (!placesAvailable && query.trim().length >= 2))

  return (
    <div
      ref={containerRef}
      className={cn("relative", isDocked ? "w-full" : "w-fit", className)}
    >
      <div
        className={cn(
          "group relative transition-[width] duration-300 ease-out",
          isDocked
            ? "w-full"
            : expanded
              ? "w-[min(calc(100vw-2rem),22rem)]"
              : "w-11"
        )}
      >
        <div className="flex h-11 w-full flex-row-reverse items-center overflow-hidden rounded-full border border-border/60 bg-white">
          <button
            type="button"
            aria-label={expanded ? "Search address" : "Open address search"}
            aria-expanded={expanded}
            disabled={isSearching}
            onClick={() => {
              if (!expanded) {
                handleExpand()
                return
              }

              handleSubmit()
            }}
            className="flex size-11 shrink-0 items-center justify-center text-foreground transition-colors hover:bg-muted/60 disabled:opacity-60"
          >
            {isSearching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="size-4" aria-hidden="true" />
            )}
          </button>

          <div
            className={cn(
              "min-w-0 flex-1 overflow-hidden transition-[opacity,width] duration-300 ease-out",
              expanded ? "w-auto opacity-100" : "w-0 opacity-0"
            )}
          >
            <label htmlFor={`${listboxId}-input`} className="sr-only">
              Search London location, address, or postcode
            </label>
            <input
              ref={inputRef}
              id={`${listboxId}-input`}
              type="text"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={listVisible}
              aria-controls={`${listboxId}-listbox`}
              aria-activedescendant={
                activeIndex >= 0
                  ? `${listboxId}-option-${activeIndex}`
                  : undefined
              }
              placeholder="Location, address or postcode"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => {
                setExpanded(true)
                setShowSuggestions(true)
              }}
              onKeyDown={handleKeyDown}
              className="h-11 w-full bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {expanded && query.trim() ? (
          <button
            type="button"
            aria-label="Clear search"
            disabled={isSearching}
            onClick={handleClear}
            className="absolute top-1/2 right-12 z-20 flex size-8 -translate-y-1/2 items-center justify-center opacity-0 pointer-events-none transition-opacity duration-200 ease-out group-focus-within:pointer-events-auto group-focus-within:opacity-100 disabled:opacity-60"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-white text-muted-foreground shadow-[0_0_0_3px_white,0_1px_3px_rgba(0,0,0,0.1)] transition-[color,background-color] hover:bg-muted/60 hover:text-foreground">
              <X className="size-3.5" aria-hidden="true" />
            </span>
          </button>
        ) : null}
      </div>

      {listVisible ? (
        <ul
          id={`${listboxId}-listbox`}
          role="listbox"
          aria-label="Location suggestions"
          className={cn(
            "absolute top-[calc(100%+0.5rem)] z-30 max-h-72 overflow-y-auto rounded-2xl border border-border/60 bg-white p-1.5",
            isDocked
              ? "inset-x-0 w-full"
              : "right-0 w-[min(calc(100vw-2rem),22rem)]"
          )}
        >
          {onSelectFromMap ? (
            <li role="presentation">
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  handleSelectFromMapClick()
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
              >
                <Crosshair
                  className="size-3.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                Select from map
              </button>
            </li>
          ) : null}

          {showRecentWhenIdle ? (
            <li className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Recent searches
            </li>
          ) : null}

          {isLoadingSuggestions ? (
            <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Searching locations…
            </li>
          ) : null}

          {!placesAvailable && query.trim().length >= 2 && !isLoadingSuggestions ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Google Places is not configured. Set NEXT_PUBLIC_GOOGLE_API.
            </li>
          ) : null}

          {visibleSuggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="presentation">
              <button
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  handleSelectSuggestion(suggestion)
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  activeIndex === index
                    ? "bg-muted text-foreground"
                    : "text-foreground hover:bg-muted/70"
                )}
              >
                {suggestion.source === "recent" ? (
                  <Clock3
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <MapPin
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{suggestion.label}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
