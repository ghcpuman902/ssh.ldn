"use client"

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { Loader2, MapPin, Search } from "lucide-react"

import type { SearchSuggestion } from "@/lib/map/search-suggestions"
import { cn } from "@/lib/utils"

export type MapSearchSelection = {
  address: string
  testPointId?: string
}

type MapSearchBarProps = {
  onSearch: (selection: MapSearchSelection) => void
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
  const [queryInternal, setQueryInternal] = useState("")
  const [expandedInternal, setExpandedInternal] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

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

  const fetchSuggestions = useCallback(async (value: string) => {
    setIsLoadingSuggestions(true)

    try {
      const params = new URLSearchParams({ q: value })
      const response = await fetch(
        `/api/discovery/postcodes/autocomplete?${params.toString()}`
      )
      const data = (await response.json()) as {
        suggestions: SearchSuggestion[]
      }

      setSuggestions(data.suggestions ?? [])
      setActiveIndex(-1)
    } catch {
      setSuggestions([])
    } finally {
      setIsLoadingSuggestions(false)
    }
  }, [])

  useEffect(() => {
    if (!expanded) return

    const debounceMs = query.trim().length >= 2 ? 220 : 0
    const timeoutId = window.setTimeout(() => {
      void fetchSuggestions(query)
    }, debounceMs)

    return () => window.clearTimeout(timeoutId)
  }, [expanded, fetchSuggestions, query])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setShowSuggestions(false)

        if (!isDocked && !query.trim()) {
          setExpanded(false)
        }
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)

    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [isDocked, query, setExpanded])

  const handleExpand = () => {
    setExpanded(true)
    setShowSuggestions(true)
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleSubmit = (value = query) => {
    const trimmed = value.trim()

    if (!trimmed) return

    const matchedPreset = suggestions.find(
      (suggestion) =>
        suggestion.source === "preset" &&
        suggestion.address.toLowerCase() === trimmed.toLowerCase()
    )

    onSearch({
      address: trimmed,
      testPointId: matchedPreset?.testPointId,
    })
    setShowSuggestions(false)
  }

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.address)
    onSearch({
      address: suggestion.address,
      testPointId: suggestion.testPointId,
    })
    setShowSuggestions(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setShowSuggestions(true)
      setActiveIndex((current) =>
        current >= suggestions.length - 1 ? 0 : current + 1
      )
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setShowSuggestions(true)
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1
      )
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()

      if (activeIndex >= 0 && suggestions[activeIndex]) {
        handleSelectSuggestion(suggestions[activeIndex])
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

  return (
    <div
      ref={containerRef}
      className={cn("relative", isDocked ? "w-full" : "w-fit", className)}
    >
      <div
        className={cn(
          "flex flex-row-reverse items-center overflow-hidden rounded-full border border-border/60 bg-white transition-[width] duration-300 ease-out",
          isDocked
            ? "w-full"
            : expanded
              ? "w-[min(calc(100vw-2rem),22rem)]"
              : "w-11"
        )}
      >
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
            type="search"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSuggestions && suggestions.length > 0}
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

      {expanded && showSuggestions && (suggestions.length > 0 || isLoadingSuggestions) ? (
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
          {isLoadingSuggestions ? (
            <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Searching locations…
            </li>
          ) : null}

          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="presentation">
              <button
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => handleSelectSuggestion(suggestion)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  activeIndex === index
                    ? "bg-muted text-foreground"
                    : "text-foreground hover:bg-muted/70"
                )}
              >
                <MapPin
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{suggestion.label}</span>
                  {suggestion.source === "preset" ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Demo address
                    </span>
                  ) : suggestion.source === "nominatim" ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Location
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
