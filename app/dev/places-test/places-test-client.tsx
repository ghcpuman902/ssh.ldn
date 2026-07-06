"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  createAutocompleteSessionToken,
  fetchPlaceSuggestions,
  hasGooglePlacesClientKey,
  resolvePlacePrediction,
  type PlaceSuggestion,
  type ResolvedPlace,
} from "@/lib/map/google-places"

export const PlacesAutocompleteTestClient = () => {
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [resolved, setResolved] = useState<ResolvedPlace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const configured = hasGooglePlacesClientKey()

  const ensureSessionToken = useCallback(async () => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = await createAutocompleteSessionToken()
    }

    return sessionTokenRef.current
  }, [])

  useEffect(() => {
    if (!configured || query.trim().length < 2) {
      setSuggestions([])
      return
    }

    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true)
      setError(null)

      try {
        const sessionToken = await ensureSessionToken()
        const nextSuggestions = await fetchPlaceSuggestions({
          input: query,
          sessionToken,
        })

        setSuggestions(nextSuggestions)
      } catch (nextError) {
        setSuggestions([])
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Autocomplete request failed"
        )
      } finally {
        setIsLoading(false)
      }
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [configured, ensureSessionToken, query])

  const handleSelect = async (suggestion: PlaceSuggestion) => {
    setIsLoading(true)
    setError(null)

    try {
      const place = await resolvePlacePrediction({
        placeId: suggestion.placeId,
      })

      setResolved(place)
      sessionTokenRef.current = null
    } catch (nextError) {
      setResolved(null)
      setError(
        nextError instanceof Error ? nextError.message : "Place lookup failed"
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-white p-4">
      {!configured ? (
        <p className="text-sm text-destructive">
          NEXT_PUBLIC_GOOGLE_API is not set in your environment.
        </p>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-foreground">Search query</span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try a London address or postcode"
          className="h-11 w-full rounded-xl border border-border/60 px-3 text-sm outline-none focus:border-primary"
        />
      </label>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {suggestions.length > 0 ? (
        <ul className="space-y-1">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                onClick={() => void handleSelect(suggestion)}
                className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {resolved ? (
        <pre className="overflow-x-auto rounded-xl bg-muted p-3 text-xs text-foreground">
          {JSON.stringify(resolved, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}
