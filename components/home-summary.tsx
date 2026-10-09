import Link from "next/link"

import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site"

/**
 * The map is client-only, so the server HTML would otherwise have no text.
 * This gives crawlers, AI search and screen-reader users a heading and a
 * plain-language summary of what the map shows. Visually hidden on purpose:
 * the visible UI is the map itself.
 */
export const HomeSummary = () => (
  <section aria-labelledby="home-summary-title" className="sr-only">
    <h1 id="home-summary-title">
      {SITE_NAME} — {SITE_TAGLINE}
    </h1>
    <p>{SITE_DESCRIPTION}</p>
    <h2>What the map shows</h2>
    <ul>
      <li>
        Road, rail and aircraft noise from the official DEFRA Round 4 strategic
        noise maps (2021 baseline, annual averages).
      </li>
      <li>
        Local noise sources from OpenStreetMap: pubs, bars, clubs, music venues
        and hospitals.
      </li>
      <li>
        Day and night views for weekdays and weekends, plus an address report
        with a 0–100 noise score, confidence band and recommended checks.
      </li>
    </ul>
    <nav aria-label="About ssh-ldn">
      <Link href="/about">About and FAQ</Link>{" "}
      <Link href="/data-sources">Data sources</Link>{" "}
      <Link href="/api-docs">API and MCP docs</Link>
    </nav>
  </section>
)
