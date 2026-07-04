import { MAP_DATA_CREDITS } from "@/lib/map/data-credits";

export const MapDataCredits = () => (
  <footer
    aria-label="Data source credits"
    className="pointer-events-auto max-w-[min(100%,36rem)] rounded-lg border border-border/50 bg-background/85 px-2.5 py-1.5 text-[10px] leading-snug text-muted-foreground shadow-sm backdrop-blur-sm"
  >
    {MAP_DATA_CREDITS.map((credit) => (
      <span key={credit.id} className="after:mx-1 after:content-['·'] last:after:content-none">
        <a
          href={credit.datasetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:text-foreground hover:underline"
          title={`${credit.title} — ${credit.licence}`}
        >
          {credit.attribution}
        </a>
      </span>
    ))}
  </footer>
);
